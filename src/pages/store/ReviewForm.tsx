import { useState } from 'react';
import { supabase } from '../../lib/supabase';

/** Star rating + comment, shown after an order is completed. Submitted reviews
 * are unapproved (RLS) until an admin publishes them. */
export default function ReviewForm({ orderNumber }: { orderNumber: string }) {
  const doneKey = `pp-review-done-${orderNumber}`;
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(() => {
    try {
      return localStorage.getItem(doneKey) === '1';
    } catch {
      return false;
    }
  });

  async function submit() {
    if (rating < 1) {
      setError('Elegí una calificación');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from('reviews').insert({
      rating,
      comment: comment.trim() || null,
      customer_name: name.trim() || null,
      approved: false,
    });
    setBusy(false);
    if (err) {
      setError('No se pudo enviar tu reseña. Intentá de nuevo.');
      return;
    }
    try {
      localStorage.setItem(doneKey, '1');
    } catch {
      /* ignore */
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-center text-green-800">
        ¡Gracias por tu reseña! 🙌 La publicaremos pronto.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50 p-4">
      <p className="font-semibold text-brand-900">¿Cómo estuvo tu pedido?</p>

      <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Calificación">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} estrella${n > 1 ? 's' : ''}`}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            className="text-3xl leading-none"
          >
            <span className={(hover || rating) >= n ? 'text-amber-400' : 'text-gray-300'}>★</span>
          </button>
        ))}
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Tu nombre (opcional)"
        className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2"
      />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Contanos qué te pareció (opcional)"
        rows={3}
        maxLength={1000}
        className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2"
      />

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="mt-2 w-full rounded-xl bg-brand-600 py-3 font-semibold text-white disabled:opacity-50"
      >
        {busy ? 'Enviando…' : 'Enviar reseña'}
      </button>
    </div>
  );
}
