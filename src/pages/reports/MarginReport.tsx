import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { money, marginPct } from '../../lib/format';
import type { Product } from '../../types/database';

export default function MarginReport() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .order('sort_order')
      .then(({ data }) => setProducts(data ?? []));
  }, []);

  return (
    <div className="rounded-2xl bg-white p-4 shadow sm:p-6">
      <p className="mb-4 text-sm text-gray-500">
        Margen % = (precio − costo) / precio. El costo del pollo suelto proviene del costo
        de lote (pestaña «Lotes y rendimiento»); acá se muestran los costos estimados cargados
        en el catálogo.
      </p>
      {/* The table had no scroll container, so with nowrap money columns the
          last one ("Margen %") was painted outside the card and cut off. */}
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-max text-left text-[13px] sm:text-base">
        <thead className="text-[12px] text-gray-500 sm:text-sm">
          <tr>
            <th className="py-2 pr-3">Producto</th>
            <th className="whitespace-nowrap px-2 py-2 text-right">Precio</th>
            <th className="whitespace-nowrap px-2 py-2 text-right">Costo</th>
            <th className="whitespace-nowrap px-2 py-2 text-right">Margen $</th>
            <th className="whitespace-nowrap py-2 pl-2 text-right">Margen %</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {products.map((p) => {
            const pct = marginPct(p.price, p.cost_price);
            return (
              <tr key={p.id}>
                <td className="py-2 pr-3">
                  <span className="block font-medium leading-snug text-gray-800">{p.name}</span>
                  {p.secondary_name && <span className="block text-xs leading-snug text-gray-400">{p.secondary_name}</span>}
                </td>
                <td className="whitespace-nowrap px-2 text-right tabular-nums">{money(p.price)}</td>
                <td className="whitespace-nowrap px-2 text-right tabular-nums">{p.cost_price != null ? money(p.cost_price) : '—'}</td>
                <td className="whitespace-nowrap px-2 text-right tabular-nums">
                  {p.cost_price != null ? money(p.price - p.cost_price) : '—'}
                </td>
                <td className={`whitespace-nowrap pl-2 text-right font-semibold tabular-nums ${pct != null && pct < 50 ? 'text-amber-600' : 'text-green-700'}`}>
                  {pct != null ? `${pct.toFixed(1)}%` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
