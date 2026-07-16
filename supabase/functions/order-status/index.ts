// Customer order status lookup: phone + order number (both must match).
// Used by the storefront status page and the WhatsApp bot.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const STATUS_LABELS: Record<string, string> = {
  received: 'Recibido',
  in_progress: 'En preparación',
  ready: 'Listo',
  out_for_delivery: 'En camino',
  completed: 'Entregado',
  cancelled: 'Cancelado',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') {
    return Response.json({ error: 'Método no permitido' }, { status: 405, headers: CORS });
  }

  let body: { phone?: string; order_number?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400, headers: CORS });
  }

  const phone = (body.phone ?? '').replace(/\D/g, '');
  const orderNumber = (body.order_number ?? '').trim().toUpperCase();
  if (!phone || !orderNumber) {
    return Response.json({ error: 'Faltan teléfono o número de pedido' }, { status: 400, headers: CORS });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: order } = await admin
    .from('orders')
    .select('id, order_number, status, order_type, total, estimated_minutes, created_at, customer_phone, order_items(quantity, unit_price, product:products(name))')
    .eq('order_number', orderNumber)
    .maybeSingle();

  // compare digits only so +503 7777-8888 matches 77778888
  const stored = (order?.customer_phone ?? '').replace(/\D/g, '');
  if (!order || !stored || !(stored.endsWith(phone) || phone.endsWith(stored))) {
    return Response.json(
      { error: 'Pedido no encontrado — revisá el número de pedido y el teléfono' },
      { status: 404, headers: CORS },
    );
  }

  const { data: events } = await admin
    .from('order_status_events')
    .select('status, created_at')
    .eq('order_id', order.id)
    .order('created_at');

  return Response.json(
    {
      order_number: order.order_number,
      status: order.status,
      status_label: STATUS_LABELS[order.status] ?? order.status,
      order_type: order.order_type,
      total: order.total,
      estimated_minutes: order.estimated_minutes,
      created_at: order.created_at,
      items: (order.order_items ?? []).map((i: { quantity: number; unit_price: number; product: { name: string } | null }) => ({
        name: i.product?.name ?? '?',
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
      timeline: (events ?? []).map((e) => ({
        status: e.status,
        status_label: STATUS_LABELS[e.status] ?? e.status,
        at: e.created_at,
      })),
    },
    { headers: CORS },
  );
});
