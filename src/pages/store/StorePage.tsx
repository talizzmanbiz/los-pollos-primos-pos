import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
const TYPE_DESC: Record<string, string> = {
  combo: 'Pollo + guarniciones, listo para pedir',
  chicken: 'Entero, medio o cuarto',
  extra: 'Para acompañar',
  beverage: 'Para refrescar',
};

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
  const count = cart.reduce((s, l) => s + l.quantity, 0);
  const groups = ['combo', 'chicken', 'extra', 'beverage']
    .map((t) => ({ type: t, items: products.filter((p) => p.product_type === t) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="min-h-screen bg-brand-50">
      {/* menu header */}
      <div className="relative overflow-hidden bg-charcoal-900">
        <img src="/images/combo.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" loading="lazy" />
        <div className="bg-radial-warm absolute inset-0" />
        <div className="relative mx-auto max-w-4xl px-6 py-12 text-center sm:py-14">
          <span className="font-display text-xs font-bold uppercase tracking-[0.28em] text-brand-300">
            Ahumado Tropical
          </span>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-white sm:text-4xl">Nuestro menú</h1>
          <p className="mt-2 text-brand-50/80">Pedí en línea · pickup o delivery en Sucursal Central</p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 pb-32 pt-8 sm:px-6">
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/60" />
            ))}
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.type} className="mb-10">
              <div className="mb-4 flex items-baseline justify-between border-b border-brand-200 pb-2">
                <h2 className="font-display text-2xl font-extrabold text-brand-900">{TYPE_LABELS[g.type]}</h2>
                <span className="text-sm text-charcoal-700/60">{TYPE_DESC[g.type]}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {g.items.map((p) => {
                  const inCart = cart.find((l) => l.sku === p.sku);
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-[0_4px_20px_rgba(126,50,16,0.06)] ring-1 ring-brand-100 transition hover:shadow-[0_8px_30px_rgba(126,50,16,0.10)]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-display text-lg font-bold text-charcoal-900">{p.name}</p>
                        <p className="font-display text-base font-bold text-brand-600">{money(p.price)}</p>
                      </div>
                      {inCart ? (
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            onClick={() => setCart(changeLineQty(cart, p.sku, -1))}
                            aria-label="Quitar uno"
                            className="h-11 w-11 rounded-full bg-brand-100 text-xl font-bold text-brand-700 transition active:scale-90"
                          >
                            −
                          </button>
                          <span className="w-6 text-center font-display text-lg font-bold">{inCart.quantity}</span>
                          <button
                            onClick={() => setCart(changeLineQty(cart, p.sku, 1))}
                            aria-label="Agregar uno"
                            className="h-11 w-11 rounded-full bg-brand-600 text-xl font-bold text-white transition active:scale-90"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setCart(addLine(cart, p))}
                          className="shrink-0 rounded-full bg-brand-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-brand-700 active:scale-95"
                        >
                          Agregar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>

      {/* sticky cart bar */}
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-brand-100 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] backdrop-blur">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
            <p className="text-charcoal-800">
              <span className="font-display text-lg font-bold">{count}</span> producto{count > 1 ? 's' : ''}
              <span className="mx-2 text-brand-200">·</span>
              <span className="font-display text-lg font-bold text-brand-600">{money(subtotal)}</span>
            </p>
            <button
              onClick={() => navigate('/tienda/checkout')}
              className="rounded-full bg-brand-600 px-8 py-3.5 font-display text-lg font-bold text-white shadow-lg shadow-brand-600/25 transition hover:-translate-y-0.5 hover:bg-brand-700"
            >
              Ir a pagar →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
