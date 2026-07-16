import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { money, fmtDate } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useWorkingLocation } from '../../hooks/useWorkingLocation';
import type { Tables } from '../../types/database';

type PurchaseBatch = Tables<'purchase_batches'>;

export default function PurchaseBatchesTab() {
  const { profile } = useAuth();
  const { location } = useWorkingLocation();
  const [batches, setBatches] = useState<PurchaseBatch[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState<'unidades' | 'libras'>('unidades');
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

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!location || !profile) return;
    const { error } = await supabase.from('purchase_batches').insert({
      location_id: location.id,
      supplier_name: supplier.trim(),
      purchase_date: date,
      quantity_received: parseFloat(qty),
      unit,
      unit_cost: parseFloat(unitCost),
      notes: notes.trim() || null,
      created_by: profile.id,
    });
    if (error) {
      alert(error.message);
      return;
    }
    setSupplier('');
    setQty('');
    setUnitCost('');
    setNotes('');
    setShowForm(false);
    refetch();
  }

  return (
    <div>
      <button
        onClick={() => setShowForm((v) => !v)}
        className="mb-4 rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white active:bg-brand-700"
      >
        {showForm ? 'Cancelar' : '+ Registrar compra de pollo'}
      </button>

      {showForm && (
        <form onSubmit={submit} className="mb-6 grid grid-cols-2 gap-4 rounded-2xl bg-white p-6 shadow md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-gray-600">Proveedor</label>
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} required
              className="w-full rounded-lg border border-gray-300 px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">Fecha de compra</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
              className="w-full rounded-lg border border-gray-300 px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">Cantidad recibida</label>
            <div className="flex gap-2">
              <input type="number" step="0.001" min="0.001" value={qty} onChange={(e) => setQty(e.target.value)} required
                className="w-full rounded-lg border border-gray-300 px-3 py-2" />
              <select value={unit} onChange={(e) => setUnit(e.target.value as 'unidades' | 'libras')}
                className="rounded-lg border border-gray-300 px-2 py-2">
                <option value="unidades">unidades</option>
                <option value="libras">libras</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">Costo unitario ($)</label>
            <input type="number" step="0.0001" min="0" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} required
              className="w-full rounded-lg border border-gray-300 px-3 py-2" />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-sm text-gray-600">Notas</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2" />
          </div>
          <div className="flex items-end">
            <p className="mr-4 text-lg font-semibold text-gray-700">
              Total: {money((parseFloat(qty) || 0) * (parseFloat(unitCost) || 0))}
            </p>
            <button type="submit" className="rounded-lg bg-brand-600 px-6 py-3 font-bold text-white active:bg-brand-700">
              Guardar
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl bg-white shadow">
        <table className="w-full text-left">
          <thead className="bg-brand-50 text-sm text-gray-600">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Proveedor</th>
              <th className="px-4 py-3">Recibido</th>
              <th className="px-4 py-3">Restante</th>
              <th className="px-4 py-3">Costo unit.</th>
              <th className="px-4 py-3">Costo total</th>
              <th className="px-4 py-3">Notas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {batches.map((b) => (
              <tr key={b.id} className={b.quantity_remaining <= 0 ? 'text-gray-400' : ''}>
                <td className="px-4 py-3">{fmtDate(b.purchase_date)}</td>
                <td className="px-4 py-3">{b.supplier_name}</td>
                <td className="px-4 py-3">{b.quantity_received} {b.unit}</td>
                <td className="px-4 py-3 font-semibold">{b.quantity_remaining}</td>
                <td className="px-4 py-3">{money(b.unit_cost)}</td>
                <td className="px-4 py-3">{money(b.total_cost)}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{b.notes}</td>
              </tr>
            ))}
            {batches.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">Sin lotes de compra</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
