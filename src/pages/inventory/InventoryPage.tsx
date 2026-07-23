import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { fmtDateTime } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useWorkingLocation } from '../../hooks/useWorkingLocation';
import type { Tables } from '../../types/database';

type Level = Tables<'inventory_levels'> & { item: Tables<'inventory_items'> };
type Movement = Tables<'inventory_movements'> & { item: Tables<'inventory_items'> };
type Transfer = Tables<'transfers'> & {
  items: (Tables<'transfer_items'> & { item: Tables<'inventory_items'> })[];
  from_location: Tables<'locations'>;
};

const REASON_LABELS: Record<string, string> = {
  sale: 'Venta',
  cancellation: 'Cancelación',
  production: 'Producción',
  purchase: 'Compra',
  transfer_out: 'Transferencia (salida)',
  transfer_in: 'Transferencia (entrada)',
  adjustment: 'Ajuste',
  waste: 'Merma',
  initial: 'Inicial',
};

export default function InventoryPage() {
  const { profile } = useAuth();
  const { location } = useWorkingLocation();
  const [items, setItems] = useState<Tables<'inventory_items'>[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [incoming, setIncoming] = useState<Transfer[]>([]);
  const [adjusting, setAdjusting] = useState<{ itemId: string; name: string; current: number } | null>(null);
  const [newQty, setNewQty] = useState('');
  const [adjustNote, setAdjustNote] = useState('');

  const canAdjust = profile?.role === 'superadmin' || profile?.role === 'admin';

  const refetch = useCallback(async () => {
    if (!location) return;
    const [itemsRes, levelsRes, movsRes, transfersRes] = await Promise.all([
      supabase.from('inventory_items').select('*').order('code'),
      supabase
        .from('inventory_levels')
        .select('*, item:inventory_items(*)')
        .eq('location_id', location.id),
      supabase
        .from('inventory_movements')
        .select('*, item:inventory_items(*)')
        .eq('location_id', location.id)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('transfers')
        .select('*, items:transfer_items(*, item:inventory_items(*)), from_location:locations!transfers_from_location_id_fkey(*)')
        .eq('to_location_id', location.id)
        .eq('status', 'in_transit'),
    ]);
    setItems(itemsRes.data ?? []);
    setLevels((levelsRes.data as Level[] | null) ?? []);
    setMovements((movsRes.data as Movement[] | null) ?? []);
    setIncoming((transfersRes.data as Transfer[] | null) ?? []);
  }, [location]);

  useEffect(() => {
    refetch();
    if (!location) return;
    const channel = supabase
      .channel(`inv-${location.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transfers', filter: `to_location_id=eq.${location.id}` },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [location, refetch]);

  if (!location) return <p className="p-6 text-lg">Cargando…</p>;

  const levelOf = (itemId: string) => levels.find((l) => l.inventory_item_id === itemId)?.quantity ?? 0;

  async function receiveTransfer(id: string) {
    const { error } = await supabase.rpc('receive_transfer', { p_transfer: id });
    if (error) alert(error.message);
    refetch();
  }

  async function submitAdjust(e: FormEvent) {
    e.preventDefault();
    if (!adjusting) return;
    const { error } = await supabase.rpc('adjust_inventory', {
      p_location: location!.id,
      p_item: adjusting.itemId,
      p_new_quantity: parseFloat(newQty),
      p_notes: adjustNote.trim() || 'Ajuste manual',
    });
    if (error) alert(error.message);
    setAdjusting(null);
    refetch();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <h1 className="page-title">Inventario — {location.name}</h1>

      {incoming.length > 0 && (
        <div className="rounded-2xl border-2 border-blue-300 bg-blue-50 p-4 sm:p-6">
          <h2 className="section-title mb-3 text-blue-900">
            📦 Transferencias por recibir ({incoming.length})
          </h2>
          {incoming.map((t) => (
            <div key={t.id} className="mb-3 rounded-xl bg-white p-4 shadow">
              <p className="font-semibold text-gray-800">
                Desde {t.from_location.name} — {fmtDateTime(t.created_at)}
              </p>
              <ul className="my-2 ml-5 list-disc text-gray-600">
                {t.items.map((ti) => (
                  <li key={ti.id}>
                    {ti.quantity} {ti.item.unit} de {ti.item.name}
                  </li>
                ))}
              </ul>
              {t.notes && <p className="mb-2 text-sm italic text-gray-500">{t.notes}</p>}
              <button
                onClick={() => receiveTransfer(t.id)}
                className="btn btn-primary"
              >
                Confirmar recepción
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl bg-white p-4 sm:p-6 shadow">
        <h2 className="section-title mb-3">Existencias</h2>
        <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-max text-left text-[13px] sm:text-base">
          <thead className="text-[12px] text-gray-500 sm:text-sm">
            <tr>
              <th className="py-2">Artículo</th>
              <th>Unidad</th>
              <th className="text-right">Cantidad</th>
              {canAdjust && <th></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => {
              const qty = levelOf(item.id);
              return (
                <tr key={item.id}>
                  <td className="py-3 pr-2 font-medium leading-snug text-gray-800">{item.name}</td>
                  <td className="pr-2 text-xs leading-snug text-gray-500 sm:text-sm">{item.unit}</td>
                  <td className={`whitespace-nowrap px-2 text-right text-base font-bold tabular-nums sm:text-lg ${qty < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {qty}
                  </td>
                  {canAdjust && (
                    <td className="text-right">
                      <button
                        onClick={() => {
                          setAdjusting({ itemId: item.id, name: item.name, current: qty });
                          setNewQty(String(qty));
                          setAdjustNote('');
                        }}
                        className="btn btn-secondary btn-sm"
                      >
                        Ajustar
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 sm:p-6 shadow">
        <h2 className="section-title mb-3">Últimos movimientos</h2>
        {movements.length === 0 && <p className="text-gray-400">Sin movimientos</p>}
        <ul className="divide-y divide-gray-100">
          {movements.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-[13px] leading-snug text-gray-800 sm:text-base">
                  {m.item.name} — {REASON_LABELS[m.reason] ?? m.reason}
                  {m.notes ? ` · ${m.notes}` : ''}
                </p>
                <p className="text-xs text-gray-400">{fmtDateTime(m.created_at)}</p>
              </div>
              <span className={`ml-2 shrink-0 whitespace-nowrap font-semibold tabular-nums ${m.delta >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {m.delta >= 0 ? '+' : ''}
                {m.delta}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {adjusting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={submitAdjust} className="w-full max-w-sm rounded-2xl bg-white p-4 sm:p-6 shadow-xl">
            <h3 className="mb-2 text-xl font-bold text-gray-900">Ajustar {adjusting.name}</h3>
            <p className="mb-4 text-gray-500">Cantidad actual: {adjusting.current}</p>
            <label className="mb-1 block text-sm text-gray-600">Nueva cantidad (conteo físico)</label>
            <input type="number" step="0.001" value={newQty} required autoFocus
              onChange={(e) => setNewQty(e.target.value)}
              className="input mb-3" />
            <label className="mb-1 block text-sm text-gray-600">Motivo</label>
            <input value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)}
              placeholder="ej. conteo físico semanal"
              className="input mb-4" />
            <div className="flex gap-3">
              <button type="button" onClick={() => setAdjusting(null)}
                className="flex-1 rounded-xl border border-gray-300 py-3 text-gray-600">
                Volver
              </button>
              <button type="submit"
                className="flex-1 rounded-xl bg-brand-600 py-3 font-bold text-white active:bg-brand-700">
                Guardar ajuste
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
