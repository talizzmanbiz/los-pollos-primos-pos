import { useState, type FormEvent } from 'react';
import { site, whatsappLink } from './siteInfo';
import { FUNCTIONS_URL } from '../../lib/supabase';
import { useSeo } from './useSeo';
import Reveal from './Reveal';
import { MapPin, Clock, MessageCircle, type LucideIcon } from 'lucide-react';

export default function ContactPage() {
  useSeo('Contacto', `Contactá a ${site.name} en ${site.city}. WhatsApp, correo y horarios de atención.`);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const hasChannel = Boolean(site.whatsappNumber || site.email);

  function onSubmit(e: FormEvent) {
    e.preventDefault();

    // El lead entra al CRM aunque nunca llegue a pedir. Va sin await y con
    // catch vacío a propósito: si el CRM está caído, el cliente igual tiene que
    // poder abrir WhatsApp. El teléfono es la llave con la que GoHighLevel
    // reconoce que es el mismo cliente que después compra.
    void fetch(`${FUNCTIONS_URL}/ghl-contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upsert',
        source: 'website',
        phone,
        name,
        email: '',
      }),
    }).catch(() => {});

    const body = `Hola, soy ${name || 'un cliente'}. ${message}`.trim();
    if (site.whatsappNumber) {
      window.open(whatsappLink(body), '_blank', 'noopener');
    } else if (site.email) {
      window.location.href = `mailto:${site.email}?subject=${encodeURIComponent(
        'Consulta desde el sitio web',
      )}&body=${encodeURIComponent(body)}`;
    }
  }

  // min-h-12 (48px) + text-base: iOS zooms the page on focus for anything under
  // 16px, and a 44px-tall field is the platform touch minimum.
  const inputCls =
    'w-full min-h-12 rounded-xl border border-brand-200 bg-white px-4 py-3 text-base text-charcoal-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15';

  return (
    <div>
      {/* header */}
      <section className="site-section relative overflow-hidden bg-charcoal-900 text-center text-brand-50">
        <div className="bg-radial-warm absolute inset-0" />
        <div className="site-container-xs relative">
          <h1 className="font-display text-3xl font-extrabold text-white sm:text-5xl">Contacto</h1>
          <p className="mt-4 text-base text-brand-50/85 sm:text-lg">Estamos para atenderte. Escribinos o visitanos.</p>
        </div>
      </section>

      <section className="site-section bg-brand-50">
        <div className="site-container grid max-w-5xl gap-6 md:grid-cols-2 md:gap-8">
          {/* info */}
          <Reveal className="space-y-6">
            <InfoCard title="Sucursales" icon={MapPin}>
              <p className="text-charcoal-800">{site.city}</p>
              <ul className="mt-3 space-y-3">
                {site.locations.map((l) => (
                  <li key={l.name} className="rounded-xl bg-brand-50 px-4 py-3 ring-1 ring-brand-100">
                    <p className="font-display font-bold text-brand-900">{l.name}</p>
                    <p className="mt-0.5 text-sm text-charcoal-700/80">{l.detail}</p>
                    <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-brand-600">{l.note}</p>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex flex-col items-start">
                {site.mapsUrl && (
                  <a href={site.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline">
                    Ver en Google Maps →
                  </a>
                )}
                {site.reviewUrl && (
                  <a href={site.reviewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline">
                    Dejanos tu reseña ⭐
                  </a>
                )}
              </div>
            </InfoCard>

            <InfoCard title="Horarios" icon={Clock}>
              <ul className="site-rows space-y-2 text-charcoal-800">
                {site.hours.map((h) => (
                  <li key={h.days} className="site-row">
                    <span className="font-medium">{h.days}</span>
                    <span className="text-charcoal-700/70">{h.time}</span>
                  </li>
                ))}
              </ul>
            </InfoCard>

            {(site.whatsappNumber || site.email) && (
              <InfoCard title="Escribinos" icon={MessageCircle}>
                <ul>
                  {site.whatsappNumber && (
                    <li>
                      <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline">
                        WhatsApp {site.whatsappDisplay}
                      </a>
                    </li>
                  )}
                  {site.email && (
                    <li>
                      <a href={`mailto:${site.email}`} className="inline-flex min-h-11 items-center break-all font-semibold text-brand-700 hover:underline">{site.email}</a>
                    </li>
                  )}
                </ul>
              </InfoCard>
            )}
          </Reveal>

          {/* form */}
          <Reveal delay={120}>
            {hasChannel ? (
              <form onSubmit={onSubmit} className="space-y-4 rounded-3xl bg-white p-6 shadow-[0_10px_40px_rgba(126,50,16,0.08)] ring-1 ring-brand-100 sm:p-8">
                <h2 className="font-display text-xl font-bold text-brand-900">Mandanos un mensaje</h2>
                <div>
                  <label htmlFor="name" className="mb-1 block text-sm font-medium text-charcoal-700">Tu nombre</label>
                  <input id="name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="phone" className="mb-1 block text-sm font-medium text-charcoal-700">Teléfono (WhatsApp)</label>
                  {/* inputMode="numeric" para que el teclado abra en números, igual que el checkout */}
                  <input id="phone" type="tel" inputMode="numeric" autoComplete="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="7777-8888" className={inputCls} />
                </div>
                <div>
                  <label htmlFor="message" className="mb-1 block text-sm font-medium text-charcoal-700">Mensaje</label>
                  <textarea id="message" required value={message} onChange={(e) => setMessage(e.target.value)} rows={5} placeholder="¿En qué te ayudamos?" className={inputCls} />
                </div>
                <button
                  type="submit"
                  className="flex min-h-14 w-full items-center justify-center rounded-full bg-brand-600 px-6 text-lg font-bold text-white shadow-lg shadow-brand-600/25 transition hover:-translate-y-0.5 hover:bg-brand-700"
                >
                  {site.whatsappNumber ? 'Enviar por WhatsApp' : 'Enviar por correo'}
                </button>
                <p className="text-center text-xs text-charcoal-700/60">
                  Se abrirá {site.whatsappNumber ? 'WhatsApp' : 'tu correo'} con tu mensaje. Guardamos tu nombre y teléfono para poder responderte.
                </p>
              </form>
            ) : (
              <div className="rounded-3xl bg-white p-6 text-center text-charcoal-700/70 ring-1 ring-brand-100 sm:p-8">
                Muy pronto podrás escribirnos por aquí.
              </div>
            )}
          </Reveal>
        </div>
      </section>
    </div>
  );
}

function InfoCard({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-[0_10px_40px_rgba(126,50,16,0.06)] ring-1 ring-brand-100 sm:p-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
        <h2 className="font-display text-sm font-bold uppercase tracking-widest text-brand-600">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
