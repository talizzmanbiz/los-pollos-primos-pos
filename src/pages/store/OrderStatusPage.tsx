import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FUNCTIONS_URL } from '../../lib/supabase';
import { money, fmtDateTime } from '../../lib/format';
import ReviewForm from './ReviewForm';

interface StatusResponse {
  order_number: string;
  status: string;
  status_label: string;
  order_type: string;
  total: number;
  estimated_minutes: number | null;
  created_at: string;
  items: { name: string; quantity: number; unit_price: number }[];
  timeline: { status: string; status_label: string; at: string }[];
}

const FLOW = ['received', 'in_progress', 'ready', 'out_for_delivery', 'completed'];
const TERMINAL = ['completed', 'cancelled'];
const LABELS: Record<string, string> = {
  received: 'Recibido',
  in_progress: 'En preparación',
  ready: 'Listo', // refined per order_type below
  out_for_delivery: 'En camino',
  completed: 'Entregado',
};

export default function OrderStatusPage() {
  const [params] = useSearchParams();
  const [phone, setPhone] = useState(params.get('tel') ?? '');
  const [orderNumber, setOrderNumber] = useState((params.get('n') ?? '').toUpperCase());
  const [result, setResult] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = useCallback(
    async (phoneVal: string, numberVal: string, isRefresh = false) => {
      if (!phoneVal || !numberVal) return;
      if (isRefresh) setRefreshing(true);
      else {
        setBusy(true);
        setError(null);
        setResult(null);
      }
      try {
        const res = await fetch(`${FUNCTIONS_URL}/order-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: phoneVal, order_number: numberVal }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (!isRefresh) setError(data.error ?? 'No se encontró el pedido');
        } else {
          setResult(data as StatusResponse);
        }
      } catch {
        if (!isRefresh) setError('Error de conexión');
      }
      if (isRefresh) setRefreshing(false);
      else setBusy(false);
    },
    [],
  );

  // Deep link from "Mis pedidos": /tienda/estado?n=PP-C-0001&tel=7777-8888
  useEffect(() => {
    const n = params.get('n');
    const tel = params.get('tel');
    if (n && tel) fetchStatus(tel, n.toUpperCase());
  }, [params, fetchStatus]);

  // Auto-refresh every 10s while a non-terminal order is on screen.
  useEffect(() => {
    if (!result || TERMINAL.includes(result.status)) return;
    const id = setInterval(() => fetchStatus(phone, orderNumber, true), 10000);
    return () => clearInterval(id);
  }, [result, phone, orderNumber, fetchStatus]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    fetchStatus(phone, orderNumber);
  }

  const steps = result
    ? FLOW.filter((s) => s !== 'out_for_delivery' || result.order_type === 'delivery')
    : [];
  const currentIdx = result ? FLOW.indexOf(result.status) : -1;

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-4 font-display text-3xl font-extrabold text-brand-900">Estado de tu pedido</h1>

      <form onSubmit={onSubmit} className="space-y-3 rounded-3xl bg-white p-6 shadow-[0_10px_40px_rgba(126,50,16,0.07)] ring-1 ring-brand-100">
        <div>
          <label className="mb-1 block text-sm text-gray-600">Número de pedido</label>
          <input
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value.toUpperCase())}
            required
            placeholder="PP-C-0001"
            className="w-full rounded-lg border border-gray-300 px-4 py-3 uppercase"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-600">Teléfono</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            type="tel"
            placeholder="7777-8888"
            className="w-full rounded-lg border border-gray-300 px-4 py-3"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-brand-600 py-3 text-lg font-bold text-white disabled:opacity-50"
        >
          {busy ? 'Buscando…' : 'Consultar'}
        </button>
        {error && <p className="text-center text-red-600">{error}</p>}
      </form>

      {result && (
        <div className="mt-6 rounded-2xl bg-white p-6 shadow">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-bold text-gray-900">{result.order_number}</h2>
            <span className="text-sm text-gray-400">{fmtDateTime(result.created_at)}</span>
          </div>

          {result.status === 'cancelled' ? (
            <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 font-semibold text-red-700">
              Pedido cancelado
            </p>
          ) : (
            <>
              {!TERMINAL.includes(result.status) && result.estimated_minutes != null && (
                <p className="mt-2 text-sm text-gray-500">
                  Tiempo estimado: ~{result.estimated_minutes} min
                  {refreshing && <span className="ml-2 text-brand-500">· actualizando…</span>}
                </p>
              )}

              <ol className="mt-5">
                {steps.map((step, i) => {
                  const stepIdx = FLOW.indexOf(step);
                  const done = stepIdx < currentIdx;
                  const current = stepIdx === currentIdx;
                  const event = result.timeline.find((t) => t.status === step);
                  const label =
                    step === 'ready'
                      ? result.order_type === 'delivery'
                        ? 'Listo para salir'
                        : 'Listo para recoger'
                      : LABELS[step];
                  const isLast = i === steps.length - 1;
                  return (
                    <li key={step} className="flex gap-3">
                      {/* marker + connector */}
                      <div className="flex flex-col items-center">
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                            done
                              ? 'bg-green-600 text-white'
                              : current
                                ? 'bg-brand-600 text-white ring-4 ring-brand-200'
                                : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {done ? '✓' : current ? '●' : '·'}
                        </span>
                        {!isLast && (
                          <span
                            className={`w-0.5 flex-1 ${stepIdx < currentIdx ? 'bg-green-600' : 'bg-gray-200'}`}
                            style={{ minHeight: '1.75rem' }}
                          />
                        )}
                      </div>
                      {/* label */}
                      <div className="pb-4">
                        <p className={done || current ? 'font-semibold text-gray-900' : 'text-gray-400'}>
                          {label}
                        </p>
                        {event && <p className="text-xs text-gray-400">{fmtDateTime(event.at)}</p>}
                        {current && <p className="text-xs font-medium text-brand-600">En curso</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </>
          )}

          <div className="mt-2 border-t border-gray-100 pt-3">
            {result.items.map((item, idx) => (
              <p key={idx} className="text-gray-600">
                {item.quantity} × {item.name}
              </p>
            ))}
            <p className="mt-2 text-lg font-bold text-gray-900">Total {money(result.total)}</p>
          </div>

          {result.status === 'completed' && <ReviewForm orderNumber={result.order_number} />}

          <div className="mt-4 flex gap-2">
            <Link
              to="/tienda"
              className="flex-1 rounded-xl border border-brand-300 py-3 text-center font-semibold text-brand-700"
            >
              Volver al menú
            </Link>
            <Link
              to="/tienda/mis-pedidos"
              className="flex-1 rounded-xl border border-brand-300 py-3 text-center font-semibold text-brand-700"
            >
              Mis pedidos
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
