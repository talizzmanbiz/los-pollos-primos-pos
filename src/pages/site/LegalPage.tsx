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
      <section className="relative overflow-hidden bg-charcoal-900 py-14 text-center text-brand-50 sm:py-16">
        <div className="bg-radial-warm absolute inset-0" />
        <div className="site-container-xs relative">
          <h1 className="font-display text-2xl font-extrabold text-balance text-white sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm text-brand-200/80">Última actualización: {updated}</p>
        </div>
      </section>
      {/* break-words: legal copy carries long URLs/emails that used to push the
          page sideways on a 320px screen. */}
      <article
        className="site-container-xs site-body space-y-6 py-12 break-words text-charcoal-700 sm:py-14 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-brand-900 [&_h2]:sm:text-xl [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_li]:marker:text-brand-400 [&_a]:break-all"
      >
        {children}
      </article>
    </div>
  );
}
