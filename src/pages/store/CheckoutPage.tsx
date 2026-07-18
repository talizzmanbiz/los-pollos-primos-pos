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

export default function CheckoutPage() {
  const navigate = useNavigate();
  const [cart, setCart] = useState<StoreCartLine[]>(loadCart());
  const [locations, setLocations] = useState<Location[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);

  const [mode, setMode] = useState<'pickup' | 'delivery'>('pickup');
  const [locationCode, setLocationCode] = useState('C');
  const [zoneId, setZoneId] = useState('');
  const [address, setAddress] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [payment, setPayment] = useState<'cash' | 'payment_link'>('cash');
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

  if (confirmation) {
    return (
      <div className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow">
        <p className="text-5xl">🎉</p>
        <h2 className="mt-3 text-2xl font-bold text-gray-900">¡Pedido recibido!</h2>
        <p className="mt-2 text-3xl font-bold text-brand-600">{confirmation.order_number}</p>
        <p className="mt-2 text-gray-600">
          Total {money(confirmation.total)} · listo en ~{confirmation.estimated_minutes} min
        </p>
        {confirmation.payment_url ? (
          <a
            href={confirmation.payment_url}
            className="mt-6 block rounded-xl bg-green-600 py-3 text-lg font-bold text-white"
          >
            Pagar en línea
          </a>
        ) : (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-amber-800">
            Pagás en efectivo al {mode === 'delivery' ? 'recibir' : 'recoger'} tu pedido.
          </p>
        )}
        <p className="mt-4 text-sm text-gray-500">
          Guardá tu número de pedido — podés ver el estado en{' '}
          <Link to="/tienda/estado" className="text-brand-600 underline">Mi pedido</Link>.
        </p>
        <Link
          to="/tienda"
          className="mt-6 block rounded-xl border border-brand-300 py-3 font-semibold text-brand-700"
        >
          Volver al menú
        </Link>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-lg text-gray-500">Tu carrito está vacío.</p>
        <Link to="/tienda" className="mt-4 inline-block rounded-xl bg-brand-600 px-8 py-3 font-bold text-white">
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
          location_code: mode === 'delivery' ? 'C' : locationCode,
          order_type: mode,
          customer_name: name,
          customer_phone: phone,
          customer_email: email || undefined,
          delivery_address: mode === 'delivery' ? address : undefined,
          delivery_zone_id: mode === 'delivery' ? zoneId : undefined,
          payment_method: payment,
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
    <form onSubmit={submit} className="grid gap-6 md:grid-cols-2">
      <div>
        <h2 className="mb-3 text-xl font-bold text-brand-900">Tu pedido</h2>
        <div className="rounded-2xl bg-white p-4 shadow">
          {cart.map((l) => (
            <div key={l.sku} className="mb-2 flex items-center justify-between">
              <span className="text-gray-800">
                {l.quantity} × {l.name}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{money(l.price * l.quantity)}</span>
                <button
                  type="button"
                  onClick={() => setCart(changeLineQty(cart, l.sku, -1))}
                  className="h-10 w-10 rounded-full bg-gray-100 font-bold"
                >
                  −
                </button>
              </div>
            </div>
          ))}
          <div className="mt-3 border-t border-gray-100 pt-3 text-gray-700">
            <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            {mode === 'delivery' && (
              <div className="flex justify-between"><span>Delivery</span><span>{money(deliveryFee)}</span></div>
            )}
            <div className="mt-1 flex justify-between text-xl font-bold text-gray-900">
              <span>Total</span><span>{money(total)}</span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-xl font-bold text-brand-900">Datos de entrega</h2>
        <div className="space-y-4 rounded-2xl bg-white p-4 shadow">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode('pickup')}
              className={`flex-1 rounded-xl py-3 font-semibold ${mode === 'pickup' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              🛍️ Recoger
            </button>
            <button
              type="button"
              onClick={() => setMode('delivery')}
              className={`flex-1 rounded-xl py-3 font-semibold ${mode === 'delivery' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              🛵 Delivery
            </button>
          </div>

          {mode === 'pickup' ? (
            <div>
              <label className="mb-1 block text-sm text-gray-600">Sucursal</label>
              <select
                value={locationCode}
                onChange={(e) => setLocationCode(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-3"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.code}>{l.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
                Delivery disponible solo desde {central?.name ?? 'Sucursal Central'}.
              </p>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Zona</label>
                <select
                  value={zoneId}
                  onChange={(e) => setZoneId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-3"
                >
                  <option value="">Elegir zona…</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>{z.name} — {money(z.fee)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-600">Dirección</label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  required
                  placeholder="Calle, número, referencia"
                  className="w-full rounded-lg border border-gray-300 px-3 py-3"
                />
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-sm text-gray-600">Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full rounded-lg border border-gray-300 px-3 py-3" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">Teléfono (WhatsApp)</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required type="tel"
              placeholder="7777-8888"
              className="w-full rounded-lg border border-gray-300 px-3 py-3" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">Correo (opcional)</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
              className="w-full rounded-lg border border-gray-300 px-3 py-3" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-gray-600">Notas (opcional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-3" />
          </div>

          <div>
            <label className="mb-1 block text-sm text-gray-600">Pago</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPayment('cash')}
                className={`flex-1 rounded-xl py-3 font-semibold ${payment === 'cash' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                💵 Efectivo
              </button>
              <button
                type="button"
                onClick={() => setPayment('payment_link')}
                className={`flex-1 rounded-xl py-3 font-semibold ${payment === 'payment_link' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                💳 Enlace de pago
              </button>
            </div>
            {payment === 'payment_link' && (
              <p className="mt-2 text-xs text-gray-500">
                Si el pago en línea no está disponible, tu pedido queda como pago en efectivo.
              </p>
            )}
          </div>

          {error && <p className="text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-brand-600 py-4 text-lg font-bold text-white active:bg-brand-700 disabled:opacity-50"
          >
            {busy ? 'Enviando…' : `Confirmar pedido · ${money(total)}`}
          </button>
          <button
            type="button"
            onClick={() => navigate('/tienda')}
            className="w-full rounded-xl border border-gray-300 py-3 text-gray-600"
          >
            Seguir comprando
          </button>
        </div>
      </div>
    </form>
  );
}
