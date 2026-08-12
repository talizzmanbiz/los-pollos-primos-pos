// Guarda el historial de conversaciones de WhatsApp para que el POS pueda
// mostrarlo en /conversaciones.
//
// El chatbot de n8n llama a esta función UNA sola vez por turno, ya con el
// mensaje del cliente y la respuesta del bot juntos, de modo que no se agrega
// latencia antes de contestarle a la persona:
//
//   POST  { "phone": "50370001111",
//           "name": "Marvin",
//           "ghl_contact_id": "abc123",          // opcional
//           "messages": [
//             { "direction": "in",  "text": "...", "wa_message_id": "wamid..." },
//             { "direction": "out", "text": "..." }
//           ] }
//     → { ok: true, conversation_id, inserted: 2 }
//
// Protegida con el mismo x-webhook-secret que create-order (WHATSAPP_WEBHOOK_SECRET).
//
// Nunca devuelve un error que pueda romper la conversación: si algo falla acá,
// se pierde una línea del historial, no una venta.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Incoming {
  direction?: 'in' | 'out';
  text?: string;
  wa_message_id?: string;
}

interface Body {
  phone?: string;
  name?: string;
  ghl_contact_id?: string;
  messages?: Incoming[];
}

function bad(message: string, status = 400): Response {
  return Response.json({ error: message }, { status, headers: CORS });
}

/** Vista previa para la lista de chats: una línea, sin saltos. */
function preview(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 120);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return bad('Método no permitido', 405);

  const secret = Deno.env.get('WHATSAPP_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return bad('No autorizado', 401);
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return bad('JSON inválido');
  }

  const phone = body.phone?.trim();
  if (!phone) return bad('Falta phone');

  const entradas = (body.messages ?? []).filter(
    (m): m is Required<Pick<Incoming, 'direction' | 'text'>> & Incoming =>
      (m.direction === 'in' || m.direction === 'out') && !!m.text?.trim(),
  );
  if (entradas.length === 0) return bad('Falta messages');

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  try {
    // La conversación es una por teléfono. Solo pisamos el nombre si viene uno
    // nuevo, para no borrar el que ya teníamos con un mensaje sin perfil.
    const { data: conv, error: convErr } = await admin
      .from('whatsapp_conversations')
      .upsert(
        {
          phone,
          ...(body.name?.trim() ? { customer_name: body.name.trim() } : {}),
          ...(body.ghl_contact_id ? { ghl_contact_id: body.ghl_contact_id } : {}),
        },
        { onConflict: 'phone' },
      )
      .select('id, message_count, human_until')
      .single();

    if (convErr || !conv) {
      console.error('upsert conversación falló', convErr);
      return Response.json({ ok: false, error: 'no se pudo guardar' }, { headers: CORS });
    }

    // El equipo contestó hace poco desde el POS: el bot se calla hasta que
    // venza la ventana. n8n lo consulta ANTES de llamar al agente.
    const pausado = !!conv.human_until && new Date(conv.human_until) > new Date();

    // Deduplicación de un reintento del webhook de Meta.
    //
    // No se puede usar upsert con onConflict: el índice único sobre
    // wa_message_id es PARCIAL (solo donde no es null, porque los mensajes
    // salientes no tienen wamid) y Postgres no infiere índices parciales en
    // ON CONFLICT. Así que preguntamos primero.
    //
    // Si el mensaje del cliente ya estaba, el turno completo ya se registró:
    // se descarta entero, porque la respuesta del bot no trae wamid propio y
    // si no se quedaría duplicada.
    const wamids = entradas
      .map((m) => m.wa_message_id)
      .filter((id): id is string => !!id);

    if (wamids.length > 0) {
      const { data: previos } = await admin
        .from('whatsapp_messages')
        .select('wa_message_id')
        .in('wa_message_id', wamids);

      if (previos && previos.length > 0) {
        return Response.json(
          { ok: true, conversation_id: conv.id, inserted: 0, duplicado: true, pausado },
          { headers: CORS },
        );
      }
    }

    const { data: filas, error: msgErr } = await admin
      .from('whatsapp_messages')
      .insert(
        entradas.map((m) => ({
          conversation_id: conv.id,
          direction: m.direction,
          body: m.text.trim(),
          wa_message_id: m.wa_message_id ?? null,
        })),
      )
      .select('id');

    if (msgErr) {
      console.error('insert mensajes falló', msgErr);
      return Response.json({ ok: false, error: 'no se pudieron guardar los mensajes' }, { headers: CORS });
    }

    const insertados = filas?.length ?? 0;
    const ultimo = entradas[entradas.length - 1];

    await admin
      .from('whatsapp_conversations')
      .update({
        message_count: (conv.message_count ?? 0) + insertados,
        last_message_at: new Date().toISOString(),
        last_message_preview: preview(ultimo.text),
        last_direction: ultimo.direction,
      })
      .eq('id', conv.id);

    return Response.json(
      { ok: true, conversation_id: conv.id, inserted: insertados, pausado },
      { headers: CORS },
    );
  } catch (err) {
    console.error('wa-log falló', err);
    return Response.json({ ok: false, error: 'error interno' }, { headers: CORS });
  }
});
