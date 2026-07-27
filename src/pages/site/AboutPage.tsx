import { Link } from 'react-router-dom';
import { site } from './siteInfo';
import { useSeo } from './useSeo';
import Reveal from './Reveal';
import { Citrus, Sparkles, Timer, Clock, type LucideIcon } from 'lucide-react';

const PILARES: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: Citrus, title: 'Naranja natural', desc: 'Jugo de naranja recién exprimido: el toque cítrico de la casa.' },
  { icon: Sparkles, title: 'Marinada tropical', desc: 'Jugo de piña y especias seleccionadas, en la medida exacta.' },
  { icon: Timer, title: 'Rostizado lento', desc: 'Jugoso por dentro, dorado por fuera. Nada de apuros.' },
  { icon: Clock, title: 'Hecho al momento', desc: `Preparado fresco para tu pedido, listo en ${site.prepTime}.` },
];

export default function AboutPage() {
  useSeo(
    'Nosotros',
    `Conocé a ${site.name}, pollería de ${site.city}. Nuestro sello: pollo marinado en jugo de piña y naranja natural con especias seleccionadas.`,
  );

  return (
    <div>
      {/* header */}
      <section className="relative overflow-hidden">
        <img src="/images/closeup.webp" alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
        <div className="absolute inset-0 bg-charcoal-900/80" />
        <div className="site-container-sm relative py-16 text-center sm:py-24">
          <span className="site-eyebrow text-brand-300">{site.brand}</span>
          <h1 className="mt-3 font-display text-3xl font-extrabold text-white sm:text-5xl">Nosotros</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-brand-50/85 sm:text-lg">
            Una pollería familiar en {site.city} con un sello imposible de copiar.
          </p>
        </div>
      </section>

      {/* story */}
      <section className="site-section bg-brand-50">
        <div className="site-container grid items-center gap-12 lg:grid-cols-2">
          <Reveal>
            <img
              src="/images/combo.webp"
              alt="Combo de Los Pollos Primos"
              className="aspect-square w-full rounded-[1.7rem] object-cover shadow-2xl"
              loading="lazy"
              decoding="async"
            />
          </Reveal>
          <Reveal delay={120} className="site-body space-y-4 text-base text-charcoal-700 sm:text-lg">
            <h2 className="site-heading">Nuestra historia</h2>
            <p>
              <strong>{site.name}</strong> nació con una idea simple: hacer el pollo rostizado más
              sabroso de la zona, con una receta que nos distingue.
            </p>
            <p>{site.differentiator}</p>
          </Reveal>
        </div>
      </section>

      {/* pilares */}
      <section className="site-section bg-white">
        <div className="site-container">
          <Reveal className="text-center">
            <h2 className="site-heading">Nuestro diferenciador</h2>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PILARES.map((p, i) => {
              const Icon = p.icon;
              return (
                <Reveal key={p.title} delay={(i % 4) * 100} as="div">
                  <div className="h-full rounded-3xl bg-brand-50 p-6 text-center ring-1 ring-brand-100 sm:p-7">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
                      <Icon className="h-7 w-7" strokeWidth={2} />
                    </div>
                    <h3 className="mt-4 font-display text-lg font-bold text-brand-900">{p.title}</h3>
                    <p className="mt-1 leading-relaxed text-charcoal-700/80">{p.desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* visit */}
      <section className="site-section relative overflow-hidden bg-charcoal-900 text-brand-50">
        <div className="bg-radial-warm absolute inset-0" />
        <Reveal className="site-container-xs relative text-center">
          <h2 className="site-heading text-white">Visitanos</h2>
          <p className="mt-3 text-brand-100/85">{site.city}</p>
          {site.addressLine && <p className="mt-1 leading-relaxed text-brand-100/85">{site.addressLine}</p>}
          <ul className="site-rows mx-auto mt-6 max-w-sm space-y-2 text-brand-100/80">
            {site.hours.map((h) => (
              <li key={h.days} className="site-row">
                <span>{h.days}</span>
                <span className="text-brand-200/70">{h.time}</span>
              </li>
            ))}
          </ul>
          <Link
            to="/tienda"
            className="mt-8 inline-flex min-h-14 items-center justify-center rounded-full bg-brand-600 px-8 text-lg font-bold text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-brand-700"
          >
            Ver el menú
          </Link>
        </Reveal>
      </section>
    </div>
  );
}
