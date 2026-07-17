import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { money } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
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
  const { profile, location } = useAuth();
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

  if (loading) return <p className="p-6 text-lg">Cargando catálogo…</p>;
  if (error) return <p className="p-6 text-lg text-red-600">{error}</p>;

  const groups = ['combo', 'chicken', 'extra', 'beverage']
    .map((t) => ({ type: t, items: products.filter((p) => p.product_type === t) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="relative flex h-[calc(100vh-3.5rem)]">
      {/* watermark background */}
      <div className="absolute inset-0 pointer-events-none opacity-5 flex items-center justify-center overflow-hidden">
        <img
          src="/logo-primos.png"
          alt=""
          className="h-96 w-96 object-contain"
        />
      </div>

      {/* product grid */}
      <div className="flex-1 overflow-y-auto p-4 relative z-10">
        {hasOpenSession === false && (
          <div className="mb-4 rounded-lg bg-yellow-100 px-4 py-3 text-yellow-900">
            No hay caja abierta — las ventas en efectivo no se registrarán en un turno de caja.
          </div>
        )}
        {pendingSync > 0 && (
          <div className="mb-4 rounded-lg bg-orange-100 px-4 py-3 text-orange-900">
            📡 {pendingSync} venta(s) offline pendientes de sincronizar — se enviarán solas al
            volver la conexión.
          </div>
        )}
        <div className="mb-2 flex justify-end">
          <button
            onClick={() => setShowPrinterConfig(true)}
            className="rounded-lg bg-white px-3 py-2 text-sm text-gray-500 shadow"
            title="Configurar impresora"
          >
            🖨️ {getPrinterUrl() ? 'Impresora lista' : 'Configurar impresora'}
          </button>
        </div>
        {groups.map((g) => (
          <section key={g.type} className="mb-6">
            <h2 className="mb-3 text-lg font-bold text-brand-900">{TYPE_LABELS[g.type]}</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {g.items.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="flex min-h-24 flex-col items-start justify-between rounded-xl bg-white p-4 text-left shadow active:scale-95 active:bg-brand-100"
                >
                  <span className="text-lg font-semibold text-gray-900">{p.name}</span>
                  {p.secondary_name && (
                    <span className="text-sm text-gray-400">{p.secondary_name}</span>
                  )}
                  <span className="mt-1 text-lg font-bold text-brand-600">{money(p.price)}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* cart */}
      <div className="flex w-96 flex-col border-l border-brand-200 bg-white">
        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="mb-3 text-lg font-bold text-brand-900">Pedido</h2>
          {cart.length === 0 && <p className="text-gray-400">Tocá un producto para agregarlo</p>}
          {cart.map((l) => (
            <div key={l.product.id} className="mb-3 flex items-center gap-2">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{l.product.name}</p>
                <p className="text-sm text-gray-500">
                  {money(l.product.price)} × {l.quantity} = {money(l.product.price * l.quantity)}
                </p>
              </div>
              <button
                onClick={() => changeQty(l.product.id, -1)}
                className="h-12 w-12 rounded-lg bg-gray-100 text-xl font-bold active:bg-gray-200"
              >
                −
              </button>
              <span className="w-8 text-center text-lg font-semibold">{l.quantity}</span>
              <button
                onClick={() => changeQty(l.product.id, 1)}
                className="h-12 w-12 rounded-lg bg-gray-100 text-xl font-bold active:bg-gray-200"
              >
                +
              </button>
            </div>
          ))}

          {/* optional customer capture — never blocks the sale */}
          <button
            onClick={() => setShowCustomer((v) => !v)}
            className="mt-2 w-full rounded-lg border border-dashed border-brand-300 px-3 py-2 text-brand-700"
          >
            {showCustomer ? 'Ocultar datos del cliente' : '+ Datos del cliente (opcional)'}
          </button>
          {showCustomer && (
            <div className="mt-3 space-y-2">
              <input
                placeholder="Nombre"
                value={customer.name}
                onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
              <input
                placeholder="Teléfono"
                type="tel"
                value={customer.phone}
                onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
              <input
                placeholder="Correo"
                type="email"
                value={customer.email}
                onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
          )}
        </div>

        <div className="border-t border-brand-100 p-4">
          <div className="mb-3 flex justify-between text-xl font-bold text-gray-900">
            <span>Total</span>
            <span>{money(subtotal)}</span>
          </div>
          <button
            disabled={cart.length === 0}
            onClick={() => setPaying(true)}
            className="w-full rounded-xl bg-brand-600 py-4 text-xl font-bold text-white active:bg-brand-700 disabled:opacity-40"
          >
            Cobrar {subtotal > 0 ? money(subtotal) : ''}
          </button>
          {cart.length > 0 && (
            <button
              onClick={clearSale}
              className="mt-2 w-full rounded-xl border border-gray-300 py-3 text-gray-600 active:bg-gray-100"
            >
              Cancelar pedido
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
