import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, FUNCTIONS_URL } from '../../lib/supabase';
import { money } from '../../lib/format';
import type { Tables } from '../../types/database';
import { loadCart, clearCart, cartSubtotal, changeLineQty, saveCart, type StoreCartLine } from './storeCart';
import { addToHistory } from './orderHistory';

type Location = Tables<'locations'>;
type Zone = Tables<'delivery_zones'>;

interface OrderConfirmation {
  order_number: string;
  total: number;
  estimated_minutes: number;
  payment_url: string | null;
}

const inputCls =
  'w-full rounded-xl border border-brand-200 bg-white px-4 py-3 text-charcoal-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [cart, setCart] = useState<StoreCartLine[]>(loadCart());
  const [locations, setLocations] = useState<Location[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);

  const [mode, setMode] = useState<'pickup' | 'delivery'>('pickup');
  const [zoneId, setZoneId] = useState('');
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<OrderConfirmation | null>(null);

  useEffect(() => {
    supabase.from('locations').select('*').eq('active', true).then(({ data }) => setLocations(data ?? []));
    supabase.from('delivery_zones').select('*').eq('active', true).then(({ data }) => setZones(data ?? []));
  }, []);

  useEffect(() => saveCart(cart), [cart]);

  const subtotal = cartSubtotal(cart);
  const central = locations.find((l) => l.allows_delivery);
  const deliveryFee = useMemo(() => {
    if (mode !== 'delivery') return 0;
    return zones.find((z) => z.id === zoneId)?.fee ?? 0;
  }, [mode, zoneId, zones]);
  const total = Math.round((subtotal + deliveryFee) * 100) / 100;

  // ── confirmation ──
  if (confirmation) {
    return (
      <div className="min-h-screen bg-brand-50 px-4 py-16">
        <div className="mx-auto max-w-md rounded-3xl bg-white p-8 text-center shadow-[0_20px_60px_rgba(126,50,16,0.12)] ring-1 ring-brand-100">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-4xl">🧾</div>
          <h2 className="mt-4 font-display text-2xl font-extrabold text-charcoal-900">¡Casi listo!</h2>
          <p className="mt-2 font-display text-4xl font-extrabold text-brand-600">{confirmation.order_number}</p>
          <p className="mt-2 text-charcoal-700/80">
            Total {money(confirmation.total)} · listo en ~{confirmation.estimated_minutes} min
          </p>
          {confirmation.payment_url ? (
            <>
              <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-amber-800">
                Tu pedido se confirma al completar el pago.
              </p>
              <a
                href={confirmation.payment_url}
                className="mt-4 block rounded-full bg-green-600 py-4 text-lg font-bold text-white shadow-lg shadow-green-600/25 transition hover:-translate-y-0.5 hover:bg-green-700"
              >
                Pagar ahora · {money(confirmation.total)}
              </a>
            </>
          ) : (
            <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-red-700">
              No pudimos generar el enlace de pago. Escribinos por WhatsApp o intentá de nuevo.
            </p>
          )}
          <p className="mt-5 text-sm text-charcoal-700/60">
            Guardá tu número de pedido — seguí el estado en{' '}
            <Link to="/tienda/estado" className="font-semibold text-brand-600 underline">Mi pedido</Link>.
          </p>
          <Link
            to="/tienda"
            className="mt-6 block rounded-full border border-brand-200 py-3 font-semibold text-brand-700 transition hover:bg-brand-50"
          >
            Volver al menú
          </Link>
        </div>
      </div>
    );
  }

  // ── empty ──
  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-brand-50 px-4 py-24 text-center">
        <p className="text-6xl">🛒</p>
        <p className="mt-4 text-lg text-charcoal-700/70">Tu carrito está vacío.</p>
        <Link to="/tienda" className="mt-6 inline-block rounded-full bg-brand-600 px-8 py-3.5 font-bold text-white shadow-lg transition hover:bg-brand-700">
          Ver el menú
        </Link>
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${FUNCTIONS_URL}/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'online',
          location_code: 'C', // online orders are always Sucursal Central
          order_type: mode,
          customer_name: name,
          customer_phone: phone,
          customer_email: email || undefined,
          delivery_address: mode === 'delivery' ? address : undefined,
          delivery_zone_id: mode === 'delivery' ? zoneId : undefined,
          payment_method: 'payment_link', // online payment is mandatory
          notes: notes || undefined,
          items: cart.map((l) => ({ sku: l.sku, quantity: l.quantity })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo enviar el pedido');
        setBusy(false);
        return;
      }
      addToHistory({
        order_number: data.order_number,
        placed_at: new Date().toISOString(),
        total: data.total,
        phone,
        name,
        mode,
        lines: cart,
      });
      clearCart();
      setConfirmation(data as OrderConfirmation);
    } catch {
      setError('Error de conexión — intentá de nuevo');
    }
    setBusy(false);
  }

  return (
    <div className="min-h-screen bg-brand-50 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-3xl font-extrabold text-brand-900">Finalizar pedido</h1>
        <form onSubmit={submit} className="mt-6 grid gap-6 md:grid-cols-2">
          {/* summary */}
          <div className="md:order-2">
            <div className="rounded-3xl bg-white p-6 shadow-[0_10px_40px_rgba(126,50,16,0.07)] ring-1 ring-brand-100">
              <h2 className="font-display text-lg font-bold text-brand-900">Tu pedido</h2>
              <div className="mt-4 space-y-2">
                {cart.map((l) => (
                  <div key={l.sku} className="flex items-center justify-between gap-2 text-charcoal-800">
                    <span className="min-w-0 truncate">{l.quantity} × {l.name}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-semibold">{money(l.price * l.quantity)}</span>
                      <button
                        type="button"
                        onClick={() => setCart(changeLineQty(cart, l.sku, -1))}
                        aria-label="Quitar uno"
                        className="h-9 w-9 rounded-full bg-brand-50 text-lg font-bold text-brand-600"
                      >
                        −
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-1 border-t border-brand-100 pt-4 text-charcoal-700">
                <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
                {mode === 'delivery' && (
                  <div className="flex justify-between"><span>Delivery</span><span>{money(deliveryFee)}</span></div>
                )}
                <div className="mt-1 flex justify-between font-display text-xl font-extrabold text-charcoal-900">
                  <span>Total</span><span>{money(total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* details */}
          <div className="space-y-4 md:order-1">
            <div className="rounded-3xl bg-white p-6 shadow-[0_10px_40px_rgba(126,50,16,0.07)] ring-1 ring-brand-100">
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-brand-50 p-1.5">
                {(['pickup', 'delivery'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`rounded-xl py-3 font-semibold transition ${
                      mode === m ? 'bg-brand-600 text-white shadow' : 'text-charcoal-700'
                    }`}
                  >
                    {m === 'pickup' ? '🛍️ Recoger' : '🛵 Delivery'}
                  </button>
                ))}
              </div>

              <div className="mt-4 space-y-4">
                {mode === 'pickup' ? (
                  <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    Recogé en {central?.name ?? 'Sucursal Central'}.
                  </p>
                ) : (
                  <>
                    <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">
                      Delivery disponible solo desde {central?.name ?? 'Sucursal Central'}.
                    </p>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-charcoal-700">Zona</label>
                      <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} required className={inputCls}>
                        <option value="">Elegir zona…</option>
                        {zones.map((z) => (
                          <option key={z.id} value={z.id}>{z.name} — {money(z.fee)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-charcoal-700">Dirección</label>
                      <input value={address} onChange={(e) => setAddress(e.target.value)} required placeholder="Calle, número, referencia" className={inputCls} />
                    </div>
                  </>
                )}

                <div>
                  <label className="mb-1 block text-sm font-medium text-charcoal-700">Nombre</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-charcoal-700">Teléfono (WhatsApp)</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} required type="tel" placeholder="7777-8888" className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-charcoal-700">Correo (opcional)</label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className={inputCls} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-charcoal-700">Notas (opcional)</label>
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
                </div>

                <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
                  💳 <span className="font-semibold">Pago en línea con tarjeta.</span> Al confirmar te
                  llevamos a la pasarela segura de Wompi para completar tu pedido.
                </div>

                {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-red-600">{error}</p>}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-full bg-brand-600 py-4 font-display text-lg font-bold text-white shadow-lg shadow-brand-600/25 transition hover:-translate-y-0.5 hover:bg-brand-700 disabled:opacity-50"
                >
                  {busy ? 'Enviando…' : `Confirmar pedido · ${money(total)}`}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/tienda')}
                  className="w-full rounded-full border border-brand-200 py-3 font-semibold text-charcoal-700 transition hover:bg-brand-50"
                >
                  Seguir comprando
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
