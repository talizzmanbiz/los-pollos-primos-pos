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

/** En qué punto del proceso está el lote, con el paso que sigue. */
function fase(b: ProductionBatch): { texto: string; clase: string } {
  if (b.status !== 'open') return { texto: 'Cerrado', clase: 'bg-green-100 text-green-800' };
  if (!b.roast_start_at) return { texto: 'Marinando', clase: 'bg-blue-100 text-blue-800' };
  return { texto: 'En el horno', clase: 'bg-yellow-100 text-yellow-800' };
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

  // Sin pollo crudo el cierre falla con un error del servidor. Mejor decirlo
  // antes de que el cocinero llene el formulario.
  const crudoDisponible = availablePurchases.reduce(
    (s, p) => s + Number(p.quantity_remaining), 0,
  );

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

  const nProducidos = parseFloat(produced) || 0;
  const nMerma = parseFloat(wasted) || 0;
  const nCrudos = rawConsumed ? parseFloat(rawConsumed) || 0 : nProducidos + nMerma;

  return (
    <div>
      <div className="ayuda mb-4">
        <p className="ayuda-titulo">Paso 2 — marinar, hornear y cerrar</p>
        <p>
          Un lote pasa por tres momentos: <strong>Iniciar</strong> cuando ponés el
          pollo a marinar, <strong>Al horno</strong> cuando lo metés a hornear, y{' '}
          <strong>Cerrar lote</strong> cuando sale y contás cuántos salieron.
        </p>
        <p>
          <strong>Cerrar el lote es lo que mueve el inventario:</strong> descuenta
          el pollo crudo de las compras (el más viejo primero) y mete los pollos
          horneados al inventario para que el POS pueda venderlos.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={startBatch}
          className="btn btn-primary"
        >
          + Iniciar lote (poner a marinar)
        </button>
        <p className="rounded-lg bg-white px-3 py-2 text-sm shadow">
          Pollo crudo disponible:{' '}
          <span className="font-bold tabular-nums text-brand-700">{crudoDisponible}</span>
        </p>
      </div>

      {crudoDisponible === 0 && (
        <p className="ayuda mb-4">
          No hay pollo crudo registrado, así que no vas a poder cerrar un lote.
          Registrá primero la compra en la pestaña <strong>1 · Compra de pollo</strong>.
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl bg-white shadow">
        <table className="w-full min-w-max text-left text-[13px] sm:text-base">
          <thead className="bg-brand-50 text-[12px] text-gray-600 sm:text-sm">
            <tr>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">Creado</th>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">Marinado</th>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">Horneado</th>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">Producido</th>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">Merma</th>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">Rendimiento</th>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">Estado</th>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {batches.map((b) => {
              const f = fase(b);
              return (
                <tr key={b.id}>
                  <td className="whitespace-nowrap px-3 py-2.5 text-sm sm:px-4 sm:py-3">{fmtDateTime(b.created_at)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-sm sm:px-4 sm:py-3">
                    {b.marination_start_at ? fmtDateTime(b.marination_start_at) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-sm sm:px-4 sm:py-3">
                    {b.roast_start_at ? fmtDateTime(b.roast_start_at) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold tabular-nums sm:px-4 sm:py-3">{b.quantity_produced || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">{b.quantity_wasted || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">
                    {b.yield_percentage != null ? `${b.yield_percentage}%` : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${f.clase}`}>
                      {f.texto}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">
                    {/* fixed width + nowrap so both actions render as the same
                        pill; without it the labels wrapped onto two lines and
                        each button ended up a different size */}
                    <div className="flex items-center gap-2">
                      {b.status === 'open' && !b.roast_start_at && (
                        <button
                          onClick={() => markRoastStart(b)}
                          className="btn btn-warm"
                        >
                          Al horno
                        </button>
                      )}
                      {b.status === 'open' && (
                        <button
                          onClick={() => openCloseModal(b)}
                          className="btn btn-primary"
                        >
                          Cerrar lote
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {batches.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                  Sin lotes. Empezá con «Iniciar lote» cuando pongás el pollo a marinar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {closing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={submitClose} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="section-title mb-1">Cerrar lote de producción</h3>
            <p className="mb-4 text-sm text-gray-500">
              Contá los pollos que salieron del horno. Al guardar entran al
              inventario y ya se pueden vender.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div>
                <label className="mb-1 block text-sm text-gray-600">Pollos que salieron bien</label>
                <input type="number" step="0.001" min="0" value={produced} required
                  onChange={(e) => setProduced(e.target.value)}
                  className="input" autoFocus />
                <span className="mt-1 block text-xs text-gray-500">entran al inventario</span>
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Se echaron a perder</label>
                <input type="number" step="0.001" min="0" value={wasted}
                  onChange={(e) => setWasted(e.target.value)}
                  className="input" />
                <span className="mt-1 block text-xs text-gray-500">se descuentan, no se venden</span>
              </div>
            </div>

            {/* La cuenta a la vista: es la unica forma de que el cocinero note
                un dedazo antes de que el inventario quede mal. */}
            <div className="ayuda mt-4">
              <p>
                Se descuentan <strong>{nCrudos}</strong> pollos crudos y entran{' '}
                <strong>{nProducidos}</strong> pollos horneados al inventario.
              </p>
              {nCrudos > crudoDisponible && (
                <p className="font-semibold text-chili-600">
                  Solo hay {crudoDisponible} pollos crudos registrados. Va a fallar
                  al guardar: registrá la compra que falta.
                </p>
              )}
            </div>

            <details className="mt-4 rounded-lg border border-gray-200 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-gray-700">
                Ajustes avanzados
              </summary>

              <div className="mt-3">
                <label className="mb-1 block text-sm text-gray-600">
                  Pollos crudos usados
                </label>
                <input type="number" step="0.001" min="0" value={rawConsumed}
                  onChange={(e) => setRawConsumed(e.target.value)}
                  placeholder={String(nProducidos + nMerma)}
                  className="input" />
                <span className="mt-1 block text-xs text-gray-500">
                  Normalmente es producidos + echados a perder. Cambialo solo si
                  metiste al horno una cantidad distinta.
                </span>
              </div>

              <label className="mt-4 flex items-start gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={manualInputs}
                  onChange={(e) => setManualInputs(e.target.checked)} className="mt-0.5 h-5 w-5" />
                <span>
                  Elegir de qué compras salió el pollo
                  <span className="block text-xs text-gray-500">
                    Por defecto se gasta primero la compra más vieja, que es lo
                    correcto para el costeo. Cambialo solo si usaste otro pollo.
                  </span>
                </span>
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
                          className="input w-24" />
                      </div>
                    );
                  })}
                  {availablePurchases.length === 0 && (
                    <p className="text-sm text-gray-400">No hay compras con pollo disponible</p>
                  )}
                </div>
              )}
            </details>

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
