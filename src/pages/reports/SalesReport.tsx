import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { money } from '../../lib/format';
import type { Tables } from '../../types/database';

type OrderRow = Tables<'orders'> & {
  order_items: (Tables<'order_items'> & { product: { name: string } | null })[];
  location: { name: string } | null;
};

const RANGES = [
  { id: 'today', label: 'Hoy', days: 0 },
  { id: '7d', label: '7 días', days: 7 },
  { id: '30d', label: '30 días', days: 30 },
] as const;

const SOURCE_LABELS: Record<string, string> = { pos: 'POS', online: 'Tienda web', whatsapp: 'WhatsApp' };

/** Start of "today" in America/El_Salvador (UTC-6, no DST). */
function salvadorDayStart(daysBack: number): Date {
  const now = new Date();
  const sv = new Date(now.getTime() - 6 * 3600_000);
  sv.setUTCHours(0, 0, 0, 0);
  return new Date(sv.getTime() + 6 * 3600_000 - daysBack * 86400_000);
}

export default function SalesReport() {
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[0]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const since = salvadorDayStart(range.days).toISOString();
    supabase
      .from('orders')
      .select('*, order_items(*, product:products(name)), location:locations(name)')
      .gte('created_at', since)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOrders((data as OrderRow[] | null) ?? []);
        setLoading(false);
      });
  }, [range]);

  const stats = useMemo(() => {
    const revenue = orders.reduce((s, o) => s + Number(o.total), 0);
    const bySource = new Map<string, { count: number; revenue: number }>();
    const byProduct = new Map<string, { quantity: number; revenue: number }>();
    const byLocation = new Map<string, { count: number; revenue: number }>();
    for (const o of orders) {
      const src = bySource.get(o.source) ?? { count: 0, revenue: 0 };
      src.count += 1;
      src.revenue += Number(o.total);
      bySource.set(o.source, src);
      const locName = o.location?.name ?? '?';
      const loc = byLocation.get(locName) ?? { count: 0, revenue: 0 };
      loc.count += 1;
      loc.revenue += Number(o.total);
      byLocation.set(locName, loc);
      for (const item of o.order_items) {
        const name = item.product?.name ?? '?';
        const p = byProduct.get(name) ?? { quantity: 0, revenue: 0 };
        p.quantity += item.quantity;
        p.revenue += Number(item.line_total ?? item.quantity * item.unit_price);
        byProduct.set(name, p);
      }
    }
    return { revenue, bySource, byProduct, byLocation };
  }, [orders]);

  return (
    <div className="space-y-6">
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {RANGES.map((r) => (
          <button
            key={r.id}
            onClick={() => setRange(r)}
            className={`tab ${range.id === r.id ? 'tab-on' : 'tab-off'}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400">Cargando…</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="rounded-2xl bg-white p-3 shadow sm:p-5">
              <p className="text-xs leading-snug text-gray-500 sm:text-sm">Ingresos</p>
              <p className="text-lg font-bold tabular-nums text-brand-600 sm:text-3xl">{money(stats.revenue)}</p>
            </div>
            <div className="rounded-2xl bg-white p-3 shadow sm:p-5">
              <p className="text-xs leading-snug text-gray-500 sm:text-sm">Pedidos</p>
              <p className="text-lg font-bold tabular-nums text-gray-900 sm:text-3xl">{orders.length}</p>
            </div>
            <div className="rounded-2xl bg-white p-3 shadow sm:p-5">
              <p className="text-xs leading-snug text-gray-500 sm:text-sm">Ticket promedio</p>
              <p className="text-lg font-bold tabular-nums text-gray-900 sm:text-3xl">
                {orders.length ? money(stats.revenue / orders.length) : '—'}
              </p>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-4 shadow sm:p-6">
              <h3 className="section-title mb-3">Por canal</h3>
              {[...stats.bySource.entries()].map(([source, s]) => (
                <div key={source} className="mb-2 flex justify-between">
                  <span className="text-gray-600">{SOURCE_LABELS[source] ?? source} ({s.count})</span>
                  <span className="font-semibold">{money(s.revenue)}</span>
                </div>
              ))}
              {stats.bySource.size === 0 && <p className="text-gray-400">Sin ventas en el período</p>}
            </div>
            <div className="rounded-2xl bg-white p-4 shadow sm:p-6">
              <h3 className="section-title mb-3">Por sucursal</h3>
              {[...stats.byLocation.entries()].map(([name, s]) => (
                <div key={name} className="mb-2 flex justify-between">
                  <span className="text-gray-600">{name} ({s.count})</span>
                  <span className="font-semibold">{money(s.revenue)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 shadow sm:p-6">
            <h3 className="section-title mb-3">Productos más vendidos</h3>
            <table className="w-full text-left text-sm sm:text-base">
              <thead className="text-sm text-gray-500">
                <tr><th className="py-2">Producto</th><th className="text-right">Unidades</th><th className="text-right">Ingresos</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...stats.byProduct.entries()]
                  .sort((a, b) => b[1].revenue - a[1].revenue)
                  .map(([name, p]) => (
                    <tr key={name}>
                      <td className="py-2 text-gray-800">{name}</td>
                      <td className="text-right">{p.quantity}</td>
                      <td className="text-right font-semibold">{money(p.revenue)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
