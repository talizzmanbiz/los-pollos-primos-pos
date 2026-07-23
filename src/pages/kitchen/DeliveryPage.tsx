import { useWorkingLocation } from '../../hooks/useWorkingLocation';
import { useOrdersQueue, setOrderStatus, type QueueOrder } from '../../hooks/useOrdersQueue';
import { minutesSince, money, fmtAge } from '../../lib/format';

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
    <div className="mb-2 rounded-xl bg-white p-2.5 shadow sm:mb-3 sm:p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="whitespace-nowrap text-sm font-bold tabular-nums text-gray-900 sm:text-xl">{order.order_number}</span>
        <span className="whitespace-nowrap text-[11px] tabular-nums text-gray-400 sm:text-sm">{fmtAge(minutesSince(order.created_at))}</span>
      </div>
      <p className="text-[13px] leading-snug text-gray-600 sm:text-base">
        {order.order_items.map((i) => `${i.quantity}× ${i.product.name}`).join(', ')}
      </p>
      {isDelivery && (
        <div className="mt-2 rounded bg-purple-50 px-2 py-1.5 text-[11px] text-purple-900 sm:px-3 sm:py-2 sm:text-sm">
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
        <p className="mt-1 text-[11px] text-blue-700 sm:text-sm">
          Para recoger{order.customer_name ? ` — ${order.customer_name}` : ''}
          {order.payment_status !== 'paid' && (
            <span className="ml-2 font-bold text-red-600">COBRAR {money(order.total)}</span>
          )}
        </p>
      )}
      <button
        onClick={advance}
        className="mt-2 w-full rounded-lg bg-brand-600 py-2 text-sm font-bold text-white active:bg-brand-700 sm:mt-3 sm:py-3 sm:text-lg"
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
    <div className="grid h-full grid-cols-1 gap-2 overflow-hidden bg-brand-50 p-2 sm:grid-cols-2 sm:gap-4 sm:p-4">
      <div className="flex min-h-0 flex-col overflow-hidden">
        <h2 className="mb-1.5 text-sm font-bold text-brand-900 sm:mb-3 sm:text-xl">
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
      <div className="flex min-h-0 flex-col overflow-hidden">
        <h2 className="mb-1.5 text-sm font-bold text-brand-900 sm:mb-3 sm:text-xl">
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
