import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useOrdersQueue, setOrderStatus, type QueueOrder } from '../../hooks/useOrdersQueue';
import { useCatalog } from '../../hooks/useCatalog';
import { minutesSince } from '../../lib/format';

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  pos: { label: 'POS', cls: 'bg-gray-200 text-gray-700' },
  online: { label: 'Web', cls: 'bg-blue-100 text-blue-700' },
  whatsapp: { label: 'WhatsApp', cls: 'bg-green-100 text-green-700' },
};

function Ticket({
  order,
  componentsOf,
  onAdvance,
}: {
  order: QueueOrder;
  componentsOf: (productId: string) => { name: string; quantity: number }[];
  onAdvance: (order: QueueOrder) => void;
}) {
  const age = minutesSince(order.created_at);
  const badge = SOURCE_BADGE[order.source];
  const next =
    order.status === 'received'
      ? 'Empezar'
      : order.order_type === 'delivery'
        ? 'Listo p/ enviar'
        : 'Listo';

  return (
    <div
      className={`mb-3 rounded-xl bg-white p-4 shadow ${age > 20 ? 'ring-2 ring-red-400' : ''}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xl font-bold text-gray-900">{order.order_number}</span>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${badge.cls}`}>
            {badge.label}
          </span>
          <span className={`text-sm font-semibold ${age > 20 ? 'text-red-600' : 'text-gray-400'}`}>
            {age} min
          </span>
        </div>
      </div>

      {order.order_type === 'delivery' && (
        <p className="mb-2 rounded bg-purple-50 px-2 py-1 text-sm font-medium text-purple-800">
          🛵 Delivery — {order.delivery_address}
        </p>
      )}
      {order.order_type === 'pickup' && (
        <p className="mb-2 rounded bg-blue-50 px-2 py-1 text-sm font-medium text-blue-800">
          🛍️ Para recoger{order.customer_name ? ` — ${order.customer_name}` : ''}
        </p>
      )}

      <ul className="mb-3">
        {order.order_items.map((item) => {
          const comps = componentsOf(item.product_id);
          return (
            <li key={item.id} className="mb-1">
              <span className="text-lg font-semibold text-gray-900">
                {item.quantity} × {item.product.name}
              </span>
              {comps.length > 0 && (
                <ul className="ml-5 text-sm text-gray-500">
                  {comps.map((c) => (
                    <li key={c.name}>
                      {c.quantity * item.quantity} × {c.name}
                    </li>
                  ))}
                </ul>
              )}
              {item.notes && <p className="ml-5 text-sm italic text-amber-700">“{item.notes}”</p>}
            </li>
          );
        })}
      </ul>
      {order.notes && <p className="mb-3 text-sm italic text-amber-700">Nota: {order.notes}</p>}

      <button
        onClick={() => onAdvance(order)}
        className="w-full rounded-lg bg-brand-600 py-3 text-lg font-bold text-white active:bg-brand-700"
      >
        {next}
      </button>
    </div>
  );
}

export default function KitchenPage() {
  const { location, profile } = useAuth();
  const locationId = location?.id;
  const { orders, loading } = useOrdersQueue(locationId, ['received', 'in_progress']);
  const { products } = useCatalog();
  const [, forceTick] = useState(0);

  // re-render every 30s so the age counters stay honest
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!profile) return null;
  if (!locationId) {
    return (
      <p className="p-6 text-lg text-gray-600">
        La pantalla de cocina es por sucursal — iniciá sesión con una cuenta de Central.
      </p>
    );
  }

  function componentsOf(productId: string) {
    const p = products.find((x) => x.id === productId);
    return (p?.components ?? []).map((c) => ({ name: c.component.name, quantity: c.quantity }));
  }

  async function advance(order: QueueOrder) {
    const next = order.status === 'received' ? 'in_progress' : 'ready';
    await setOrderStatus(order.id, next);
  }

  const received = orders.filter((o) => o.status === 'received');
  const inProgress = orders.filter((o) => o.status === 'in_progress');

  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-cols-2 gap-4 overflow-hidden bg-brand-50 p-4">
      <div className="flex flex-col overflow-hidden">
        <h2 className="mb-3 text-xl font-bold text-brand-900">
          Recibidos <span className="text-brand-500">({received.length})</span>
        </h2>
        <div className="flex-1 overflow-y-auto pr-1">
          {loading && <p className="text-gray-400">Cargando…</p>}
          {received.map((o) => (
            <Ticket key={o.id} order={o} componentsOf={componentsOf} onAdvance={advance} />
          ))}
          {!loading && received.length === 0 && (
            <p className="text-gray-400">Sin pedidos nuevos</p>
          )}
        </div>
      </div>
      <div className="flex flex-col overflow-hidden">
        <h2 className="mb-3 text-xl font-bold text-brand-900">
          En preparación <span className="text-brand-500">({inProgress.length})</span>
        </h2>
        <div className="flex-1 overflow-y-auto pr-1">
          {inProgress.map((o) => (
            <Ticket key={o.id} order={o} componentsOf={componentsOf} onAdvance={advance} />
          ))}
          {!loading && inProgress.length === 0 && (
            <p className="text-gray-400">Nada en preparación</p>
          )}
        </div>
      </div>
    </div>
  );
}
