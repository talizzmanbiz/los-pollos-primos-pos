// Genera el enlace de pago de Wompi para una orden YA creada.
//
// Existe por un fallo real: un cliente confirmó su pedido en efectivo y medio
// minuto después pidió pagar con tarjeta. El bot no tenía ninguna herramienta
// para eso, así que se inventó una URL con pinta de enlace de Wompi y se la
// mandó. Mientras no exista este endpoint, el agente vuelve a improvisar.
//
// El enlace se crea por la API (con `urlWebhook` apuntando a wompi-webhook), así
// que al pagarse el POS se entera solo. Un enlace hecho a mano en el panel de
// Wompi no avisa a nadie.
//
//   POST /payment-link
//   header: x-webhook-secret: <WHATSAPP_WEBHOOK_SECRET>
//   body:   { "order_number": "PP-C-0042" }
//   → { order_number, total, payment_url, ya_existia }
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createPaymentLink } from '../_shared/payments.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const bad = (message: string, status = 400) =>
  Response.json({ error: message }, { status, headers: CORS });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return bad('Método no permitido', 405);

  // Dos llamadores legítimos: el bot de WhatsApp con el secreto compartido, y
  // el POS con la sesión del cajero. verify_jwt está apagado por el primero,
  // así que el token del segundo se valida acá a mano — sin esto habría que
  // meter el secreto en el bundle del navegador, donde lo lee cualquiera.
  const secret = Deno.env.get('WHATSAPP_WEBHOOK_SECRET');
  const conSecreto = !!secret && req.headers.get('x-webhook-secret') === secret;

  let conSesion = false;
  const auth = req.headers.get('authorization') ?? '';
  if (!conSecreto && auth.startsWith('Bearer ')) {
    const comoUsuario = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data } = await comoUsuario.auth.getUser();
    conSesion = !!data.user;
  }

  if (!conSecreto && !conSesion) return bad('No autorizado', 401);

  let body: { order_number?: string };
  try {
    body = await req.json();
  } catch {
    return bad('JSON inválido');
  }

  const orderNumber = body.order_number?.trim().toUpperCase();
  if (!orderNumber) return bad('Falta order_number');

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: order } = await admin
    .from('orders')
    .select('id, order_number, total, status, payment_status, payment_url, customer_name, customer_phone')
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (!order) return bad('No encontré esa orden', 404);
  if (order.status === 'cancelled') return bad('Esa orden está cancelada', 409);
  if (order.payment_status === 'paid') return bad('Esa orden ya está pagada', 409);
  if (Number(order.total) <= 0) return bad('Esa orden no tiene monto que cobrar', 409);

  // Reutilizar el enlace existente: pedir otro cobraría dos veces si el cliente
  // llega a pagar los dos.
  if (order.payment_url) {
    return Response.json({
      order_number: order.order_number,
      total: Number(order.total),
      payment_url: order.payment_url,
      ya_existia: true,
    }, { headers: CORS });
  }

  const url = await createPaymentLink({
    orderId: order.id,
    orderNumber: order.order_number,
    total: Number(order.total),
    customerName: order.customer_name ?? 'Cliente',
    customerPhone: order.customer_phone ?? '',
  });

  if (!url) {
    // Se devuelve el fallo explícito para que el bot diga la verdad en vez de
    // inventarse un enlace.
    return bad('Wompi no devolvió el enlace. Ofrecé pago en efectivo.', 502);
  }

  await admin.from('orders')
    .update({ payment_url: url, payment_method: 'payment_link' })
    .eq('id', order.id);

  return Response.json({
    order_number: order.order_number,
    total: Number(order.total),
    payment_url: url,
    ya_existia: false,
  }, { headers: CORS });
});
