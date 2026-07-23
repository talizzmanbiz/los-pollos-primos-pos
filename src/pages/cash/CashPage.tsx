import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { money, fmtDateTime, fmtTime } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useWorkingLocation } from '../../hooks/useWorkingLocation';
import type { Tables } from '../../types/database';

type Session = Tables<'cash_sessions'>;
type Movement = Tables<'cash_movements'>;

export default function CashPage() {
  const { profile } = useAuth();
  const { location } = useWorkingLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [history, setHistory] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const [openingAmount, setOpeningAmount] = useState('');
  const [movAmount, setMovAmount] = useState('');
  const [movReason, setMovReason] = useState('');
  const [movType, setMovType] = useState<'in' | 'out'>('out');
  const [countedAmount, setCountedAmount] = useState('');
  const [closing, setClosing] = useState(false);

  const locationId = location?.id;

  const refetch = useCallback(async () => {
    if (!locationId) return;
    const { data: open } = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('location_id', locationId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1);
    const current = open?.[0] ?? null;
    setSession(current);
    if (current) {
      const { data: movs } = await supabase
        .from('cash_movements')
        .select('*')
        .eq('session_id', current.id)
        .order('created_at');
      setMovements(movs ?? []);
    } else {
      setMovements([]);
    }
    const { data: past } = await supabase
      .from('cash_sessions')
      .select('*')
      .eq('location_id', locationId)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .limit(10);
    setHistory(past ?? []);
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  if (!profile) return null;
  if (!locationId) {
    return <p className="p-6 text-lg text-gray-600">La caja es por sucursal — iniciá sesión con una cuenta de sucursal.</p>;
  }
  if (loading) return <p className="p-6 text-lg">Cargando…</p>;

  const expected =
    session != null
      ? session.opening_amount + movements.reduce((s, m) => s + m.amount, 0)
      : 0;

  async function openSession(e: FormEvent) {
    e.preventDefault();
    const amount = parseFloat(openingAmount);
    if (isNaN(amount) || amount < 0) return;
    const { error } = await supabase.from('cash_sessions').insert({
      location_id: locationId!,
      opened_by: profile!.id,
      opening_amount: amount,
    });
    if (error) alert(error.message);
    setOpeningAmount('');
    refetch();
  }

  async function addMovement(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    const amount = parseFloat(movAmount);
    if (isNaN(amount) || amount <= 0 || !movReason.trim()) return;
    const { error } = await supabase.from('cash_movements').insert({
      session_id: session.id,
      amount: movType === 'in' ? amount : -amount,
      reason: movReason.trim(),
      created_by: profile!.id,
    });
    if (error) alert(error.message);
    setMovAmount('');
    setMovReason('');
    refetch();
  }

  async function closeSession(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    const counted = parseFloat(countedAmount);
    if (isNaN(counted) || counted < 0) return;
    const { error } = await supabase.rpc('close_cash_session', {
      p_session: session.id,
      p_counted: counted,
    });
    if (error) alert(error.message);
    setClosing(false);
    setCountedAmount('');
    refetch();
  }

  return (
    <div className="mx-auto max-w-4xl p-4 sm:p-6">
      <h1 className="page-title mb-4">Caja — {location?.name}</h1>

      {!session ? (
        <form onSubmit={openSession} className="rounded-2xl bg-white p-4 sm:p-6 shadow">
          <h2 className="section-title mb-3">Abrir caja</h2>
          <label className="mb-1 block text-gray-600">Monto inicial (efectivo en gaveta)</label>
          <input
            type="number"
            step="0.01"
            min={0}
            value={openingAmount}
            onChange={(e) => setOpeningAmount(e.target.value)}
            required
            className="input mb-4 max-w-xs"
          />
          <button
            type="submit"
            className="btn btn-primary btn-lg"
          >
            Abrir caja
          </button>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-2xl bg-white p-4 shadow">
              <p className="text-sm text-gray-500">Apertura</p>
              <p className="text-2xl font-bold text-gray-900">{money(session.opening_amount)}</p>
              <p className="text-xs text-gray-400">{fmtDateTime(session.opened_at)}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow">
              <p className="text-sm text-gray-500">Movimientos</p>
              <p className="text-2xl font-bold text-gray-900">{movements.length}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow">
              <p className="text-sm text-gray-500">Esperado en gaveta</p>
              <p className="text-2xl font-bold text-green-700">{money(expected)}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-4 sm:p-6 shadow">
            <h2 className="section-title mb-3">Registrar movimiento</h2>
            <form onSubmit={addMovement} className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-sm text-gray-600">Tipo</label>
                <select
                  value={movType}
                  onChange={(e) => setMovType(e.target.value as 'in' | 'out')}
                  className="input"
                >
                  <option value="out">Salida (gasto)</option>
                  <option value="in">Entrada</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Monto</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={movAmount}
                  onChange={(e) => setMovAmount(e.target.value)}
                  required
                  className="input w-32"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-sm text-gray-600">Motivo</label>
                <input
                  value={movReason}
                  onChange={(e) => setMovReason(e.target.value)}
                  required
                  placeholder="ej. compra de gas, cambio"
                  className="input"
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
              >
                Registrar
              </button>
            </form>
          </div>

          <div className="rounded-2xl bg-white p-4 sm:p-6 shadow">
            <h2 className="section-title mb-3">Movimientos del turno</h2>
            {movements.length === 0 && <p className="text-gray-400">Sin movimientos todavía</p>}
            <ul className="divide-y divide-gray-100">
              {movements.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-gray-800">{m.reason}</p>
                    <p className="text-xs text-gray-400">{fmtTime(m.created_at)}</p>
                  </div>
                  <span
                    className={`text-lg font-semibold ${m.amount >= 0 ? 'text-green-700' : 'text-red-600'}`}
                  >
                    {m.amount >= 0 ? '+' : ''}
                    {money(m.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {!closing ? (
            <button
              onClick={() => setClosing(true)}
              className="btn btn-dark btn-lg"
            >
              Cerrar caja
            </button>
          ) : (
            <form onSubmit={closeSession} className="rounded-2xl bg-white p-4 sm:p-6 shadow">
              <h2 className="section-title mb-3">Cierre de caja</h2>
              <p className="mb-3 text-gray-600">
                Esperado: <strong>{money(expected)}</strong> — contá el efectivo y anotá el total real.
              </p>
              <label className="mb-1 block text-sm text-gray-600">Efectivo contado</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={countedAmount}
                onChange={(e) => setCountedAmount(e.target.value)}
                required
                autoFocus
                className="input mb-2 w-48"
              />
              {countedAmount !== '' && (
                <p
                  className={`mb-4 font-semibold ${
                    Math.abs(parseFloat(countedAmount) - expected) < 0.005
                      ? 'text-green-700'
                      : 'text-red-600'
                  }`}
                >
                  Diferencia: {money((parseFloat(countedAmount) || 0) - expected)}
                </p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setClosing(false)}
                  className="btn btn-secondary"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                >
                  Confirmar cierre
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-8 rounded-2xl bg-white p-4 sm:p-6 shadow">
          <h2 className="section-title mb-3">Cierres anteriores</h2>
          <div className="overflow-x-auto">
          <table className="w-full min-w-max text-left text-[13px] sm:text-sm">
            <thead>
              <tr className="text-sm text-gray-500">
                <th className="py-2">Cerrada</th>
                <th>Apertura</th>
                <th>Esperado</th>
                <th>Contado</th>
                <th>Diferencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map((s) => {
                const diff = (s.counted_amount ?? 0) - (s.expected_amount ?? 0);
                return (
                  <tr key={s.id}>
                    <td className="py-2 text-gray-700">{s.closed_at ? fmtDateTime(s.closed_at) : '—'}</td>
                    <td>{money(s.opening_amount)}</td>
                    <td>{s.expected_amount != null ? money(s.expected_amount) : '—'}</td>
                    <td>{s.counted_amount != null ? money(s.counted_amount) : '—'}</td>
                    <td className={diff === 0 ? 'text-green-700' : 'text-red-600'}>{money(diff)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
