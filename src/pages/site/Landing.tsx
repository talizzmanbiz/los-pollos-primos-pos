import { Link } from 'react-router-dom';
import { site, whatsappLink } from './siteInfo';
import { useSeo } from './useSeo';

const STEPS = [
  { n: '1', title: 'Elegí tu pollo', desc: 'Entero, medio o cuarto, combos y guarniciones. Todo desde el menú en línea.' },
  { n: '2', title: 'Pickup o delivery', desc: `Recogé en Sucursal Central o pedí a domicilio. Listo en ${site.prepTime}.` },
  { n: '3', title: 'Pagá y disfrutá', desc: 'Confirmás tu pedido y seguís su estado en tiempo real hasta que llega.' },
];

export default function Landing() {
  useSeo(
    'Pollo rostizado ahumado tropical en Chalchuapa',
    `${site.name} — pollo rostizado marinado en jugo de piña y paprika ahumada. ` +
      `Pickup y delivery en ${site.city}. ${site.hoursShort}.`,
  );

  const wa = whatsappLink('Hola, quiero hacer un pedido 🍗');

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-100 to-brand-50">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-4 py-14 md:flex-row md:py-20">
          <div className="flex-1 text-center md:text-left">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">{site.brand}</p>
            <h1 className="mt-2 text-4xl font-extrabold leading-tight text-brand-900 md:text-5xl">
              {site.tagline}
            </h1>
            <p className="mt-4 text-lg text-gray-700">{site.differentiator}</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row md:justify-start">
              <Link
                to="/tienda"
                className="rounded-full bg-brand-600 px-8 py-3 text-lg font-bold text-white shadow transition hover:bg-brand-700"
              >
                Ver el menú
              </Link>
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border-2 border-brand-600 px-8 py-3 text-lg font-bold text-brand-700 transition hover:bg-brand-100"
                >
                  Pedir por WhatsApp
                </a>
              )}
            </div>
            <p className="mt-4 text-sm text-gray-500">{site.hoursShort}</p>
          </div>
          <div className="flex-1">
            <img
              src="/logo-primos.png"
              alt={`${site.name} — ${site.brand}`}
              className="mx-auto w-56 drop-shadow-xl md:w-72"
            />
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="text-center text-2xl font-bold text-brand-900">¿Cómo funciona?</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">
                {s.n}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">{s.title}</h3>
              <p className="mt-1 text-gray-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Horarios + delivery */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-14 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold text-brand-900">Horarios</h2>
            <ul className="mt-4 divide-y divide-gray-100">
              {site.hours.map((h) => (
                <li key={h.days} className="flex justify-between py-3">
                  <span className="font-medium text-gray-800">{h.days}</span>
                  <span className="text-gray-600">{h.time}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-brand-900">Delivery</h2>
            <p className="mt-4 text-gray-700">{site.delivery.note}. Tiempo estimado: {site.prepTime}.</p>
            <ul className="mt-4 space-y-2">
              {site.delivery.zones.map((z) => (
                <li key={z.name} className="flex justify-between rounded-xl bg-brand-50 px-4 py-3">
                  <span className="font-medium text-gray-800">{z.name}</span>
                  <span className="font-bold text-brand-700">{z.fee}</span>
                </li>
              ))}
            </ul>
            <Link to="/tienda" className="mt-6 inline-block font-semibold text-brand-700 hover:underline">
              Hacer un pedido →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
