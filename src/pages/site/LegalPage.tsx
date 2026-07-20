import type { ReactNode } from 'react';

/** Shared shell for legal pages (Privacidad / Términos) so they match the rest
 * of the site: charcoal header band + consistently-styled prose body. */
export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div>
      <section className="relative overflow-hidden bg-charcoal-900 py-16 text-center text-brand-50">
        <div className="bg-radial-warm absolute inset-0" />
        <div className="relative mx-auto max-w-3xl px-6">
          <h1 className="font-display text-3xl font-extrabold text-white sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm text-brand-200/80">Última actualización: {updated}</p>
        </div>
      </section>
      <article
        className="mx-auto max-w-3xl space-y-6 px-6 py-14 leading-relaxed text-charcoal-700 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-brand-900 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_li]:marker:text-brand-400"
      >
        {children}
      </article>
    </div>
  );
}
