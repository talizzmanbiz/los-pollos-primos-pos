import { useWorkingLocation } from '../../hooks/useWorkingLocation';
import { useOrdersQueue, setOrderStatus, type QueueOrder } from '../../hooks/useOrdersQueue';
import { minutesSince, money } from '../../lib/format';

function ReadyCard({ order }: { order: QueueOrder }) {
  const isDelivery = order.order_type === 'delivery';

  async function advance() {
    if (isDelivery && order.status === 'ready') {
      await setOrderStatus(order.id, 'out_for_delivery');
    } else {
      await setOrderStatus(order.id, 'completed');
    }
  }

  const label =
    isDelivery && order.status === 'ready'
      ? '🛵 Salir a entregar'
      : isDelivery
        ? 'Entregado'
        : 'Entregado al cliente';

  return (
    <div className="mb-3 rounded-xl bg-white p-4 shadow">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xl font-bold text-gray-900">{order.order_number}</span>
        <span className="text-sm text-gray-400">{minutesSince(order.created_at)} min</span>
      </div>
      <p className="text-gray-600">
        {order.order_items.map((i) => `${i.quantity}× ${i.product.name}`).join(', ')}
      </p>
      {isDelivery && (
        <div className="mt-2 rounded bg-purple-50 px-3 py-2 text-sm text-purple-900">
          <p className="font-semibold">{order.customer_name ?? 'Cliente'}</p>
          <p>{order.delivery_address}</p>
          {order.customer_phone && <p>📞 {order.customer_phone}</p>}
          <p className="mt-1">
            Total {money(order.total)}
            {order.payment_status !== 'paid' && (
              <span className="ml-2 font-bold text-red-600">COBRAR EN EFECTIVO</span>
            )}
          </p>
        </div>
      )}
      {!isDelivery && order.order_type === 'pickup' && (
        <p className="mt-1 text-sm text-blue-700">
          Para recoger{order.customer_name ? ` — ${order.customer_name}` : ''}
          {order.payment_status !== 'paid' && (
            <span className="ml-2 font-bold text-red-600">COBRAR {money(order.total)}</span>
          )}
        </p>
      )}
      <button
        onClick={advance}
        className="mt-3 w-full rounded-lg bg-brand-600 py-3 text-lg font-bold text-white active:bg-brand-700"
      >
        {label}
      </button>
    </div>
  );
}

export default function DeliveryPage() {
  const { location, loading: locationLoading } = useWorkingLocation();
  const { orders, loading } = useOrdersQueue(location?.id, ['ready', 'out_for_delivery']);

  if (locationLoading) return <p className="p-6 text-lg text-gray-400">Cargando…</p>;
  if (!location) {
    return <p className="p-6 text-lg text-gray-600">Iniciá sesión con una cuenta de sucursal.</p>;
  }

  const ready = orders.filter((o) => o.status === 'ready');
  const enRoute = orders.filter((o) => o.status === 'out_for_delivery');

  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-cols-2 gap-4 overflow-hidden bg-brand-50 p-4">
      <div className="flex flex-col overflow-hidden">
        <h2 className="mb-3 text-xl font-bold text-brand-900">
          Listos <span className="text-brand-500">({ready.length})</span>
        </h2>
        <div className="flex-1 overflow-y-auto pr-1">
          {loading && <p className="text-gray-400">Cargando…</p>}
          {ready.map((o) => (
            <ReadyCard key={o.id} order={o} />
          ))}
          {!loading && ready.length === 0 && <p className="text-gray-400">Nada listo todavía</p>}
        </div>
      </div>
      <div className="flex flex-col overflow-hidden">
        <h2 className="mb-3 text-xl font-bold text-brand-900">
          En camino <span className="text-brand-500">({enRoute.length})</span>
        </h2>
        <div className="flex-1 overflow-y-auto pr-1">
          {enRoute.map((o) => (
            <ReadyCard key={o.id} order={o} />
          ))}
          {!loading && enRoute.length === 0 && <p className="text-gray-400">Sin entregas en camino</p>}
        </div>
      </div>
    </div>
  );
}
