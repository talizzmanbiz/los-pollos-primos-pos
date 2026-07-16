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
    <div className="rounded-2xl bg-white p-6 shadow">
      <p className="mb-4 text-sm text-gray-500">
        Margen % = (precio − costo) / precio. El costo del pollo suelto proviene del costo
        de lote (pestaña «Lotes y rendimiento»); acá se muestran los costos estimados cargados
        en el catálogo.
      </p>
      <table className="w-full text-left">
        <thead className="text-sm text-gray-500">
          <tr>
            <th className="py-2">Producto</th>
            <th className="text-right">Precio</th>
            <th className="text-right">Costo est.</th>
            <th className="text-right">Margen $</th>
            <th className="text-right">Margen %</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {products.map((p) => {
            const pct = marginPct(p.price, p.cost_price);
            return (
              <tr key={p.id}>
                <td className="py-2">
                  <span className="font-medium text-gray-800">{p.name}</span>
                  {p.secondary_name && <span className="ml-2 text-sm text-gray-400">{p.secondary_name}</span>}
                </td>
                <td className="text-right">{money(p.price)}</td>
                <td className="text-right">{p.cost_price != null ? money(p.cost_price) : '—'}</td>
                <td className="text-right">
                  {p.cost_price != null ? money(p.price - p.cost_price) : '—'}
                </td>
                <td className={`text-right font-semibold ${pct != null && pct < 50 ? 'text-amber-600' : 'text-green-700'}`}>
                  {pct != null ? `${pct.toFixed(1)}%` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
