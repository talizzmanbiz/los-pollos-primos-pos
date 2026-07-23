import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { fmtDateTime } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import type { Tables } from '../../types/database';

type Transfer = Tables<'transfers'> & {
  items: (Tables<'transfer_items'> & { item: Tables<'inventory_items'> })[];
  from_location: Tables<'locations'>;
  to_location: Tables<'locations'>;
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  in_transit: { label: 'En tránsito', cls: 'bg-yellow-100 text-yellow-800' },
  received: { label: 'Recibida', cls: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelada', cls: 'bg-gray-200 text-gray-600' },
};

export default function TransfersPage() {
  const { profile, location } = useAuth();
  const [locations, setLocations] = useState<Tables<'locations'>[]>([]);
  const [items, setItems] = useState<Tables<'inventory_items'>[]>([]);
  const [stock, setStock] = useState<Record<string, number>>({});
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [toLocation, setToLocation] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  // push model: transfers only leave the production hub
  const [central, setCentral] = useState<Tables<'locations'> | null>(null);

  const refetch = useCallback(async () => {
    const { data: locs } = await supabase.from('locations').select('*').eq('active', true);
    setLocations(locs ?? []);
    const hub = (locs ?? []).find((l) => l.is_production) ?? null;
    setCentral(hub);

    const { data: invItems } = await supabase.from('inventory_items').select('*').order('code');
    setItems(invItems ?? []);

    if (hub) {
      const { data: levels } = await supabase
        .from('inventory_levels')
        .select('inventory_item_id, quantity')
        .eq('location_id', hub.id);
      setStock(Object.fromEntries((levels ?? []).map((l) => [l.inventory_item_id, l.quantity])));
    }

    const { data: trans } = await supabase
      .from('transfers')
      .select(
        '*, items:transfer_items(*, item:inventory_items(*)), from_location:locations!transfers_from_location_id_fkey(*), to_location:locations!transfers_to_location_id_fkey(*)',
      )
      .order('created_at', { ascending: false })
      .limit(30);
    setTransfers((trans as Transfer[] | null) ?? []);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  if (!profile) return null;

  const canCreate =
    profile.role === 'superadmin' || (profile.role === 'admin' && location?.is_production);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!central || !toLocation) return;
    const lines = items
      .filter((i) => parseFloat(quantities[i.id] ?? '') > 0)
      .map((i) => ({ inventory_item_id: i.id, quantity: parseFloat(quantities[i.id]) }));
    if (lines.length === 0) {
      alert('Agregá al menos un artículo');
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc('create_transfer', {
      p_from: central.id,
      p_to: toLocation,
      p_items: lines,
      p_notes: notes.trim() || undefined,
    });
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    setShowForm(false);
    setQuantities({});
    setNotes('');
    refetch();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="page-title">Transferencias entre sucursales</h1>
      <p className="text-gray-600">
        Modelo «push»: {central?.name ?? 'Central'} envía, la sucursal destino confirma la
        recepción desde su pantalla de Inventario.
      </p>

      {canCreate && (
        <button
          onClick={() => setShowForm((v) => !v)}
          className="btn btn-primary"
        >
          {showForm ? 'Cancelar' : '+ Nueva transferencia'}
        </button>
      )}

      {showForm && central && (
        <form onSubmit={submit} className="rounded-2xl bg-white p-6 shadow">
          <div className="mb-4">
            <label className="mb-1 block text-sm text-gray-600">Destino</label>
            <select
              value={toLocation}
              onChange={(e) => setToLocation(e.target.value)}
              required
              className="w-64 rounded-lg border border-gray-300 px-3 py-3"
            >
              <option value="">Elegir sucursal…</option>
              {locations
                .filter((l) => l.id !== central.id)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </select>
          </div>

          <table className="mb-4 w-full text-left">
            <thead className="text-sm text-gray-500">
              <tr>
                <th className="py-2">Artículo</th>
                <th>Disponible en {central.name}</th>
                <th className="w-36">Enviar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((i) => (
                <tr key={i.id}>
                  <td className="py-2 font-medium text-gray-800">{i.name}</td>
                  <td className="text-gray-500">
                    {stock[i.id] ?? 0} {i.unit}
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={quantities[i.id] ?? ''}
                      onChange={(e) => setQuantities({ ...quantities, [i.id]: e.target.value })}
                      placeholder="0"
                      className="w-28 rounded-lg border border-gray-300 px-3 py-2"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <label className="mb-1 block text-sm text-gray-600">Notas</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mb-4 input"
          />

          <button
            type="submit"
            disabled={busy || !toLocation}
            className="rounded-xl bg-brand-600 px-8 py-3 text-lg font-bold text-white active:bg-brand-700 disabled:opacity-40"
          >
            {busy ? 'Enviando…' : 'Enviar transferencia'}
          </button>
        </form>
      )}

      <div className="rounded-2xl bg-white p-6 shadow">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Historial</h2>
        {transfers.length === 0 && <p className="text-gray-400">Sin transferencias</p>}
        {transfers.map((t) => {
          const st = STATUS_LABELS[t.status];
          return (
            <div key={t.id} className="mb-3 rounded-xl border border-gray-100 p-4">
              <div className="mb-1 flex items-center justify-between">
                <p className="font-semibold text-gray-800">
                  {t.from_location.name} → {t.to_location.name}
                </p>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${st.cls}`}>
                  {st.label}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                Enviada {fmtDateTime(t.created_at)}
                {t.received_at ? ` · Recibida ${fmtDateTime(t.received_at)}` : ''}
              </p>
              <ul className="mt-2 ml-5 list-disc text-gray-600">
                {t.items.map((ti) => (
                  <li key={ti.id}>
                    {ti.quantity} {ti.item.unit} de {ti.item.name}
                  </li>
                ))}
              </ul>
              {t.notes && <p className="mt-1 text-sm italic text-gray-500">{t.notes}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
