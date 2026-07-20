import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Review } from '../../types/database';
import Reveal from './Reveal';
import { Star } from 'lucide-react';

function Stars({ n }: { n: number }) {
  return (
    <span className="flex gap-0.5" aria-label={`${n} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i <= n ? 'fill-gold-400 text-gold-400' : 'fill-brand-100 text-brand-200'}`}
        />
      ))}
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
    <section className="bg-brand-50 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="text-center">
          <span className="font-display text-xs font-bold uppercase tracking-[0.28em] text-brand-600">
            Reseñas reales
          </span>
          <h2 className="mt-3 font-display text-3xl font-extrabold text-brand-900 sm:text-4xl">
            Lo que dicen nuestros clientes
          </h2>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-lg">
            <Star className="h-5 w-5 fill-gold-400 text-gold-400" />
            <span className="font-display font-bold text-gold-500">{avg.toFixed(1)}</span>
            <span className="text-charcoal-700/70">
              · {reviews.length} reseña{reviews.length > 1 ? 's' : ''}
            </span>
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {reviews.map((r, i) => (
            <Reveal key={r.id} delay={(i % 3) * 100} as="div">
              <figure className="h-full rounded-3xl bg-white p-7 shadow-[0_10px_40px_rgba(126,50,16,0.07)] ring-1 ring-brand-100">
                <Stars n={r.rating} />
                {r.comment && (
                  <blockquote className="mt-3 leading-relaxed text-charcoal-800">"{r.comment}"</blockquote>
                )}
                <figcaption className="mt-4 font-display text-sm font-bold text-brand-700">
                  — {r.customer_name?.trim() || 'Cliente'}
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
