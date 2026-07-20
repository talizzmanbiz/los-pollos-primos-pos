import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { money, fmtDateTime } from '../../lib/format';
import { saveCart } from './storeCart';
import { loadHistory, type PastOrder } from './orderHistory';

export default function MyOrdersPage() {
  const navigate = useNavigate();
  const [orders] = useState<PastOrder[]>(loadHistory);

  function repeat(order: PastOrder) {
    saveCart(order.lines);
    navigate('/tienda');
  }

  if (orders.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-6xl">🧾</p>
        <h1 className="mt-3 font-display text-2xl font-extrabold text-brand-900">Aún no tenés pedidos</h1>
        <p className="mt-2 text-gray-600">
          Los pedidos que hagas en este dispositivo aparecerán acá para repetirlos con un toque.
        </p>
        <Link
          to="/tienda"
          className="mt-6 inline-block rounded-xl bg-brand-600 px-8 py-3 font-bold text-white"
        >
          Ver el menú
        </Link>
        <p className="mt-6 text-sm text-gray-500">
          ¿Pediste en otro dispositivo?{' '}
          <Link to="/tienda/estado" className="text-brand-600 underline">Buscá por teléfono y número</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-1 font-display text-3xl font-extrabold text-brand-900">Mis pedidos</h1>
      <p className="mb-5 text-sm text-charcoal-700/60">Pedidos hechos en este dispositivo.</p>

      <div className="space-y-4">
        {orders.map((o) => (
          <div key={o.order_number} className="rounded-3xl bg-white p-5 shadow-[0_10px_40px_rgba(126,50,16,0.07)] ring-1 ring-brand-100">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-bold text-brand-700">{o.order_number}</h2>
              <span className="text-sm text-gray-400">{fmtDateTime(o.placed_at)}</span>
            </div>
            <p className="text-sm text-gray-500">{o.mode === 'delivery' ? '🛵 Delivery' : '🛍️ Recoger'}</p>

            <div className="mt-3 border-t border-gray-100 pt-3">
              {o.lines.map((l) => (
                <p key={l.sku} className="text-gray-600">
                  {l.quantity} × {l.name}
                </p>
              ))}
              <p className="mt-2 font-bold text-gray-900">Total {money(o.total)}</p>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => repeat(o)}
                className="flex-1 rounded-xl bg-brand-600 py-3 font-semibold text-white active:bg-brand-700"
              >
                🔁 Repetir pedido
              </button>
              <Link
                to={`/tienda/estado?n=${encodeURIComponent(o.order_number)}&tel=${encodeURIComponent(o.phone)}`}
                className="flex-1 rounded-xl border border-brand-300 py-3 text-center font-semibold text-brand-700"
              >
                Ver estado
              </Link>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-sm text-gray-500">
        ¿Pediste en otro dispositivo?{' '}
        <Link to="/tienda/estado" className="text-brand-600 underline">Buscá por teléfono y número</Link>.
      </p>
    </div>
  );
}
