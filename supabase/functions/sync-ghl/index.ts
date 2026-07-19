// syncContactToGoHighLevel(order): upserts the customer into GoHighLevel on
// order completion, keyed by phone number (dedup). Pushes running spend,
// last order date, order count and favorite item as custom fields when the
// field IDs are configured. Never enrolls contacts into campaigns/workflows —
// that stays a manual step inside GoHighLevel.
//
// Secrets (Dashboard → Edge Functions → Secrets):
//   GHL_API_KEY       Private integration token (Bearer)
//   GHL_LOCATION_ID   GoHighLevel sub-account/location id
//   GHL_CF_TOTAL_SPENT / GHL_CF_LAST_ORDER / GHL_CF_ORDER_COUNT / GHL_CF_FAVORITE_ITEM
//                     optional custom-field IDs; skipped when unset
//
// Called by a pg_net database trigger with { order_id }. Idempotent: safe to
// re-run for the same order.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const GHL_BASE = 'https://services.leadconnectorhq.com';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Método no permitido' }, { status: 405 });
  }

  let body: { order_id?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!body.order_id) return Response.json({ error: 'Falta order_id' }, { status: 400 });

  const apiKey = Deno.env.get('GHL_API_KEY');
  const locationId = Deno.env.get('GHL_LOCATION_ID');
  if (!apiKey || !locationId) {
    // GHL not wired up yet — succeed quietly so orders are never affected
    return Response.json({ skipped: 'GHL_API_KEY / GHL_LOCATION_ID no configurados' });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: order } = await admin
    .from('orders')
    .select('id, status, payment_status, customer_name, customer_phone, customer_email')
    .eq('id', body.order_id)
    .maybeSingle();

  if (!order) return Response.json({ error: 'Pedido no encontrado' }, { status: 404 });
  if (order.status === 'cancelled') return Response.json({ skipped: 'pedido cancelado' });
  // Sync as soon as the customer has committed: an online order that is PAID
  // counts even before the kitchen marks it completed, otherwise a paying
  // customer never reaches the CRM until staff close the order.
  if (order.status !== 'completed' && order.payment_status !== 'paid') {
    return Response.json({ skipped: 'pedido ni pagado ni completado' });
  }
  // POS walk-ins without contact info: best-effort capture, never blocks the sale
  if (!order.customer_phone) return Response.json({ skipped: 'sin teléfono' });

  const digits = order.customer_phone.replace(/\D/g, '');
  const phoneE164 = digits.startsWith('503') ? `+${digits}` : `+503${digits}`;

  // Order history across every source for this phone (last 8 digits match).
  // Revenue counts an order once it is paid OR completed, never when cancelled —
  // so the CRM stats are right whether the sync runs at payment or at handover.
  const { data: history } = await admin
    .from('orders')
    .select('total, created_at, customer_phone, order_items(quantity, product:products(name))')
    .neq('status', 'cancelled')
    .or('status.eq.completed,payment_status.eq.paid')
    .not('customer_phone', 'is', null);

  const tail = digits.slice(-8);
  const mine = (history ?? []).filter((o) => (o.customer_phone ?? '').replace(/\D/g, '').endsWith(tail));

  const totalSpent = Math.round(mine.reduce((s, o) => s + Number(o.total), 0) * 100) / 100;
  const lastOrderAt = mine.reduce<string | null>(
    (last, o) => (!last || o.created_at > last ? o.created_at : last),
    null,
  );
  const itemCounts = new Map<string, number>();
  for (const o of mine) {
    for (const item of o.order_items ?? []) {
      const name = (item.product as { name: string } | null)?.name;
      if (name) itemCounts.set(name, (itemCounts.get(name) ?? 0) + item.quantity);
    }
  }
  const favoriteItem = [...itemCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const customFields: { id: string; value: string }[] = [];
  const cf = (envKey: string, value: string | null) => {
    const id = Deno.env.get(envKey);
    if (id && value != null) customFields.push({ id, value });
  };
  cf('GHL_CF_TOTAL_SPENT', totalSpent.toFixed(2));
  cf('GHL_CF_LAST_ORDER', lastOrderAt ? lastOrderAt.slice(0, 10) : null);
  cf('GHL_CF_ORDER_COUNT', String(mine.length));
  cf('GHL_CF_FAVORITE_ITEM', favoriteItem);

  const upsertBody: Record<string, unknown> = {
    locationId,
    name: order.customer_name ?? undefined,
    phone: phoneE164,
    email: order.customer_email ?? undefined,
    tags: ['los-pollos-primos'],
    source: 'Los Pollos Primos POS',
  };
  if (customFields.length > 0) upsertBody.customFields = customFields;

  const ghlRes = await fetch(`${GHL_BASE}/contacts/upsert`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: '2021-07-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(upsertBody),
  });

  if (!ghlRes.ok) {
    const detail = await ghlRes.text();
    console.error('GHL upsert failed', ghlRes.status, detail);
    return Response.json({ error: 'GHL upsert falló', status: ghlRes.status }, { status: 502 });
  }

  await admin.from('orders').update({ ghl_synced_at: new Date().toISOString() }).eq('id', order.id);

  return Response.json({
    synced: true,
    phone: phoneE164,
    total_spent: totalSpent,
    order_count: mine.length,
    favorite_item: favoriteItem,
  });
});
