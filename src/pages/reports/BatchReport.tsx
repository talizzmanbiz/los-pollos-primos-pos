import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { money, fmtDateTime } from '../../lib/format';
import type { Tables } from '../../types/database';

type BatchRow = Tables<'production_batches'> & {
  inputs: (Tables<'production_batch_inputs'> & {
    purchase_batch: { unit_cost: number; supplier_name: string } | null;
  })[];
};

interface BatchStats {
  batch: BatchRow;
  rawCost: number;        // purchase cost allocated to this batch
  costPerChicken: number | null; // rawCost / produced
  sold: number;           // whole-chicken equivalents sold from this batch
}

export default function BatchReport() {
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [soldByBatch, setSoldByBatch] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: batchData } = await supabase
        .from('production_batches')
        .select('*, inputs:production_batch_inputs(*, purchase_batch:purchase_batches(unit_cost, supplier_name))')
        .eq('status', 'closed')
        .order('roast_end_at', { ascending: false })
        .limit(60);
      const rows = (batchData as BatchRow[] | null) ?? [];
      setBatches(rows);

      const ids = rows.map((b) => b.id);
      if (ids.length) {
        const { data: cons } = await supabase
          .from('order_item_batch_consumption')
          .select('production_batch_id, quantity')
          .in('production_batch_id', ids);
        const map = new Map<string, number>();
        for (const c of cons ?? []) {
          map.set(c.production_batch_id, (map.get(c.production_batch_id) ?? 0) + Number(c.quantity));
        }
        setSoldByBatch(map);
      }
      setLoading(false);
    })();
  }, []);

  const stats: BatchStats[] = useMemo(
    () =>
      batches.map((b) => {
        const rawCost = b.inputs.reduce(
          (s, i) => s + Number(i.quantity_consumed) * Number(i.purchase_batch?.unit_cost ?? 0),
          0,
        );
        return {
          batch: b,
          rawCost,
          costPerChicken: b.quantity_produced > 0 ? rawCost / Number(b.quantity_produced) : null,
          sold: soldByBatch.get(b.id) ?? 0,
        };
      }),
    [batches, soldByBatch],
  );

  const totals = useMemo(() => {
    const produced = stats.reduce((s, x) => s + Number(x.batch.quantity_produced), 0);
    const wasted = stats.reduce((s, x) => s + Number(x.batch.quantity_wasted), 0);
    const cost = stats.reduce((s, x) => s + x.rawCost, 0);
    const sold = stats.reduce((s, x) => s + x.sold, 0);
    return {
      produced,
      wasted,
      cost,
      sold,
      avgYield: produced + wasted > 0 ? (produced / (produced + wasted)) * 100 : null,
      avgCostPerChicken: produced > 0 ? cost / produced : null,
      // reconciliation: purchase cost allocated across produced units,
      // applied to what was actually sold
      costOfChickenSold: produced > 0 ? (cost / produced) * sold : null,
    };
  }, [stats]);

  if (loading) return <p className="text-gray-400">Cargando…</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-2xl bg-white p-5 shadow">
          <p className="text-sm text-gray-500">Rendimiento promedio</p>
          <p className="text-3xl font-bold text-gray-900">
            {totals.avgYield != null ? `${totals.avgYield.toFixed(1)}%` : '—'}
          </p>
          <p className="text-xs text-gray-400">{totals.produced} producidos · {totals.wasted} merma</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow">
          <p className="text-sm text-gray-500">Costo por pollo producido</p>
          <p className="text-3xl font-bold text-gray-900">
            {totals.avgCostPerChicken != null ? money(totals.avgCostPerChicken) : '—'}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow">
          <p className="text-sm text-gray-500">Pollos vendidos (equiv.)</p>
          <p className="text-3xl font-bold text-gray-900">{totals.sold.toFixed(2)}</p>
        </div>
        <div className="rounded-2xl bg-white p-5 shadow">
          <p className="text-sm text-gray-500">Costo del pollo vendido</p>
          <p className="text-3xl font-bold text-brand-600">
            {totals.costOfChickenSold != null ? money(totals.costOfChickenSold) : '—'}
          </p>
          <p className="text-xs text-gray-400">costo de compra asignado a unidades vendidas</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow">
        <table className="w-full text-left">
          <thead className="bg-brand-50 text-sm text-gray-600">
            <tr>
              <th className="px-4 py-3">Horneado</th>
              <th className="px-4 py-3 text-right">Producido</th>
              <th className="px-4 py-3 text-right">Merma</th>
              <th className="px-4 py-3 text-right">Rendimiento</th>
              <th className="px-4 py-3 text-right">Costo del lote</th>
              <th className="px-4 py-3 text-right">Costo / pollo</th>
              <th className="px-4 py-3 text-right">Vendidos</th>
              <th className="px-4 py-3">Proveedores</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {stats.map((s) => (
              <tr key={s.batch.id}>
                <td className="px-4 py-3 text-sm">
                  {s.batch.roast_end_at ? fmtDateTime(s.batch.roast_end_at) : '—'}
                </td>
                <td className="px-4 py-3 text-right font-semibold">{s.batch.quantity_produced}</td>
                <td className="px-4 py-3 text-right">{s.batch.quantity_wasted}</td>
                <td className={`px-4 py-3 text-right font-semibold ${
                  (s.batch.yield_percentage ?? 100) < 85 ? 'text-red-600' : 'text-green-700'
                }`}>
                  {s.batch.yield_percentage != null ? `${s.batch.yield_percentage}%` : '—'}
                </td>
                <td className="px-4 py-3 text-right">{money(s.rawCost)}</td>
                <td className="px-4 py-3 text-right">
                  {s.costPerChicken != null ? money(s.costPerChicken) : '—'}
                </td>
                <td className="px-4 py-3 text-right">{s.sold.toFixed(2)}</td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {[...new Set(s.batch.inputs.map((i) => i.purchase_batch?.supplier_name).filter(Boolean))].join(', ')}
                </td>
              </tr>
            ))}
            {stats.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">Sin lotes cerrados todavía</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
