import { useState, type FormEvent } from 'react';
import { FUNCTIONS_URL } from '../../lib/supabase';
import { money, fmtDateTime } from '../../lib/format';

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

export default function OrderStatusPage() {
  const [phone, setPhone] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [result, setResult] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function lookup(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${FUNCTIONS_URL}/order-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, order_number: orderNumber }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se encontró el pedido');
      } else {
        setResult(data as StatusResponse);
      }
    } catch {
      setError('Error de conexión');
    }
    setBusy(false);
  }

  const activeSteps = result
    ? result.status === 'cancelled'
      ? []
      : FLOW.slice(0, FLOW.indexOf(result.status) + 1)
    : [];

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-4 text-2xl font-bold text-brand-900">Estado de tu pedido</h1>
      <form onSubmit={lookup} className="space-y-3 rounded-2xl bg-white p-6 shadow">
        <div>
          <label className="mb-1 block text-sm text-gray-600">Número de pedido</label>
          <input
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
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
            <ol className="mt-4 space-y-2">
              {FLOW.filter(
                (s) => s !== 'out_for_delivery' || result.order_type === 'delivery',
              ).map((step) => {
                const done = activeSteps.includes(step);
                const event = result.timeline.find((t) => t.status === step);
                const labels: Record<string, string> = {
                  received: 'Recibido',
                  in_progress: 'En preparación',
                  ready: result.order_type === 'delivery' ? 'Listo para salir' : 'Listo para recoger',
                  out_for_delivery: 'En camino',
                  completed: 'Entregado',
                };
                return (
                  <li key={step} className="flex items-center gap-3">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                        done ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {done ? '✓' : '·'}
                    </span>
                    <span className={done ? 'font-semibold text-gray-900' : 'text-gray-400'}>
                      {labels[step]}
                    </span>
                    {event && <span className="ml-auto text-xs text-gray-400">{fmtDateTime(event.at)}</span>}
                  </li>
                );
              })}
            </ol>
          )}

          <div className="mt-4 border-t border-gray-100 pt-3">
            {result.items.map((i, idx) => (
              <p key={idx} className="text-gray-600">
                {i.quantity} × {i.name}
              </p>
            ))}
            <p className="mt-2 text-lg font-bold text-gray-900">Total {money(result.total)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
