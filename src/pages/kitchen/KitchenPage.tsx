import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWorkingLocation } from '../../hooks/useWorkingLocation';
import {
  useOrdersQueue,
  setOrderStatus,
  cancelOrder,
  type QueueOrder,
} from '../../hooks/useOrdersQueue';
import { useCatalog } from '../../hooks/useCatalog';
import { minutesSince, fmtAge, money } from '../../lib/format';

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  pos: { label: 'POS', cls: 'bg-gray-200 text-gray-700' },
  online: { label: 'Web', cls: 'bg-blue-100 text-blue-700' },
  whatsapp: { label: 'WhatsApp', cls: 'bg-green-100 text-green-700' },
};

function Ticket({
  order,
  componentsOf,
  onAdvance,
  onCancel,
}: {
  order: QueueOrder;
  componentsOf: (productId: string) => { name: string; quantity: number }[];
  onAdvance: (order: QueueOrder) => void;
  onCancel: (order: QueueOrder) => void;
}) {
  const age = minutesSince(order.created_at);
  const badge = SOURCE_BADGE[order.source];
  const next =
    order.status === 'received'
      ? 'Empezar'
      : order.order_type === 'delivery'
        ? 'Listo p/ enviar'
        : 'Listo';

  // border, not ring: a ring paints outside the box and the scroll container
  // clips it, so the late-order outline rendered broken along the card edges
  return (
    <div
      className={`mb-2 rounded-xl border-2 bg-white p-2.5 shadow sm:mb-3 sm:p-4 ${
        age > 20 ? 'border-red-400' : 'border-transparent'
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-1 sm:mb-2 sm:gap-2">
        <span className="whitespace-nowrap text-sm font-bold tabular-nums text-gray-900 sm:text-xl">
          {order.order_number}
        </span>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold sm:px-2 sm:py-1 sm:text-xs ${badge.cls}`}
          >
            {badge.label}
          </span>
          <span
            className={`whitespace-nowrap text-[11px] font-semibold tabular-nums sm:text-sm ${age > 20 ? 'text-red-600' : 'text-gray-400'}`}
          >
            {fmtAge(age)}
          </span>
        </div>
      </div>

      {order.order_type === 'delivery' && (
        <p className="mb-1.5 rounded bg-purple-50 px-1.5 py-1 text-[11px] font-medium text-purple-800 sm:mb-2 sm:px-2 sm:text-sm">
          🛵 Delivery — {order.delivery_address}
        </p>
      )}
      {order.order_type === 'pickup' && (
        <p className="mb-1.5 rounded bg-blue-50 px-1.5 py-1 text-[11px] font-medium text-blue-800 sm:mb-2 sm:px-2 sm:text-sm">
          🛍️ Para recoger{order.customer_name ? ` — ${order.customer_name}` : ''}
        </p>
      )}

      <ul className="mb-2 sm:mb-3">
        {order.order_items.map((item) => {
          const comps = componentsOf(item.product_id);
          return (
            <li key={item.id} className="mb-1">
              <span className="text-[13px] font-semibold leading-snug text-gray-900 sm:text-lg">
                {item.quantity} × {item.product.name}
              </span>
              {comps.length > 0 && (
                <ul className="ml-3 text-[11px] leading-snug text-gray-500 sm:ml-5 sm:text-sm">
                  {comps.map((c) => (
                    <li key={c.name}>
                      {c.quantity * item.quantity} × {c.name}
                    </li>
                  ))}
                </ul>
              )}
              {item.notes && (
                <p className="ml-3 text-[11px] italic text-amber-700 sm:ml-5 sm:text-sm">
                  “{item.notes}”
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {order.notes && (
        <p className="mb-2 text-[11px] italic text-amber-700 sm:mb-3 sm:text-sm">
          Nota: {order.notes}
        </p>
      )}

      <button
        onClick={() => onAdvance(order)}
        className="w-full rounded-lg bg-brand-600 py-2 text-sm font-bold text-white active:bg-brand-700 sm:py-3 sm:text-lg"
      >
        {next}
      </button>
      {/* Discreto y sin color de alarma: en una pantalla táctil de cocina el
          botón de avanzar se toca cientos de veces al día y este no debe
          quedar a tiro de un dedo apurado. */}
      <button
        onClick={() => onCancel(order)}
        className="mt-1.5 w-full rounded-lg py-1.5 text-[11px] font-semibold text-gray-400 active:bg-red-50 active:text-red-700 sm:mt-2 sm:text-sm"
      >
        Cancelar pedido
      </button>
    </div>
  );
}

/** Motivos frecuentes: en cocina nadie va a escribir con teclado en pantalla. */
const MOTIVOS = [
  'Producto agotado',
  'El cliente se retiró',
  'Pedido digitado por error',
  'Pedido duplicado',
];

function CancelDialog({
  order,
  onClose,
  onConfirm,
}: {
  order: QueueOrder;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const pagada = order.payment_status === 'paid';
  const conTarjeta = order.payment_method === 'payment_link';

  async function confirm(reason: string) {
    setBusy(true);
    await onConfirm(reason);
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="mb-1 text-lg font-bold text-gray-900">
          Cancelar {order.order_number}
        </h3>

        {pagada && (
          <p
            className={`mb-3 rounded-lg px-3 py-2 text-sm ${
              conTarjeta ? 'bg-amber-50 text-amber-900' : 'bg-blue-50 text-blue-900'
            }`}
          >
            {conTarjeta ? (
              <>
                Pagado con tarjeta ({money(order.total)}). El reembolso <strong>no</strong> es
                automático: quedará pendiente en Caja y hay que anularlo en el panel de Wompi.
              </>
            ) : (
              <>
                Pagado en efectivo ({money(order.total)}). Se descuenta del turno —
                devolvé el dinero al cliente.
              </>
            )}
          </p>
        )}

        <p className="mb-2 text-sm text-gray-500">¿Por qué se cancela?</p>
        <div className="mb-4 grid gap-2">
          {MOTIVOS.map((m) => (
            <button
              key={m}
              disabled={busy}
              onClick={() => confirm(m)}
              className="rounded-lg border border-gray-200 px-3 py-2.5 text-left text-sm font-medium text-gray-800 active:bg-gray-100 disabled:opacity-50"
            >
              {m}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          disabled={busy}
          className="w-full rounded-lg bg-gray-100 py-2.5 text-sm font-semibold text-gray-700 active:bg-gray-200 disabled:opacity-50"
        >
          Volver
        </button>
      </div>
    </div>
  );
}

export default function KitchenPage() {
  const { profile } = useAuth();
  const { location, loading: locationLoading } = useWorkingLocation();
  const locationId = location?.id;
  const { orders, loading } = useOrdersQueue(locationId, ['received', 'in_progress']);
  const { products } = useCatalog();
  const [, forceTick] = useState(0);
  const [cancelling, setCancelling] = useState<QueueOrder | null>(null);

  // re-render every 30s so the age counters stay honest
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!profile) return null;
  if (locationLoading) return <p className="p-6 text-lg text-gray-400">Cargando…</p>;
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

  async function confirmCancel(order: QueueOrder, reason: string) {
    const { error } = await cancelOrder(order.id, reason);
    if (error) {
      alert('No se pudo cancelar: ' + error.message);
      return;
    }
    // La orden sale sola de la cola: el realtime de useOrdersQueue ve el
    // cambio de estado y refetchea.
    setCancelling(null);
  }

  const received = orders.filter((o) => o.status === 'received');
  const inProgress = orders.filter((o) => o.status === 'in_progress');

  return (
    <div className="grid h-full grid-cols-1 gap-2 overflow-hidden bg-brand-50 p-2 sm:grid-cols-2 sm:gap-4 sm:p-4">
      <div className="flex min-h-0 flex-col overflow-hidden">
        <h2 className="mb-1.5 text-sm font-bold text-brand-900 sm:mb-3 sm:text-xl">
          Recibidos <span className="text-brand-500">({received.length})</span>
        </h2>
        <div className="flex-1 overflow-y-auto pr-1">
          {loading && <p className="text-gray-400">Cargando…</p>}
          {received.map((o) => (
            <Ticket
              key={o.id}
              order={o}
              componentsOf={componentsOf}
              onAdvance={advance}
              onCancel={setCancelling}
            />
          ))}
          {!loading && received.length === 0 && (
            <p className="text-gray-400">Sin pedidos nuevos</p>
          )}
        </div>
      </div>
      <div className="flex min-h-0 flex-col overflow-hidden">
        <h2 className="mb-1.5 text-sm font-bold text-brand-900 sm:mb-3 sm:text-xl">
          En preparación <span className="text-brand-500">({inProgress.length})</span>
        </h2>
        <div className="flex-1 overflow-y-auto pr-1">
          {inProgress.map((o) => (
            <Ticket
              key={o.id}
              order={o}
              componentsOf={componentsOf}
              onAdvance={advance}
              onCancel={setCancelling}
            />
          ))}
          {!loading && inProgress.length === 0 && (
            <p className="text-gray-400">Nada en preparación</p>
          )}
        </div>
      </div>

      {cancelling && (
        <CancelDialog
          order={cancelling}
          onClose={() => setCancelling(null)}
          onConfirm={(reason) => confirmCancel(cancelling, reason)}
        />
      )}
    </div>
  );
}
