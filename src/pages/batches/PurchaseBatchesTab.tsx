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
  const total = Math.round((pricedBy === 'libras' ? nPounds : nUnits) * nCost * 100) / 100;
  const avgPerUnit = nUnits > 0 ? total / nUnits : 0;
  const avgPerPound = nPounds > 0 ? total / nPounds : 0;

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
      <button
        onClick={() => setShowForm((v) => !v)}
        className="btn btn-primary mb-4"
      >
        {showForm ? 'Cancelar' : '+ Registrar compra de pollo'}
      </button>

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

          <div className="col-span-2 md:col-span-1">
            <label className="mb-1 block text-sm text-gray-600">Cantidad recibida</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <input type="number" step="0.001" min="0.001" value={units}
                  onChange={(e) => setUnits(e.target.value)} required placeholder="0"
                  className="input" />
                <span className="mt-1 block text-xs text-gray-500">pollos (unidades)</span>
              </div>
              <div className="flex-1">
                <input type="number" step="0.001" min="0.001" value={pounds}
                  onChange={(e) => setPounds(e.target.value)} required placeholder="0"
                  className="input" />
                <span className="mt-1 block text-xs text-gray-500">libras</span>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-600">Costo unitario ($)</label>
            <div className="flex gap-2">
              <input type="number" step="0.0001" min="0" value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)} required
                className="input" />
              <select value={pricedBy} onChange={(e) => setPricedBy(e.target.value as 'unidades' | 'libras')}
                className="rounded-lg border border-gray-300 px-2 py-2">
                <option value="libras">por libra</option>
                <option value="unidades">por unidad</option>
              </select>
            </div>
          </div>

          <div className="col-span-2">
            <label className="mb-1 block text-sm text-gray-600">Notas</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              className="input" />
          </div>

          <div className="col-span-2 flex flex-wrap items-end gap-4 md:col-span-3">
            <p className="text-lg font-semibold text-gray-700">Total: {money(total)}</p>
            <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
              Costo prom. por pollo:{' '}
              <span className="font-bold">{nUnits > 0 ? money(avgPerUnit) : '—'}</span>
              {nPounds > 0 && (
                <span className="text-brand-600"> · por libra: {money(avgPerPound)}</span>
              )}
            </p>
            <button type="submit" className="ml-auto rounded-lg bg-brand-600 px-6 py-3 font-bold text-white active:bg-brand-700">
              Guardar
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl bg-white shadow">
        <table className="w-full text-left text-sm sm:text-base">
          <thead className="bg-brand-50 text-sm text-gray-600">
            <tr>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">Fecha</th>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">Proveedor</th>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">Recibido</th>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">Restante</th>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">Costo unit.</th>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">Costo prom./pollo</th>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">Costo total</th>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">Notas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {batches.map((b) => {
              const perUnit = costPerUnit(b);
              return (
                <tr key={b.id} className={b.quantity_remaining <= 0 ? 'text-gray-400' : ''}>
                  <td className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">{fmtDate(b.purchase_date)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">{b.supplier_name}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">
                    {b.quantity_units ?? b.quantity_received} pollos
                    {b.quantity_lb != null && (
                      <span className="text-gray-500"> · {b.quantity_lb} lb</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold tabular-nums sm:px-4 sm:py-3">{b.quantity_remaining} pollos</td>
                  <td className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">
                    {money(b.unit_cost)}
                    <span className="text-xs text-gray-500">
                      {b.unit === 'libras' ? ' / lb' : ' / unid.'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-brand-700">
                    {perUnit != null ? money(perUnit) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">{money(b.total_cost)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{b.notes}</td>
                </tr>
              );
            })}
            {batches.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">Sin lotes de compra</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
