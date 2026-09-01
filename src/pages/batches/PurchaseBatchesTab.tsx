import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { money, fmtDate } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useWorkingLocation } from '../../hooks/useWorkingLocation';
import type { Tables } from '../../types/database';

type PurchaseBatch = Tables<'purchase_batches'>;

/** Average cost of one whole chicken in a lot. */
function costPerUnit(b: PurchaseBatch): number | null {
  const units = b.quantity_units ?? b.quantity_received;
  if (!units || units <= 0) return null;
  return b.total_cost / units;
}

export default function PurchaseBatchesTab() {
  const { profile } = useAuth();
  const { location } = useWorkingLocation();
  const [batches, setBatches] = useState<PurchaseBatch[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [units, setUnits] = useState(''); // pollos enteros
  const [pounds, setPounds] = useState(''); // libras
  const [pricedBy, setPricedBy] = useState<'unidades' | 'libras'>('libras');
  const [unitCost, setUnitCost] = useState('');
  const [notes, setNotes] = useState('');

  const refetch = useCallback(async () => {
    if (!location) return;
    const { data } = await supabase
      .from('purchase_batches')
      .select('*')
      .eq('location_id', location.id)
      .order('purchase_date', { ascending: false })
      .limit(50);
    setBatches(data ?? []);
  }, [location]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const nUnits = parseFloat(units) || 0;
  const nPounds = parseFloat(pounds) || 0;
  const nCost = parseFloat(unitCost) || 0;
  // The supplier quotes per pound or per chicken; the total follows that unit.
  const porLibra = pricedBy === 'libras';
  const cantidadCobrada = porLibra ? nPounds : nUnits;
  const total = Math.round(cantidadCobrada * nCost * 100) / 100;
  const avgPerUnit = nUnits > 0 ? total / nUnits : 0;
  const avgPerPound = nPounds > 0 ? total / nPounds : 0;

  // Pollo crudo sin procesar, sumando lo que queda de cada lote. Es el numero
  // que decide si se puede cerrar un lote de produccion, asi que se muestra
  // acá y no solo en la columna "Restante" de la tabla.
  const crudoDisponible = batches.reduce((s, b) => s + Number(b.quantity_remaining), 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!location || !profile) return;
    const { error } = await supabase.from('purchase_batches').insert({
      location_id: location.id,
      supplier_name: supplier.trim(),
      purchase_date: date,
      // unidades is the canonical stock quantity (production consumes chickens)
      quantity_units: nUnits,
      quantity_lb: nPounds || null,
      unit: pricedBy,
      unit_cost: nCost,
      notes: notes.trim() || null,
      created_by: profile.id,
    });
    if (error) {
      alert(error.message);
      return;
    }
    setSupplier('');
    setUnits('');
    setPounds('');
    setUnitCost('');
    setNotes('');
    setShowForm(false);
    refetch();
  }

  return (
    <div>
      <div className="ayuda mb-4">
        <p className="ayuda-titulo">Paso 1 — registrar el pollo que llegó</p>
        <p>
          Anotá cada entrega del proveedor apenas llegue. Esto guarda el pollo
          como <strong>crudo disponible</strong> y registra el gasto en la
          contabilidad automáticamente.
        </p>
        <p>
          <strong>Todavía no podés vender ese pollo:</strong> entra al inventario
          hasta que cierres el lote de producción en el paso 2.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="btn btn-primary"
        >
          {showForm ? 'Cancelar' : '+ Registrar compra de pollo'}
        </button>
        <p className="rounded-lg bg-white px-3 py-2 text-sm shadow">
          Pollo crudo disponible:{' '}
          <span className="font-bold tabular-nums text-brand-700">{crudoDisponible}</span>
          <span className="text-charcoal-300"> pollos sin hornear</span>
        </p>
      </div>

      {showForm && (
        <form onSubmit={submit} className="mb-6 grid grid-cols-2 gap-4 rounded-2xl bg-white p-6 shadow md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-gray-600">Proveedor</label>
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} required
              className="input" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">Fecha de compra</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
              className="input" />
          </div>

          {/* Los dos campos existen por razones distintas y el formulario no lo
              decia: las unidades son el stock que consume produccion, las
              libras solo sirven para sacar el costo por libra. */}
          <div className="col-span-2 md:col-span-1">
            <label className="mb-1 block text-sm text-gray-600">Cantidad recibida</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <input type="number" step="0.001" min="0.001" value={units}
                  onChange={(e) => setUnits(e.target.value)} required placeholder="0"
                  className="input" />
                <span className="mt-1 block text-xs text-gray-500">
                  pollos — <span className="text-brand-700">es el stock</span>
                </span>
              </div>
              <div className="flex-1">
                <input type="number" step="0.001" min="0.001" value={pounds}
                  onChange={(e) => setPounds(e.target.value)} required={porLibra} placeholder="0"
                  className="input" />
                <span className="mt-1 block text-xs text-gray-500">
                  libras — {porLibra ? 'para el cobro' : 'opcional'}
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-600">¿Cómo te lo cobraron?</label>
            <div className="flex gap-2">
              <select value={pricedBy} onChange={(e) => setPricedBy(e.target.value as 'unidades' | 'libras')}
                className="input">
                <option value="libras">por libra</option>
                <option value="unidades">por pollo</option>
              </select>
              <input type="number" step="0.0001" min="0" value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)} required placeholder="0.00"
                className="input" />
            </div>
            <span className="mt-1 block text-xs text-gray-500">
              precio {porLibra ? 'por libra' : 'por pollo'}
            </span>
          </div>

          <div className="col-span-2">
            <label className="mb-1 block text-sm text-gray-600">Notas</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              className="input" />
          </div>

          {/* La cuenta a la vista: antes salia solo el total y no se veia de
              donde, asi que un precio metido en la casilla equivocada pasaba
              desapercibido hasta revisar el gasto. */}
          <div className="col-span-2 flex flex-wrap items-end gap-4 md:col-span-3">
            <div>
              <p className="text-sm text-gray-500 tabular-nums">
                {cantidadCobrada || 0} {porLibra ? 'lb' : 'pollos'} × {money(nCost)} =
              </p>
              <p className="text-lg font-semibold text-gray-700">Total: {money(total)}</p>
            </div>
            <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
              Costo prom. por pollo:{' '}
              <span className="font-bold">{nUnits > 0 ? money(avgPerUnit) : '—'}</span>
              {nPounds > 0 && (
                <span className="text-brand-600"> · por libra: {money(avgPerPound)}</span>
              )}
            </p>
            <button type="submit" className="btn btn-primary ml-auto">
              Guardar
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl bg-white shadow">
        <table className="w-full min-w-max text-left text-[13px] sm:text-base">
          <thead className="bg-brand-50 text-[12px] text-gray-600 sm:text-sm">
            <tr>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">Fecha</th>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">Proveedor</th>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">Recibido</th>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">Sin hornear</th>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">Costo unit.</th>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">Costo prom./pollo</th>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">Costo total</th>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">Notas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {batches.map((b) => {
              const perUnit = costPerUnit(b);
              const agotado = b.quantity_remaining <= 0;
              return (
                <tr key={b.id} className={agotado ? 'text-gray-400' : ''}>
                  <td className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">{fmtDate(b.purchase_date)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">{b.supplier_name}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">
                    {b.quantity_units ?? b.quantity_received} pollos
                    {b.quantity_lb != null && (
                      <span className="text-gray-500"> · {b.quantity_lb} lb</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold tabular-nums sm:px-4 sm:py-3">
                    {agotado
                      ? <span className="text-gray-400">todo horneado</span>
                      : <>{b.quantity_remaining} pollos</>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">
                    {money(b.unit_cost)}
                    <span className="text-xs text-gray-500">
                      {b.unit === 'libras' ? ' / lb' : ' / pollo'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-brand-700 sm:px-4 sm:py-3">
                    {perUnit != null ? money(perUnit) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">{money(b.total_cost)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-sm text-gray-500 sm:px-4 sm:py-3">{b.notes}</td>
                </tr>
              );
            })}
            {batches.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                  Todavía no hay compras registradas. Empezá con «Registrar compra de pollo».
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
