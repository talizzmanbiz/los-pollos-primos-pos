// Búsqueda y captura de contactos en GoHighLevel.
//
// Dos acciones, ambas por POST:
//
//   { "action": "lookup", "phone": "50370001111" }
//     → { found: true, name: "María", first_name: "María", contact_id: "..." }
//     → { found: false }
//     Sirve para que el bot salude por nombre a un cliente que ya está en el CRM.
//     Exige x-webhook-secret (WHATSAPP_WEBHOOK_SECRET).
//
//   { "action": "upsert", "source": "whatsapp|website|pos", "phone": "...",
//     "name": "...", "email": "...", "address": "..." }
//     → { ok: true, contact_id: "..." }
//     Guarda/actualiza el contacto apenas el cliente da sus datos, sin esperar a
//     que la orden se pague (tag 'intento-pedido'). sync-ghl corre aparte al
//     pagarse el pedido y agrega 'pedido-completado' + estadísticas de consumo.
//     source='website' no exige secreto: el formulario del sitio corre en el
//     navegador y no puede guardar uno, igual que los pedidos 'online' de
//     create-order.
//
// El armado del contacto (teléfono E.164, firstName, tags) vive en _shared/ghl.ts
// para que las tres fuentes manden exactamente el mismo formato y GHL no cree
// contactos duplicados.
//
// Secrets (Dashboard → Edge Functions → Secrets):
//   GHL_API_KEY, GHL_LOCATION_ID, WHATSAPP_WEBHOOK_SECRET
//
// Si GHL no está configurado, responde 200 con { skipped } para no romper nunca
// la conversación del bot.

import {
  armarContacto,
  type Canal,
  GHL_BASE,
  headersGhl,
  origenPermitido,
  toE164,
} from '../_shared/ghl.ts';

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
  /** Canal de origen. Por defecto 'whatsapp': es quien más llama esta función. */
  source?: Canal;
}

function bad(message: string, status = 400): Response {
  return Response.json({ error: message }, { status, headers: CORS });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return bad('Método no permitido', 405);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return bad('JSON inválido');
  }

  const canal: Canal = body.source ?? 'whatsapp';
  if (!['whatsapp', 'website', 'pos'].includes(canal)) return bad('source inválido');

  // El formulario del sitio corre en el navegador y no puede guardar un secreto,
  // igual que los pedidos 'online' de create-order. Solo puede dar de alta un
  // lead (upsert); consultar el CRM sí exige el secreto del bot.
  //
  // ponytail: el chequeo de Origin para en seco el scraper que encuentra la URL,
  // pero un Origin se falsifica fuera del navegador. Es el 80% barato y sin
  // estado; si algún día entra spam de verdad, ahí sí toca rate-limit por IP
  // con tabla, que hoy no se justifica para el tráfico que tiene el formulario.
  if (canal === 'website') {
    if ((body.action ?? 'lookup') !== 'upsert') return bad('No autorizado', 401);
    if (!origenPermitido(req.headers.get('origin'))) return bad('No autorizado', 401);
  } else {
    const secret = Deno.env.get('WHATSAPP_WEBHOOK_SECRET');
    if (!secret || req.headers.get('x-webhook-secret') !== secret) {
      return bad('No autorizado', 401);
    }
  }

  if (!body.phone?.trim()) return bad('Falta phone');
  const action = body.action ?? 'lookup';
  if (!['lookup', 'upsert'].includes(action)) return bad('action inválida');
  // Un teléfono salvadoreño son 8 dígitos; con país, 11. Filtra basura del
  // formulario público antes de que llegue al CRM.
  const soloDigitos = body.phone.replace(/\D/g, '');
  if (soloDigitos.length < 8 || soloDigitos.length > 13) return bad('Teléfono inválido');

  const apiKey = Deno.env.get('GHL_API_KEY');
  const locationId = Deno.env.get('GHL_LOCATION_ID');
  if (!apiKey || !locationId) {
    // GHL no configurado — nunca bloqueamos al bot
    return Response.json({ skipped: 'GHL no configurado', found: false }, { headers: CORS });
  }

  const phone = toE164(body.phone);
  const headers = headersGhl(apiKey);

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
  // Acá el cliente ya dio sus datos pero todavía no hay orden pagada: es
  // 'intento-pedido'. Cuando pague, sync-ghl vuelve a hacer upsert sobre el
  // mismo teléfono y le agrega 'pedido-completado'.
  const upsertBody = armarContacto({
    locationId,
    canal,
    estado: 'intento-pedido',
    phone: body.phone,
    name: body.name,
    email: body.email,
    address: body.address,
  });

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
