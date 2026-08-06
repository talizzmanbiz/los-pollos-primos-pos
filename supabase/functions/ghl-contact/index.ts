// Búsqueda y captura de contactos en GoHighLevel para el chatbot de WhatsApp.
//
// Dos acciones, ambas por POST y protegidas con el mismo x-webhook-secret que
// usa create-order (WHATSAPP_WEBHOOK_SECRET):
//
//   { "action": "lookup", "phone": "50370001111" }
//     → { found: true, name: "María", first_name: "María", contact_id: "..." }
//     → { found: false }
//     Sirve para que el bot salude por nombre a un cliente que ya está en el CRM.
//
//   { "action": "upsert", "phone": "...", "name": "...", "email": "...",
//     "address": "...", "zone": "Chalchuapa Centro" }
//     → { ok: true, contact_id: "..." }
//     Guarda/actualiza el contacto apenas el cliente da sus datos, sin esperar a
//     que la orden se pague. sync-ghl sigue corriendo aparte al pagarse el pedido
//     y agrega las estadísticas de consumo.
//
// Secrets (Dashboard → Edge Functions → Secrets):
//   GHL_API_KEY, GHL_LOCATION_ID, WHATSAPP_WEBHOOK_SECRET
//
// Si GHL no está configurado, responde 200 con { skipped } para no romper nunca
// la conversación del bot.

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Body {
  action?: 'lookup' | 'upsert';
  phone?: string;
  name?: string;
  email?: string;
  address?: string;
  zone?: string;
}

function bad(message: string, status = 400): Response {
  return Response.json({ error: message }, { status, headers: CORS });
}

// El bot manda el número tal como llega de WhatsApp (50370001111). GHL guarda E.164.
function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.startsWith('503') ? `+${digits}` : `+503${digits}`;
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

  if (!body.phone?.trim()) return bad('Falta phone');
  const action = body.action ?? 'lookup';
  if (!['lookup', 'upsert'].includes(action)) return bad('action inválida');

  const apiKey = Deno.env.get('GHL_API_KEY');
  const locationId = Deno.env.get('GHL_LOCATION_ID');
  if (!apiKey || !locationId) {
    // GHL no configurado — nunca bloqueamos al bot
    return Response.json({ skipped: 'GHL no configurado', found: false }, { headers: CORS });
  }

  const phone = toE164(body.phone);
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Version: GHL_VERSION,
    'Content-Type': 'application/json',
  };

  if (action === 'lookup') {
    try {
      const url = `${GHL_BASE}/contacts/search/duplicate` +
        `?locationId=${encodeURIComponent(locationId)}&number=${encodeURIComponent(phone)}`;
      const res = await fetch(url, { headers });

      if (!res.ok) {
        // Un 404 acá significa "no existe", no es un fallo real
        if (res.status === 404) {
          return Response.json({ found: false }, { headers: CORS });
        }
        console.error('GHL lookup falló', res.status, await res.text());
        return Response.json({ found: false, error: 'lookup falló' }, { headers: CORS });
      }

      const data = await res.json();
      const contact = data?.contact ?? null;
      if (!contact) return Response.json({ found: false }, { headers: CORS });

      const firstName: string | null =
        contact.firstName ?? (contact.name ? String(contact.name).split(' ')[0] : null);

      return Response.json({
        found: true,
        contact_id: contact.id ?? null,
        name: contact.name ?? contact.firstName ?? null,
        first_name: firstName,
        email: contact.email ?? null,
      }, { headers: CORS });
    } catch (err) {
      console.error('GHL inalcanzable', err);
      return Response.json({ found: false, error: 'GHL inalcanzable' }, { headers: CORS });
    }
  }

  // ---- upsert ----
  const upsertBody: Record<string, unknown> = {
    locationId,
    phone,
    tags: ['los-pollos-primos', 'whatsapp'],
    source: 'WhatsApp Bot',
  };
  if (body.name?.trim()) upsertBody.name = body.name.trim();
  if (body.email?.trim()) upsertBody.email = body.email.trim();
  if (body.address?.trim()) {
    upsertBody.address1 = body.address.trim();
    upsertBody.city = 'Chalchuapa';
    upsertBody.state = 'Santa Ana';
    upsertBody.country = 'SV';
  }

  try {
    const res = await fetch(`${GHL_BASE}/contacts/upsert`, {
      method: 'POST',
      headers,
      body: JSON.stringify(upsertBody),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error('GHL upsert falló', res.status, detail);
      // 200 a propósito: que el bot siga tomando la orden aunque el CRM falle
      return Response.json({ ok: false, error: 'no se pudo guardar el contacto' }, { headers: CORS });
    }

    const data = await res.json();
    return Response.json({
      ok: true,
      contact_id: data?.contact?.id ?? null,
    }, { headers: CORS });
  } catch (err) {
    console.error('GHL inalcanzable', err);
    return Response.json({ ok: false, error: 'GHL inalcanzable' }, { headers: CORS });
  }
});
