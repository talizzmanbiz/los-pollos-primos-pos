// Wompi El Salvador payment webhook. Wompi POSTs here after a card transaction
// on an Enlace de Pago (configured via `configuracion.urlWebhook` when the link
// is created in _shared/payments.ts). On an approved transaction we mark the
// matching order paid. Docs: https://docs.wompi.sv/webhook
//
// Auth: this endpoint is public (verify_jwt disabled) but every request is
// authenticated by the `wompi_hash` header — the lowercase-hex HMAC-SHA256 of
// the raw body keyed with the Wompi API Secret. Requests that don't match are
// rejected 401.
//
// Secrets:
//   WOMPI_API_SECRET  same value used to create the links (HMAC key)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  (injected automatically)
import { createClient } from 'jsr:@supabase/supabase-js@2';

const enc = new TextEncoder();

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// constant-time string compare
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

interface WompiWebhook {
  IdTransaccion?: string;
  ResultadoTransaccion?: string; // "ExitosaAprobada" when approved
  Monto?: number;
  EsProductiva?: boolean;
  EnlacePago?: { IdentificadorEnlaceComercio?: string };
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Método no permitido' }, { status: 405 });
  }

  const secret = Deno.env.get('WOMPI_API_SECRET');
  if (!secret) {
    console.error('WOMPI_API_SECRET no configurado — no se puede validar el webhook');
    return Response.json({ error: 'no configurado' }, { status: 503 });
  }

  // Read the body EXACTLY as sent — the HMAC is over the raw bytes.
  const raw = await req.text();
  const provided = req.headers.get('wompi_hash') ?? '';
  const expected = await hmacHex(secret, raw);
  if (!provided || !safeEqual(provided.toLowerCase(), expected)) {
    console.error('wompi webhook firma inválida');
    return Response.json({ error: 'firma inválida' }, { status: 401 });
  }

  let body: WompiWebhook;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const orderNumber = body.EnlacePago?.IdentificadorEnlaceComercio?.trim();
  const approved = body.ResultadoTransaccion === 'ExitosaAprobada';

  // Acknowledge with 200 so Wompi stops retrying, even when we don't act.
  if (!orderNumber) {
    return Response.json({ ok: true, skipped: 'sin identificador de enlace' });
  }
  if (!approved) {
    console.log('wompi webhook no aprobado', orderNumber, body.ResultadoTransaccion);
    return Response.json({ ok: true, skipped: `no aprobado: ${body.ResultadoTransaccion}` });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Idempotent: only flip orders that aren't already paid.
  const { data: updated, error } = await admin
    .from('orders')
    .update({
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
      payment_reference: body.IdTransaccion ?? null,
    })
    .eq('order_number', orderNumber)
    .neq('payment_status', 'paid')
    .select('id, source, customer_phone, total');

  if (error) {
    console.error('wompi webhook update falló', orderNumber, error);
    return Response.json({ error: 'update falló' }, { status: 500 });
  }

  // Confirmarle el pago al cliente del chatbot. Va acá y no en n8n porque el
  // bot solo habla cuando le escriben: este webhook es el único momento en que
  // sabemos que el pago entró. `updated` viene vacío si ya estaba pagada, así
  // que un reintento de Wompi no manda el mensaje dos veces.
  //
  // Solo pedidos de WhatsApp: Meta únicamente deja mandar texto libre a quien
  // te escribió en las últimas 24h, y quien compró en la tienda web puede no
  // haberlo hecho nunca.
  const order = updated?.[0];
  const waToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const waPhoneId = Deno.env.get('WHATSAPP_PHONE_ID');
  if (order?.source === 'whatsapp' && order.customer_phone && waToken && waPhoneId) {
    const texto =
      `*Pago recibido* ✅\n\nSu pedido *${orderNumber}* ya quedó pagado ` +
      `($${Number(order.total).toFixed(2)}). Se lo estamos preparando.\n\n¡Gracias! 🍗`;
    try {
      const res = await fetch(
        `https://graph.facebook.com/v18.0/${waPhoneId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${waToken}` },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: order.customer_phone,
            type: 'text',
            text: { preview_url: false, body: texto },
          }),
        },
      );
      if (!res.ok) console.error('aviso de pago falló', orderNumber, await res.text());
    } catch (err) {
      // Nunca romper el webhook por esto: la orden ya quedó pagada.
      console.error('WhatsApp inalcanzable', err);
    }
  }

  return Response.json({
    ok: true,
    order_number: orderNumber,
    updated: updated?.length ?? 0,
    productive: body.EsProductiva ?? null,
  });
});
