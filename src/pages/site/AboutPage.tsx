import { Link } from 'react-router-dom';
import { site } from './siteInfo';
import { useSeo } from './useSeo';

export default function AboutPage() {
  useSeo(
    'Nosotros',
    `Conocé a ${site.name}, pollería de ${site.city}. Nuestro sello: pollo marinado en jugo de piña y paprika ahumada.`,
  );

  return (
    <article className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-3xl font-extrabold text-brand-900">Nosotros</h1>
      <p className="mt-2 text-sm font-semibold uppercase tracking-widest text-brand-600">{site.brand}</p>

      <section className="mt-8 space-y-4 text-lg leading-relaxed text-gray-700">
        <p>
          <strong>{site.name}</strong> es una pollería familiar en {site.city}. Nacimos con una idea
          simple: hacer el pollo rostizado más sabroso de la zona, con un sello imposible de copiar.
        </p>
        <p>{site.differentiator}</p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold text-brand-900">Nuestro diferenciador</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900">Marinado en piña 🍍</h3>
            <p className="mt-1 text-gray-600">Jugo de piña natural que ablanda y da un dulzor tropical.</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900">Paprika ahumada</h3>
            <p className="mt-1 text-gray-600">El toque ahumado que define el sabor Ahumado Tropical.</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900">Rostizado lento</h3>
            <p className="mt-1 text-gray-600">Jugoso por dentro, dorado por fuera. Nada de apuros.</p>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900">Hecho al momento</h3>
            <p className="mt-1 text-gray-600">Preparado fresco para tu pedido, listo en {site.prepTime}.</p>
          </div>
        </div>
      </section>

      <section className="mt-10 rounded-2xl bg-brand-100 p-6">
        <h2 className="text-xl font-bold text-brand-900">Visitanos</h2>
        <p className="mt-2 text-gray-700">{site.city}</p>
        {site.addressLine && <p className="text-gray-700">{site.addressLine}</p>}
        <ul className="mt-3 space-y-1 text-gray-700">
          {site.hours.map((h) => (
            <li key={h.days}>
              <span className="font-medium">{h.days}:</span> {h.time}
            </li>
          ))}
        </ul>
        <Link to="/tienda" className="mt-5 inline-block rounded-full bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-700">
          Ver el menú
        </Link>
      </section>
    </article>
  );
}
