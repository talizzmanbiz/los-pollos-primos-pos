import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { money } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useWorkingLocation } from '../../hooks/useWorkingLocation';
import { useCatalog, type CatalogProduct } from '../../hooks/useCatalog';
import { createOrder, type CartLine, type CustomerInfo } from './createOrder';
import { startOfflineSync, pendingCount } from '../../lib/offlineQueue';
import { buildReceipt, sendToPrinter, getPrinterUrl, setPrinterUrl, type ReceiptData } from '../../lib/webprnt';
import { fmtDateTime } from '../../lib/format';
import PaymentModal from './PaymentModal';

const TYPE_LABELS: Record<string, string> = {
  combo: 'Combos',
  chicken: 'Solo el Pollo',
  extra: 'Extras',
  beverage: 'Bebidas',
};

export default function PosPage() {
  const { profile } = useAuth();
  const { location, loading: locationLoading } = useWorkingLocation();
  const { products, loading, error } = useCatalog();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<CustomerInfo>({ name: '', phone: '', email: '' });
  const [showCustomer, setShowCustomer] = useState(false);
  const [paying, setPaying] = useState(false);
  const [lastOrder, setLastOrder] = useState<{
    orderNumber: string;
    orderId: string | null;
    total: number;
    offline: boolean;
    receipt: ReceiptData;
  } | null>(null);
  const [printMsg, setPrintMsg] = useState<string | null>(null);
  const [showPrinterConfig, setShowPrinterConfig] = useState(false);
  const [printerUrl, setPrinterUrlState] = useState(getPrinterUrl());
  const [hasOpenSession, setHasOpenSession] = useState<boolean | null>(null);
  const [pendingSync, setPendingSync] = useState(0);

  // replay offline sales on reconnect (60s safety-net poll included)
  useEffect(() => {
    const refreshPending = () => pendingCount().then(setPendingSync);
    refreshPending();
    const stop = startOfflineSync(() => refreshPending());
    return stop;
  }, [lastOrder]);

  useEffect(() => {
    if (!location) return;
    supabase
      .from('cash_sessions')
      .select('id')
      .eq('location_id', location.id)
      .eq('status', 'open')
      .limit(1)
      .then(({ data }) => setHasOpenSession((data?.length ?? 0) > 0));
  }, [location, lastOrder]);

  const subtotal = useMemo(
    () => cart.reduce((sum, l) => sum + l.product.price * l.quantity, 0),
    [cart],
  );

  function addToCart(product: CatalogProduct) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.product.id === productId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );
  }

  function clearSale() {
    setCart([]);
    setCustomer({ name: '', phone: '', email: '' });
    setShowCustomer(false);
  }

  async function confirmPayment(cashReceived: number) {
    if (!profile || !location || cart.length === 0) return;
    // guard against a silently-dead session (expired/revoked refresh token):
    // getSession() re-refreshes if needed and returns null when that fails
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) {
      alert('Tu sesión expiró — volvé a iniciar sesión.');
      window.location.href = '/login';
      return;
    }
    const result = await createOrder({
      locationId: location.id,
      isProductionLocation: location.is_production,
      cashierId: profile.id,
      cart,
      customer,
      subtotal,
    });
    setPaying(false);
    if ('error' in result) {
      alert(`No se pudo crear el pedido: ${result.error}`);
      return;
    }
    const orderNumber = 'queued' in result ? result.localRef : result.orderNumber;
    const receipt: ReceiptData = {
      locationName: location.name,
      orderNumber,
      dateTime: fmtDateTime(new Date().toISOString()),
      items: cart.map((l) => ({
        name: l.product.name,
        quantity: l.quantity,
        lineTotal: l.product.price * l.quantity,
      })),
      subtotal,
      total: subtotal,
      cashReceived,
      change: Math.round((cashReceived - subtotal) * 100) / 100,
    };
    setPrintMsg(null);
    setLastOrder({
      orderNumber,
      orderId: 'queued' in result ? null : result.orderId,
      total: subtotal,
      offline: 'queued' in result,
      receipt,
    });
    clearSale();
  }

  if (loading || locationLoading) return <p className="p-6 text-lg">Cargando catálogo…</p>;
  if (error) return <p className="p-6 text-lg text-red-600">{error}</p>;
  if (!location) return <p className="p-6 text-lg text-red-600">Sin sucursal asignada — contactá al administrador.</p>;

  const groups = ['combo', 'chicken', 'extra', 'beverage']
    .map((t) => ({ type: t, items: products.filter((p) => p.product_type === t) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row bg-brand-50">
      {/* watermark background */}
      <div className="absolute inset-0 pointer-events-none opacity-5 flex items-center justify-center overflow-hidden">
        <img
          src="/logo-primos.png"
          alt=""
          className="h-96 w-96 object-contain"
        />
      </div>

      {/* product grid — mobile full width, desktop left panel */}
      <div className="flex-1 overflow-y-auto p-3 lg:p-6 relative z-10 lg:border-r lg:border-brand-100">
        {hasOpenSession === false && (
          <div className="mb-4 glass rounded-lg px-4 py-3 border-gold-400 bg-opacity-60">
            <p className="text-sm font-medium text-brand-700">
              ⚠️ No hay caja abierta — las ventas en efectivo no se registrarán en un turno de caja.
            </p>
          </div>
        )}
        {pendingSync > 0 && (
          <div className="mb-4 glass rounded-lg px-4 py-3 border-gold-400 bg-opacity-60">
            <p className="text-sm font-medium text-brand-800">
              📡 {pendingSync} venta(s) offline pendientes de sincronizar — se enviarán solas al volver la conexión.
            </p>
          </div>
        )}
        <div className="mb-6 flex justify-end">
          <button
            onClick={() => setShowPrinterConfig(true)}
            className="glass-sm px-4 py-2 text-sm font-medium text-charcoal-800 hover:border-brand-400 transition-all"
            title="Configurar impresora"
          >
            🖨️ {getPrinterUrl() ? 'Impresora lista' : 'Configurar impresora'}
          </button>
        </div>
        {groups.map((g) => (
          <section key={g.type} className="mb-6 lg:mb-8">
            <h2 className="mb-2 lg:mb-4 text-base lg:text-xl font-semibold text-brand-700">{TYPE_LABELS[g.type]}</h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
              {g.items.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="glass-sm group flex flex-col items-start justify-between p-2 lg:p-4 text-left transition-all active:scale-95 hover:border-brand-400 min-h-20 lg:min-h-32"
                >
                  <span className="text-xs lg:text-base font-semibold text-charcoal-800 group-hover:text-brand-700 transition-colors line-clamp-2">
                    {p.name}
                  </span>
                  {p.secondary_name && (
                    <span className="text-[10px] lg:text-xs text-gray-500 mt-1 line-clamp-1">{p.secondary_name}</span>
                  )}
                  <span className="mt-1 lg:mt-2 text-sm lg:text-lg font-bold text-brand-700 font-mono">{money(p.price)}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* cart — full width on mobile, sidebar on desktop */}
      <div className="w-full lg:w-96 flex flex-col glass-lg border-t lg:border-t-0 lg:border-l border-brand-100 order-last lg:order-none">
        <div className="flex-1 overflow-y-auto p-3 lg:p-6">
          <h2 className="mb-2 lg:mb-4 text-lg lg:text-2xl font-semibold text-brand-700">Pedido</h2>
          {cart.length === 0 && (
            <p className="text-center text-gray-500 py-4 lg:py-8 text-sm">Tocá un producto para agregarlo</p>
          )}
          {cart.map((l) => (
            <div key={l.product.id} className="mb-2 lg:mb-4 pb-2 lg:pb-4 border-b border-brand-100 last:border-b-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-charcoal-800 truncate text-sm lg:text-base">{l.product.name}</p>
                  <p className="text-[11px] lg:text-xs text-gray-500 mt-0.5">
                    {money(l.product.price)} × {l.quantity} = {money(l.product.price * l.quantity)}
                  </p>
                </div>
                <div className="flex gap-1 lg:gap-2 items-center flex-shrink-0">
                  <button
                    onClick={() => changeQty(l.product.id, -1)}
                    className="h-9 lg:h-10 w-9 lg:w-10 rounded-md bg-brand-50 hover:bg-brand-100 text-base lg:text-lg font-bold text-brand-700 transition-colors active:scale-95 flex items-center justify-center"
                    aria-label={`Reducir cantidad de ${l.product.name}`}
                  >
                    −
                  </button>
                  <span className="w-6 lg:w-8 text-center text-sm lg:text-base font-semibold text-charcoal-800">{l.quantity}</span>
                  <button
                    onClick={() => changeQty(l.product.id, 1)}
                    className="h-9 lg:h-10 w-9 lg:w-10 rounded-md bg-brand-50 hover:bg-brand-100 text-base lg:text-lg font-bold text-brand-700 transition-colors active:scale-95 flex items-center justify-center"
                    aria-label={`Aumentar cantidad de ${l.product.name}`}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* optional customer capture — collapsible on mobile */}
          <button
            onClick={() => setShowCustomer((v) => !v)}
            className="mt-2 lg:mt-4 w-full glass-sm px-2 lg:px-3 py-2 lg:py-3 text-xs lg:text-sm font-medium text-brand-700 hover:border-brand-400 transition-all text-left"
          >
            {showCustomer ? '✕ Ocultar datos' : '+ Datos cliente (opt.)'}
          </button>
          {showCustomer && (
            <div className="mt-2 lg:mt-4 space-y-2 lg:space-y-3">
              <input
                placeholder="Nombre"
                value={customer.name}
                onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                className="w-full glass-sm px-2 lg:px-3 py-2 lg:py-3 text-xs lg:text-sm text-charcoal-800 placeholder:text-gray-500 border border-brand-200 focus:border-brand-500 transition-colors"
                aria-label="Nombre del cliente"
              />
              <input
                placeholder="Teléfono"
                type="tel"
                inputMode="tel"
                value={customer.phone}
                onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                className="w-full glass-sm px-2 lg:px-3 py-2 lg:py-3 text-xs lg:text-sm text-charcoal-800 placeholder:text-gray-500 border border-brand-200 focus:border-brand-500 transition-colors"
                aria-label="Teléfono del cliente"
              />
              <input
                placeholder="Correo"
                type="email"
                value={customer.email}
                onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                className="w-full glass-sm px-2 lg:px-3 py-2 lg:py-3 text-xs lg:text-sm text-charcoal-800 placeholder:text-gray-500 border border-brand-200 focus:border-brand-500 transition-colors"
                aria-label="Correo del cliente"
              />
            </div>
          )}
        </div>

        {/* Total & Payment CTA — sticky on mobile */}
        <div className="sticky bottom-0 z-20 border-t border-brand-100 bg-white/95 p-3 shadow-[0_-4px_20px_rgba(39,26,18,0.08)] backdrop-blur-md space-y-2 lg:space-y-3 lg:p-6">
          <div className="flex justify-between items-baseline">
            <span className="text-xs lg:text-sm font-medium text-charcoal-800">Total</span>
            <span className="text-xl lg:text-2xl font-bold text-brand-700 font-mono">{money(subtotal)}</span>
          </div>
          <button
            disabled={cart.length === 0}
            onClick={() => setPaying(true)}
            className="w-full rounded-xl bg-brand-600 py-3 lg:py-4 text-base lg:text-lg font-bold text-white shadow-lg shadow-brand-600/25 transition-colors hover:bg-brand-700 active:bg-brand-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none min-h-12 lg:min-h-14"
            aria-label={`Cobrar ${money(subtotal)}`}
          >
            💰 Cobrar {subtotal > 0 ? money(subtotal) : ''}
          </button>
          {cart.length > 0 && (
            <button
              onClick={clearSale}
              className="w-full glass-sm py-2 lg:py-3 text-xs lg:text-sm font-medium text-charcoal-800 hover:border-brand-300 transition-all"
              aria-label="Cancelar pedido"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      {paying && (
        <PaymentModal total={subtotal} onConfirm={confirmPayment} onClose={() => setPaying(false)} />
      )}

      {showPrinterConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-2 text-xl font-bold text-gray-900">Impresora de recibos</h3>
            <p className="mb-4 text-sm text-gray-500">
              Star TSP143IIIW por WiFi (WebPRNT). Ingresá la dirección de la impresora en la red
              local, ej. <span className="font-mono">http://192.168.1.50</span>
            </p>
            <input
              value={printerUrl}
              onChange={(e) => setPrinterUrlState(e.target.value)}
              placeholder="http://192.168.1.50"
              className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-3 font-mono"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowPrinterConfig(false)}
                className="flex-1 rounded-xl border border-gray-300 py-3 text-gray-600"
              >
                Volver
              </button>
              <button
                onClick={() => {
                  setPrinterUrl(printerUrl);
                  setShowPrinterConfig(false);
                }}
                className="flex-1 rounded-xl bg-brand-600 py-3 font-bold text-white"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {lastOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
            <p className="text-5xl">{lastOrder.offline ? '📡' : '✅'}</p>
            <h3 className="mt-2 text-2xl font-bold text-gray-900">{lastOrder.orderNumber}</h3>
            <p className="mt-1 text-gray-500">Pedido cobrado: {money(lastOrder.total)}</p>
            {lastOrder.offline && (
              <p className="mt-2 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-800">
                Venta guardada sin conexión — el número de pedido PP se asignará al sincronizar.
              </p>
            )}
            <button
              onClick={async () => {
                setPrintMsg('Imprimiendo…');
                const res = await sendToPrinter(buildReceipt(lastOrder.receipt));
                setPrintMsg(res.ok ? 'Recibo impreso ✓' : (res.error ?? 'Error de impresión'));
              }}
              className="mt-6 w-full rounded-xl border-2 border-brand-600 py-3 text-lg font-semibold text-brand-700 active:bg-brand-50"
            >
              🖨️ Imprimir recibo
            </button>
            {printMsg && <p className="mt-2 text-sm text-gray-500">{printMsg}</p>}
            <button
              onClick={() => setLastOrder(null)}
              className="mt-3 w-full rounded-xl bg-brand-600 py-3 text-lg font-semibold text-white active:bg-brand-700"
            >
              Siguiente pedido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
