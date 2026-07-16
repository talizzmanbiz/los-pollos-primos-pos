import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { fmtDateTime } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useWorkingLocation } from '../../hooks/useWorkingLocation';
import type { Tables } from '../../types/database';

type ProductionBatch = Tables<'production_batches'>;
type PurchaseBatch = Tables<'purchase_batches'>;

interface OverrideLine {
  purchaseBatchId: string;
  quantity: string;
}

export default function ProductionBatchesTab() {
  const { profile } = useAuth();
  const { location } = useWorkingLocation();
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [availablePurchases, setAvailablePurchases] = useState<PurchaseBatch[]>([]);
  const [closing, setClosing] = useState<ProductionBatch | null>(null);

  // close form state
  const [produced, setProduced] = useState('');
  const [wasted, setWasted] = useState('0');
  const [rawConsumed, setRawConsumed] = useState('');
  const [manualInputs, setManualInputs] = useState(false);
  const [overrides, setOverrides] = useState<OverrideLine[]>([]);

  const refetch = useCallback(async () => {
    if (!location) return;
    const [pb, pu] = await Promise.all([
      supabase
        .from('production_batches')
        .select('*')
        .eq('location_id', location.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('purchase_batches')
        .select('*')
        .eq('location_id', location.id)
        .gt('quantity_remaining', 0)
        .order('purchase_date'),
    ]);
    setBatches(pb.data ?? []);
    setAvailablePurchases(pu.data ?? []);
  }, [location]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  async function startBatch() {
    if (!location || !profile) return;
    const { error } = await supabase.from('production_batches').insert({
      location_id: location.id,
      marination_start_at: new Date().toISOString(),
      staff_id: profile.id,
    });
    if (error) alert(error.message);
    refetch();
  }

  async function markRoastStart(batch: ProductionBatch) {
    await supabase
      .from('production_batches')
      .update({ roast_start_at: new Date().toISOString() })
      .eq('id', batch.id);
    refetch();
  }

  function openCloseModal(batch: ProductionBatch) {
    setClosing(batch);
    setProduced('');
    setWasted('0');
    setRawConsumed('');
    setManualInputs(false);
    setOverrides(availablePurchases.map((p) => ({ purchaseBatchId: p.id, quantity: '' })));
  }

  async function submitClose(e: FormEvent) {
    e.preventDefault();
    if (!closing) return;
    const inputs = manualInputs
      ? overrides
          .filter((o) => parseFloat(o.quantity) > 0)
          .map((o) => ({ purchase_batch_id: o.purchaseBatchId, quantity: parseFloat(o.quantity) }))
      : null;
    const { error } = await supabase.rpc('close_production_batch', {
      p_batch: closing.id,
      p_quantity_produced: parseFloat(produced),
      p_quantity_wasted: parseFloat(wasted) || 0,
      p_raw_consumed: rawConsumed ? parseFloat(rawConsumed) : undefined,
      p_inputs: inputs ?? undefined,
    });
    if (error) {
      alert(error.message);
      return;
    }
    setClosing(null);
    refetch();
  }

  return (
    <div>
      <button
        onClick={startBatch}
        className="mb-4 rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white active:bg-brand-700"
      >
        + Iniciar lote de producción (marinado)
      </button>

      <div className="overflow-x-auto rounded-2xl bg-white shadow">
        <table className="w-full text-left">
          <thead className="bg-brand-50 text-sm text-gray-600">
            <tr>
              <th className="px-4 py-3">Creado</th>
              <th className="px-4 py-3">Marinado</th>
              <th className="px-4 py-3">Horneado</th>
              <th className="px-4 py-3">Producido</th>
              <th className="px-4 py-3">Merma</th>
              <th className="px-4 py-3">Rendimiento</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {batches.map((b) => (
              <tr key={b.id}>
                <td className="px-4 py-3 text-sm">{fmtDateTime(b.created_at)}</td>
                <td className="px-4 py-3 text-sm">
                  {b.marination_start_at ? fmtDateTime(b.marination_start_at) : '—'}
                </td>
                <td className="px-4 py-3 text-sm">
                  {b.roast_start_at ? fmtDateTime(b.roast_start_at) : '—'}
                </td>
                <td className="px-4 py-3 font-semibold">{b.quantity_produced || '—'}</td>
                <td className="px-4 py-3">{b.quantity_wasted || '—'}</td>
                <td className="px-4 py-3">
                  {b.yield_percentage != null ? `${b.yield_percentage}%` : '—'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      b.status === 'open' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                    }`}
                  >
                    {b.status === 'open' ? 'Abierto' : 'Cerrado'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {b.status === 'open' && !b.roast_start_at && (
                    <button
                      onClick={() => markRoastStart(b)}
                      className="mr-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white"
                    >
                      Al horno
                    </button>
                  )}
                  {b.status === 'open' && (
                    <button
                      onClick={() => openCloseModal(b)}
                      className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white"
                    >
                      Cerrar lote
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {batches.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">Sin lotes de producción</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {closing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={submitClose} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-bold text-gray-900">Cerrar lote de producción</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm text-gray-600">Pollos producidos</label>
                <input type="number" step="0.001" min="0" value={produced} required
                  onChange={(e) => setProduced(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-lg" autoFocus />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Merma (dañados)</label>
                <input type="number" step="0.001" min="0" value={wasted}
                  onChange={(e) => setWasted(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-lg" />
              </div>
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-sm text-gray-600">
                Pollos crudos consumidos (opcional — por defecto producidos + merma)
              </label>
              <input type="number" step="0.001" min="0" value={rawConsumed}
                onChange={(e) => setRawConsumed(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2" />
            </div>

            <label className="mt-4 flex items-center gap-2 text-gray-700">
              <input type="checkbox" checked={manualInputs}
                onChange={(e) => setManualInputs(e.target.checked)} className="h-5 w-5" />
              Elegir lotes de compra manualmente (por defecto: FIFO, el más antiguo primero)
            </label>

            {manualInputs && (
              <div className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-gray-200 p-3">
                {availablePurchases.map((p) => {
                  const line = overrides.find((o) => o.purchaseBatchId === p.id);
                  return (
                    <div key={p.id} className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-sm text-gray-700">
                        {p.supplier_name} · {p.purchase_date} · quedan {p.quantity_remaining}
                      </span>
                      <input type="number" step="0.001" min="0" max={p.quantity_remaining}
                        value={line?.quantity ?? ''} placeholder="0"
                        onChange={(e) =>
                          setOverrides((prev) =>
                            prev.map((o) =>
                              o.purchaseBatchId === p.id ? { ...o, quantity: e.target.value } : o,
                            ),
                          )
                        }
                        className="w-24 rounded-lg border border-gray-300 px-2 py-1" />
                    </div>
                  );
                })}
                {availablePurchases.length === 0 && (
                  <p className="text-sm text-gray-400">No hay lotes de compra con stock</p>
                )}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setClosing(null)}
                className="flex-1 rounded-xl border border-gray-300 py-3 text-gray-600">
                Volver
              </button>
              <button type="submit"
                className="flex-1 rounded-xl bg-brand-600 py-3 font-bold text-white active:bg-brand-700">
                Cerrar lote
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
