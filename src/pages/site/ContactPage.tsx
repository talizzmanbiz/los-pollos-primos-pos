import { useState, type FormEvent } from 'react';
import { site, whatsappLink } from './siteInfo';
import { useSeo } from './useSeo';

export default function ContactPage() {
  useSeo('Contacto', `Contactá a ${site.name} en ${site.city}. WhatsApp, correo y horarios de atención.`);

  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  const hasChannel = Boolean(site.whatsappNumber || site.email);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const body = `Hola, soy ${name || 'un cliente'}. ${message}`.trim();
    if (site.whatsappNumber) {
      window.open(whatsappLink(body), '_blank', 'noopener');
    } else if (site.email) {
      window.location.href = `mailto:${site.email}?subject=${encodeURIComponent(
        'Consulta desde el sitio web',
      )}&body=${encodeURIComponent(body)}`;
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-extrabold text-brand-900">Contacto</h1>
      <p className="mt-2 text-gray-600">Estamos para atenderte. Escribinos o visitanos.</p>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        {/* Info */}
        <div className="space-y-5">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-600">Dirección</h2>
            <p className="mt-1 text-gray-800">{site.city}</p>
            {site.addressLine && <p className="text-gray-800">{site.addressLine}</p>}
            {site.mapsUrl && (
              <a href={site.mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-brand-700 hover:underline">
                Ver en Google Maps →
              </a>
            )}
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-600">Horarios</h2>
            <ul className="mt-1 space-y-1 text-gray-800">
              {site.hours.map((h) => (
                <li key={h.days}>
                  <span className="font-medium">{h.days}:</span> {h.time}
                </li>
              ))}
            </ul>
          </div>

          {(site.whatsappNumber || site.email) && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-600">Escribinos</h2>
              <ul className="mt-1 space-y-1">
                {site.whatsappNumber && (
                  <li>
                    <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
                      WhatsApp{site.whatsappDisplay ? ` · ${site.whatsappDisplay}` : ''}
                    </a>
                  </li>
                )}
                {site.email && (
                  <li>
                    <a href={`mailto:${site.email}`} className="text-brand-700 hover:underline">{site.email}</a>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Form */}
        <div>
          {hasChannel ? (
            <form onSubmit={onSubmit} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Tu nombre</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="Nombre"
                />
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700">Mensaje</label>
                <textarea
                  id="message"
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  placeholder="¿En qué te ayudamos?"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-full bg-brand-600 px-6 py-3 font-semibold text-white transition hover:bg-brand-700"
              >
                {site.whatsappNumber ? 'Enviar por WhatsApp' : 'Enviar por correo'}
              </button>
              <p className="text-xs text-gray-400">
                Se abrirá {site.whatsappNumber ? 'WhatsApp' : 'tu correo'} con tu mensaje. No guardamos tus datos en este formulario.
              </p>
            </form>
          ) : (
            <div className="rounded-2xl bg-brand-50 p-6 text-gray-600">
              Muy pronto podrás escribirnos por aquí.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
