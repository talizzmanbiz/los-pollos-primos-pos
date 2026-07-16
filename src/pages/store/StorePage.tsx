import { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { money } from '../../lib/format';
import type { Product } from '../../types/database';
import {
  loadCart, saveCart, addLine, changeLineQty, cartSubtotal, type StoreCartLine,
} from './storeCart';

const TYPE_LABELS: Record<string, string> = {
  combo: 'Combos',
  chicken: 'Solo el Pollo',
  extra: 'Extras',
  beverage: 'Bebidas',
};

export function StoreLayout() {
  return (
    <div className="min-h-screen bg-brand-50">
      <header className="bg-brand-700 px-4 py-4 text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link to="/tienda" className="text-2xl font-bold">
            🍗 Los Pollos Primos
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link to="/tienda" className="hover:underline">Menú</Link>
            <Link to="/tienda/estado" className="hover:underline">Mi pedido</Link>
          </nav>
        </div>
        <p className="mx-auto max-w-4xl text-sm opacity-80">Ahumado Tropical · Chalchuapa, Santa Ana</p>
      </header>
      <main className="mx-auto max-w-4xl p-4">
        <Outlet />
      </main>
      <footer className="py-8 text-center text-sm text-gray-400">
        los-pollosprimos.com · Delivery solo desde Sucursal Central (Zona 1 $1.00 · Zona 2 $1.50)
      </footer>
    </div>
  );
}

export default function StorePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<StoreCartLine[]>(loadCart());
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .then(({ data }) => {
        setProducts(data ?? []);
        setLoading(false);
      });
  }, []);

  useEffect(() => saveCart(cart), [cart]);

  const subtotal = cartSubtotal(cart);
  const groups = ['combo', 'chicken', 'extra', 'beverage']
    .map((t) => ({ type: t, items: products.filter((p) => p.product_type === t) }))
    .filter((g) => g.items.length > 0);

  if (loading) return <p className="py-12 text-center text-lg text-gray-500">Cargando menú…</p>;

  return (
    <div className="pb-28">
      {groups.map((g) => (
        <section key={g.type} className="mb-8">
          <h2 className="mb-3 text-xl font-bold text-brand-900">{TYPE_LABELS[g.type]}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {g.items.map((p) => {
              const inCart = cart.find((l) => l.sku === p.sku);
              return (
                <div key={p.id} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow">
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{p.name}</p>
                    <p className="font-bold text-brand-600">{money(p.price)}</p>
                  </div>
                  {inCart ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCart(changeLineQty(cart, p.sku, -1))}
                        className="h-12 w-12 rounded-full bg-brand-100 text-xl font-bold text-brand-700"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-lg font-bold">{inCart.quantity}</span>
                      <button
                        onClick={() => setCart(changeLineQty(cart, p.sku, 1))}
                        className="h-12 w-12 rounded-full bg-brand-600 text-xl font-bold text-white"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setCart(addLine(cart, p))}
                      className="rounded-full bg-brand-600 px-5 py-3 font-semibold text-white active:bg-brand-700"
                    >
                      Agregar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 bg-white p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.1)]">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
            <p className="text-lg">
              <span className="font-bold">{cart.reduce((s, l) => s + l.quantity, 0)}</span> producto(s) ·{' '}
              <span className="font-bold text-brand-600">{money(subtotal)}</span>
            </p>
            <button
              onClick={() => navigate('/tienda/checkout')}
              className="rounded-xl bg-brand-600 px-8 py-3 text-lg font-bold text-white active:bg-brand-700"
            >
              Ir a pagar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
