// Public menu feed: products grouped by type + delivery zones.
// Consumed by the WhatsApp bot (n8n) to render the quick menu, and usable
// by any other channel that needs the live catalog.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const [productsRes, zonesRes, locationsRes] = await Promise.all([
    admin.from('products').select('sku, name, secondary_name, product_type, price').eq('active', true).order('sort_order'),
    admin.from('delivery_zones').select('id, name, fee, location_id').eq('active', true),
    admin.from('locations').select('id, code, name, allows_delivery').eq('active', true),
  ]);

  const products = productsRes.data ?? [];
  const group = (type: string) =>
    products
      .filter((p) => p.product_type === type)
      .map((p) => ({ sku: p.sku, name: p.name, price: p.price }));

  return Response.json(
    {
      combos: group('combo'),
      pollo: group('chicken'),
      extras: group('extra'),
      bebidas: group('beverage'),
      delivery_zones: zonesRes.data ?? [],
      locations: locationsRes.data ?? [],
    },
    { headers: CORS },
  );
});
