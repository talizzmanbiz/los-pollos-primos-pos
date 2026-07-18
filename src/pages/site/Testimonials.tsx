import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Review } from '../../types/database';

function Stars({ n }: { n: number }) {
  return (
    <span className="text-amber-400" aria-label={`${n} de 5`}>
      {'★'.repeat(n)}
      <span className="text-gray-300">{'★'.repeat(5 - n)}</span>
    </span>
  );
}

export default function Testimonials() {
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    supabase
      .from('reviews')
      .select('*')
      .eq('approved', true)
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => setReviews(data ?? []));
  }, []);

  if (reviews.length === 0) return null;

  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;

  return (
    <section className="bg-brand-50">
      <div className="mx-auto max-w-5xl px-4 py-14">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-brand-900">Lo que dicen nuestros clientes</h2>
          <p className="mt-2 text-lg">
            <span className="font-bold text-amber-500">★ {avg.toFixed(1)}</span>{' '}
            <span className="text-gray-500">· {reviews.length} reseña{reviews.length > 1 ? 's' : ''}</span>
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-2xl bg-white p-5 shadow-sm">
              <Stars n={r.rating} />
              {r.comment && <p className="mt-2 text-gray-700">“{r.comment}”</p>}
              <p className="mt-3 text-sm font-semibold text-gray-500">
                — {r.customer_name?.trim() || 'Cliente'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
