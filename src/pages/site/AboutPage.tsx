import { Link } from 'react-router-dom';
import { site } from './siteInfo';
import { useSeo } from './useSeo';
import Reveal from './Reveal';

const PILARES = [
  { icon: '🍍', title: 'Marinado en piña', desc: 'Jugo de piña natural que ablanda y da un dulzor tropical.' },
  { icon: '🌶️', title: 'Paprika ahumada', desc: 'El toque ahumado que define el sabor Ahumado Tropical.' },
  { icon: '🔥', title: 'Rostizado lento', desc: 'Jugoso por dentro, dorado por fuera. Nada de apuros.' },
  { icon: '⏱️', title: 'Hecho al momento', desc: `Preparado fresco para tu pedido, listo en ${site.prepTime}.` },
];

export default function AboutPage() {
  useSeo(
    'Nosotros',
    `Conocé a ${site.name}, pollería de ${site.city}. Nuestro sello: pollo marinado en jugo de piña y paprika ahumada.`,
  );

  return (
    <div>
      {/* header */}
      <section className="relative overflow-hidden">
        <img src="/images/closeup.webp" alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-charcoal-900/80" />
        <div className="relative mx-auto max-w-4xl px-6 py-20 text-center sm:py-24">
          <span className="font-display text-xs font-bold uppercase tracking-[0.28em] text-brand-300">
            {site.brand}
          </span>
          <h1 className="mt-3 font-display text-4xl font-extrabold text-white sm:text-5xl">Nosotros</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-brand-50/85">
            Una pollería familiar en {site.city} con un sello imposible de copiar.
          </p>
        </div>
      </section>

      {/* story */}
      <section className="bg-brand-50 py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2">
          <Reveal>
            <img
              src="/images/combo.webp"
              alt="Combo de Los Pollos Primos"
              className="aspect-square w-full rounded-[1.7rem] object-cover shadow-2xl"
              loading="lazy"
            />
          </Reveal>
          <Reveal delay={120} className="space-y-4 text-lg leading-relaxed text-charcoal-700">
            <h2 className="font-display text-3xl font-extrabold text-brand-900">Nuestra historia</h2>
            <p>
              <strong>{site.name}</strong> nació con una idea simple: hacer el pollo rostizado más
              sabroso de la zona, con una receta que nos distingue.
            </p>
            <p>{site.differentiator}</p>
          </Reveal>
        </div>
      </section>

      {/* pilares */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal className="text-center">
            <h2 className="font-display text-3xl font-extrabold text-brand-900 sm:text-4xl">
              Nuestro diferenciador
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PILARES.map((p, i) => (
              <Reveal key={p.title} delay={(i % 4) * 100} as="div">
                <div className="h-full rounded-3xl bg-brand-50 p-7 text-center ring-1 ring-brand-100">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-3xl">
                    {p.icon}
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold text-brand-900">{p.title}</h3>
                  <p className="mt-1 text-charcoal-700/80">{p.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* visit */}
      <section className="relative overflow-hidden bg-charcoal-900 py-20 text-brand-50">
        <div className="bg-radial-warm absolute inset-0" />
        <Reveal className="relative mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-display text-3xl font-extrabold text-white">Visitanos</h2>
          <p className="mt-3 text-brand-100/85">{site.city}</p>
          {site.addressLine && <p className="text-brand-100/85">{site.addressLine}</p>}
          <ul className="mx-auto mt-5 max-w-xs space-y-1.5 text-brand-100/80">
            {site.hours.map((h) => (
              <li key={h.days} className="flex justify-between gap-4">
                <span>{h.days}</span>
                <span className="text-brand-200/70">{h.time}</span>
              </li>
            ))}
          </ul>
          <Link
            to="/tienda"
            className="mt-8 inline-block rounded-full bg-brand-600 px-8 py-4 text-lg font-bold text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-brand-700"
          >
            Ver el menú
          </Link>
        </Reveal>
      </section>
    </div>
  );
}
