// Public order intake for the online storefront and the WhatsApp bot (n8n).
// Prices are always computed server-side from the catalog — the client only
// sends SKUs/quantities. WhatsApp calls must carry the shared webhook secret.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { createPaymentLink } from '../_shared/payments.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface OrderRequest {
  source: 'online' | 'whatsapp';
  location_code?: string; // 'C' | 'M' — defaults to 'C'
  order_type: 'pickup' | 'delivery';
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  delivery_address?: string;
  delivery_zone_id?: string;
  payment_method: 'cash' | 'payment_link';
  items: { sku: string; quantity: number }[];
  notes?: string;
}

function bad(message: string, status = 400): Response {
  return Response.json({ error: message }, { status, headers: CORS });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return bad('Método no permitido', 405);

  let body: OrderRequest;
  try {
    body = await req.json();
  } catch {
    return bad('JSON inválido');
  }

  if (body.source === 'whatsapp') {
    const secret = Deno.env.get('WHATSAPP_WEBHOOK_SECRET');
    if (!secret || req.headers.get('x-webhook-secret') !== secret) {
      return bad('No autorizado', 401);
    }
  } else if (body.source !== 'online') {
    return bad('source inválido');
  }

  if (!body.customer_name?.trim() || !body.customer_phone?.trim()) {
    return bad('Nombre y teléfono son obligatorios');
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return bad('El pedido no tiene productos');
  }
  if (!['pickup', 'delivery'].includes(body.order_type)) {
    return bad('order_type inválido');
  }
  if (!['cash', 'payment_link'].includes(body.payment_method)) {
    return bad('payment_method inválido');
  }
  // Online orders must be paid online (avoids no-show pickups).
  if (body.source === 'online' && body.payment_method !== 'payment_link') {
    return bad('El pago en línea es obligatorio para pedidos web');
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Online orders are always Sucursal Central (Mercado is never an online option).
  const locationCode = body.source === 'online' ? 'C' : (body.location_code ?? 'C').toUpperCase();
  const { data: location } = await admin
    .from('locations')
    .select('*')
    .eq('code', locationCode)
    .eq('active', true)
    .maybeSingle();
  if (!location) return bad('Sucursal no encontrada');

  if (body.order_type === 'delivery') {
    if (!location.allows_delivery) return bad('Delivery solo disponible en Sucursal Central');
    if (!body.delivery_zone_id) return bad('Falta la zona de delivery');
    if (!body.delivery_address?.trim()) return bad('Falta la dirección de entrega');
  }

  // server-side pricing
  const skus = body.items.map((i) => i.sku);
  const { data: products } = await admin
    .from('products')
    .select('id, sku, name, price')
    .in('sku', skus)
    .eq('active', true);
  const bySku = new Map((products ?? []).map((p) => [p.sku, p]));

  const lines: { product_id: string; quantity: number; unit_price: number; name: string }[] = [];
  for (const item of body.items) {
    const product = bySku.get(item.sku);
    if (!product) return bad(`Producto no disponible: ${item.sku}`);
    const qty = Math.floor(Number(item.quantity));
    if (!Number.isFinite(qty) || qty <= 0 || qty > 50) return bad(`Cantidad inválida para ${item.sku}`);
    lines.push({ product_id: product.id, quantity: qty, unit_price: product.price, name: product.name });
  }

  const subtotal = Math.round(lines.reduce((s, l) => s + l.unit_price * l.quantity, 0) * 100) / 100;

  let deliveryFee = 0;
  if (body.order_type === 'delivery') {
    const { data: zone } = await admin
      .from('delivery_zones')
      .select('*')
      .eq('id', body.delivery_zone_id!)
      .eq('location_id', location.id)
      .eq('active', true)
      .maybeSingle();
    if (!zone) return bad('Zona de delivery inválida');
    deliveryFee = zone.fee;
  }

  const total = Math.round((subtotal + deliveryFee) * 100) / 100;
  const estimatedMinutes = body.order_type === 'delivery' ? 40 : 25;

  const { data: order, error: orderError } = await admin
    .from('orders')
    .insert({
      location_id: location.id,
      source: body.source,
      order_type: body.order_type,
      status: 'received',
      customer_name: body.customer_name.trim(),
      customer_phone: body.customer_phone.trim(),
      customer_email: body.customer_email?.trim() || null,
      delivery_address: body.order_type === 'delivery' ? body.delivery_address!.trim() : null,
      delivery_zone_id: body.order_type === 'delivery' ? body.delivery_zone_id : null,
      subtotal,
      delivery_fee: deliveryFee,
      total,
      payment_method: body.payment_method,
      payment_status: 'pending',
      estimated_minutes: estimatedMinutes,
      notes: body.notes?.trim() || null,
    })
    .select('id, order_number')
    .single();

  if (orderError || !order) {
    console.error('order insert failed', orderError);
    return bad('No se pudo crear el pedido', 500);
  }

  const { error: itemsError } = await admin.from('order_items').insert(
    lines.map((l) => ({
      order_id: order.id,
      product_id: l.product_id,
      quantity: l.quantity,
      unit_price: l.unit_price,
    })),
  );
  if (itemsError) {
    console.error('items insert failed', itemsError);
    await admin.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
    return bad('No se pudo crear el pedido', 500);
  }

  let paymentUrl: string | null = null;
  if (body.payment_method === 'payment_link') {
    paymentUrl = await createPaymentLink({
      orderId: order.id,
      orderNumber: order.order_number,
      total,
      customerName: body.customer_name,
      customerPhone: body.customer_phone,
    });
    if (!paymentUrl) {
      if (body.source === 'online') {
        // Online payment is mandatory — cancel rather than leave an unpaid order.
        await admin.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
        return bad('No pudimos generar el enlace de pago. Intentá de nuevo.', 502);
      }
      // WhatsApp: fall back to cash so the sale isn't blocked.
      await admin.from('orders').update({ payment_method: 'cash' }).eq('id', order.id);
    }
  }

  return Response.json(
    {
      order_number: order.order_number,
      subtotal,
      delivery_fee: deliveryFee,
      total,
      estimated_minutes: estimatedMinutes,
      payment_url: paymentUrl,
      items: lines.map((l) => ({ name: l.name, quantity: l.quantity, unit_price: l.unit_price })),
    },
    { headers: CORS },
  );
});
