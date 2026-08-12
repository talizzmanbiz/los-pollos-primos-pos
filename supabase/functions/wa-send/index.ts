// Responderle a un cliente de WhatsApp desde el POS (/conversaciones).
//
//   POST  { "phone": "50370001111", "text": "Ya va en camino" }
//     → { ok: true, message_id, human_until }
//
// Auth: JWT del usuario del POS (admin o superadmin). El token de WhatsApp
// vive solo acá — el navegador nunca lo ve.
//
// Además de mandar el mensaje, empuja `human_until` 30 minutos: mientras esa
// ventana esté viva el bot se calla para este cliente, para que no conteste
// encima de la persona. Vencida, el bot vuelve solo.
//
// Secrets: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_ID
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MINUTOS_SIN_BOT = 30;

function bad(message: string, status = 400): Response {
  return Response.json({ error: message }, { status, headers: CORS });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return bad('Método no permitido', 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  // Solo admin/superadmin activos: las conversaciones traen datos personales
  // y responder habla a nombre del negocio.
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: caller } = await admin.auth.getUser(jwt);
  if (!caller?.user) return bad('No autorizado', 401);

  const { data: perfil } = await admin
    .from('profiles')
    .select('role, active')
    .eq('id', caller.user.id)
    .maybeSingle();
  if (!perfil?.active || !['admin', 'superadmin'].includes(perfil.role)) {
    return bad('Solo admin puede responder', 403);
  }

  let body: { phone?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return bad('JSON inválido');
  }

  const phone = body.phone?.trim();
  const text = body.text?.trim();
  if (!phone || !text) return bad('Faltan phone y text');
  // WhatsApp corta en 4096; avisamos en vez de mandar algo truncado en silencio.
  if (text.length > 4000) return bad('El mensaje es muy largo (máximo 4000 caracteres)');

  const { data: conv } = await admin
    .from('whatsapp_conversations')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();
  if (!conv) return bad('No hay conversación con ese número', 404);

  const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const phoneId = Deno.env.get('WHATSAPP_PHONE_ID');
  if (!token || !phoneId) return bad('WhatsApp no está configurado', 503);

  // Mandar primero: si Meta lo rechaza no queremos un mensaje en el historial
  // que el cliente nunca recibió.
  let res: Response;
  try {
    res = await fetch(`https://graph.facebook.com/v18.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'text',
        text: { preview_url: false, body: text },
      }),
    });
  } catch (err) {
    console.error('WhatsApp inalcanzable', err);
    return bad('No se pudo contactar WhatsApp', 502);
  }

  if (!res.ok) {
    const detalle = await res.text();
    console.error('envío falló', res.status, detalle);
    // El caso común es la ventana de 24h de Meta: solo se puede escribir libre
    // a quien te escribió en las últimas 24 horas.
    return Response.json(
      {
        error:
          'WhatsApp rechazó el mensaje. Si el cliente no le escribe desde hace más de 24 horas, Meta no deja responderle.',
        detalle,
      },
      { status: 502, headers: CORS },
    );
  }

  const humanUntil = new Date(Date.now() + MINUTOS_SIN_BOT * 60_000).toISOString();

  const { data: fila } = await admin
    .from('whatsapp_messages')
    .insert({
      conversation_id: conv.id,
      direction: 'out',
      body: text,
      sent_by: caller.user.id,
    })
    .select('id')
    .single();

  await admin
    .from('whatsapp_conversations')
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: text.replace(/\s+/g, ' ').slice(0, 120),
      last_direction: 'out',
      human_until: humanUntil,
    })
    .eq('id', conv.id);

  return Response.json(
    { ok: true, message_id: fila?.id ?? null, human_until: humanUntil },
    { headers: CORS },
  );
});
