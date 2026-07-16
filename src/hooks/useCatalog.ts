import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { cacheCatalog, loadCachedCatalog } from '../lib/offlineQueue';
import type { Product, Tables } from '../types/database';

export interface CatalogProduct extends Product {
  components: { component: Product; quantity: number }[];
}

export function useCatalog() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [prodRes, compRes] = await Promise.all([
        supabase.from('products').select('*').eq('active', true).order('sort_order'),
        supabase.from('combo_components').select('*'),
      ]);
      if (cancelled) return;
      if (prodRes.error || compRes.error) {
        // offline (or backend hiccup): serve the last known catalog so the
        // POS keeps selling — orders queue locally until reconnect
        const cached = await loadCachedCatalog<CatalogProduct>();
        if (cached && cached.length > 0) {
          setProducts(cached);
        } else {
          setError(prodRes.error?.message ?? compRes.error?.message ?? 'Error');
        }
        setLoading(false);
        return;
      }
      const byId = new Map(prodRes.data.map((p) => [p.id, p]));
      const comps = compRes.data as Tables<'combo_components'>[];
      const catalog = prodRes.data.map((p) => ({
        ...p,
        components: comps
          .filter((c) => c.combo_product_id === p.id)
          .map((c) => ({ component: byId.get(c.component_product_id)!, quantity: c.quantity }))
          .filter((c) => c.component),
      }));
      setProducts(catalog);
      void cacheCatalog(catalog);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { products, loading, error };
}
