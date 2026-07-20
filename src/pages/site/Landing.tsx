import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { money } from '../../lib/format';
import { site, whatsappLink } from './siteInfo';
import { useSeo } from './useSeo';
import Reveal from './Reveal';
import Testimonials from './Testimonials';
import { Citrus, Flame, Timer, Leaf, Clock, Bike, type LucideIcon } from 'lucide-react';

interface Combo {
  sku: string;
  name: string;
  price: number;
}

const STEPS = [
  { n: '01', title: 'Elegí tu pollo', desc: 'Entero, medio o cuarto, combos y guarniciones — todo desde el menú en línea.' },
  { n: '02', title: 'Pickup o delivery', desc: `Recogé en Sucursal Central o pedí a domicilio. Listo en ${site.prepTime}.` },
  { n: '03', title: 'Pagá y disfrutá', desc: 'Pagás en línea y seguís tu pedido en tiempo real hasta que llega.' },
];

const DIFERENCIA: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: Citrus, title: 'Marinado en piña', desc: 'Jugo de piña natural que ablanda y da un dulzor tropical inconfundible.' },
  { icon: Flame, title: 'Paprika ahumada', desc: 'El toque ahumado que define el sabor Ahumado Tropical.' },
  { icon: Timer, title: 'Rostizado lento', desc: 'Jugoso por dentro, dorado y crujiente por fuera. Sin apuros.' },
];

export default function Landing() {
  useSeo(
    'Pollo rostizado ahumado tropical en Chalchuapa',
    `${site.name} — pollo rostizado marinado en jugo de piña y paprika ahumada. ` +
      `Pickup y delivery en ${site.city}. ${site.hoursShort}.`,
  );

  const [combos, setCombos] = useState<Combo[]>([]);
  useEffect(() => {
    supabase
      .from('products')
      .select('sku, name, price')
      .eq('active', true)
      .eq('product_type', 'combo')
      .order('sort_order')
      .then(({ data }) => setCombos(data ?? []));
  }, []);

  const wa = whatsappLink('Hola, quiero hacer un pedido 🍗');

  return (
    <div>
      {/* ───────────────── Hero ───────────────── */}
      <section className="relative flex min-h-[100svh] items-center overflow-hidden">
        <img
          src="/images/hero.webp"
          alt="Pollo rostizado Los Pollos Primos"
          className="animate-kenburns absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-charcoal-900/85 via-charcoal-900/45 to-charcoal-900/65" />
        <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/80 via-transparent to-charcoal-900/30" />

        <div className="relative mx-auto w-full max-w-6xl px-6 pt-24 pb-16">
          <div className="max-w-xl md:ml-auto md:text-right">
            <div className="flex items-center gap-3 md:justify-end">
              <span className="h-px w-8 bg-brand-400" />
              <span className="font-display text-xs font-bold uppercase tracking-[0.28em] text-brand-300">
                {site.brand}
              </span>
            </div>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] text-white drop-shadow-sm sm:text-5xl lg:text-6xl">
              El pollo rostizado más jugoso de Chalchuapa
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-brand-50/90">
              Marinado en jugo de piña y paprika ahumada, rostizado lento hasta quedar dorado por
              fuera y jugoso por dentro. Ese es el sabor <strong>Ahumado Tropical</strong>.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row md:justify-end">
              <Link
                to="/tienda"
                className="rounded-full bg-brand-600 px-8 py-4 text-center text-lg font-bold text-white shadow-xl shadow-black/30 transition hover:-translate-y-0.5 hover:bg-brand-700"
              >
                Ver el menú
              </Link>
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border-2 border-white/70 px-8 py-4 text-center text-lg font-bold text-white backdrop-blur-sm transition hover:bg-white hover:text-brand-800"
                >
                  Pedir por WhatsApp
                </a>
              )}
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-brand-50/85 md:justify-end">
              <span className="flex items-center gap-1.5"><Leaf className="h-4 w-4 text-gold-400" /> Marinado en piña 100% natural</span>
              <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-brand-300" /> Listo en {site.prepTime}</span>
              <span className="flex items-center gap-1.5"><Bike className="h-4 w-4 text-brand-300" /> Pickup y delivery</span>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-5 flex justify-center" aria-hidden="true">
          <svg className="animate-float h-6 w-6 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </section>

      {/* ───────────────── Diferenciador ───────────────── */}
      <section className="bg-brand-50 py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2">
          <Reveal className="order-2 lg:order-1">
            <span className="font-display text-xs font-bold uppercase tracking-[0.28em] text-brand-600">
              Nuestro sello
            </span>
            <h2 className="mt-3 font-display text-3xl font-extrabold text-brand-900 sm:text-4xl">
              Un sabor que no se puede copiar
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-charcoal-700">
              {site.differentiator}
            </p>
            <div className="mt-8 space-y-5">
              {DIFERENCIA.map((d) => {
                const Icon = d.icon;
                return (
                  <div key={d.title} className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
                      <Icon className="h-6 w-6" strokeWidth={2} />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-bold text-brand-900">{d.title}</h3>
                      <p className="text-charcoal-700/80">{d.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Reveal>

          <Reveal delay={120} className="order-1 lg:order-2">
            <div className="relative">
              <div className="absolute -inset-3 -rotate-2 rounded-[2rem] bg-brand-200/50" />
              <img
                src="/images/closeup.webp"
                alt="Piel crujiente del pollo rostizado"
                className="relative aspect-4/5 w-full rounded-[1.7rem] object-cover shadow-2xl"
                loading="lazy"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────────────── Del menú ───────────────── */}
      <section className="relative overflow-hidden bg-charcoal-900 py-20 text-brand-50">
        <div className="bg-radial-warm absolute inset-0" />
        <div className="relative mx-auto max-w-6xl px-6">
          <Reveal className="text-center">
            <span className="font-display text-xs font-bold uppercase tracking-[0.28em] text-brand-300">
              Del menú
            </span>
            <h2 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">Nuestros combos</h2>
            <p className="mx-auto mt-3 max-w-xl text-brand-100/80">
              Pollo rostizado con guarniciones recién hechas. Cada combo, listo para pedir en línea.
            </p>
          </Reveal>

          <div className="mt-12 grid gap-8 lg:grid-cols-2 lg:items-center">
            <Reveal>
              <img
                src="/images/combo.webp"
                alt="Combo de pollo con arroz, plátano y yuca"
                className="aspect-square w-full rounded-[1.7rem] object-cover shadow-2xl"
                loading="lazy"
              />
            </Reveal>

            <Reveal delay={120} className="space-y-3">
              {combos.map((c) => (
                <Link
                  key={c.sku}
                  to="/tienda"
                  className="group flex items-center justify-between gap-4 rounded-2xl bg-white/5 px-5 py-4 ring-1 ring-white/10 transition hover:bg-white/10"
                >
                  <span className="font-display text-lg font-bold text-white">{c.name}</span>
                  <span className="flex items-center gap-3">
                    <span className="font-display text-lg font-bold text-brand-300">{money(c.price)}</span>
                    <span className="text-white/40 transition group-hover:translate-x-1 group-hover:text-white">→</span>
                  </span>
                </Link>
              ))}
              <Link
                to="/tienda"
                className="mt-2 flex items-center justify-center rounded-2xl bg-brand-600 px-6 py-4 text-center text-lg font-bold text-white shadow-lg shadow-brand-900/40 transition hover:-translate-y-0.5 hover:bg-brand-700"
              >
                Ver el menú completo
              </Link>
              <p className="pt-1 text-center text-sm text-brand-100/60">
                También: pollo entero, medio y cuarto, extras y bebidas.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ───────────────── Cómo funciona ───────────────── */}
      <section className="bg-brand-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal className="text-center">
            <span className="font-display text-xs font-bold uppercase tracking-[0.28em] text-brand-600">
              Fácil y rápido
            </span>
            <h2 className="mt-3 font-display text-3xl font-extrabold text-brand-900 sm:text-4xl">
              ¿Cómo funciona?
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 120} as="div">
                <div className="h-full rounded-3xl bg-white p-8 shadow-[0_10px_40px_rgba(126,50,16,0.08)] ring-1 ring-brand-100">
                  <span className="font-display text-4xl font-extrabold text-brand-200">{s.n}</span>
                  <h3 className="mt-3 font-display text-xl font-bold text-brand-900">{s.title}</h3>
                  <p className="mt-2 leading-relaxed text-charcoal-700/80">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────── Testimonios ───────────────── */}
      <Testimonials />

      {/* ───────────────── Horarios + delivery ───────────────── */}
      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-2">
          <Reveal className="rounded-3xl bg-brand-50 p-8 ring-1 ring-brand-100">
            <h2 className="font-display text-2xl font-extrabold text-brand-900">Horarios</h2>
            <ul className="mt-5 divide-y divide-brand-100">
              {site.hours.map((h) => (
                <li key={h.days} className="flex justify-between py-3">
                  <span className="font-medium text-charcoal-800">{h.days}</span>
                  <span className="text-charcoal-700/70">{h.time}</span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={120} className="rounded-3xl bg-brand-50 p-8 ring-1 ring-brand-100">
            <h2 className="font-display text-2xl font-extrabold text-brand-900">Delivery</h2>
            <p className="mt-3 text-charcoal-700">{site.delivery.note}. Tiempo estimado: {site.prepTime}.</p>
            <ul className="mt-5 space-y-2.5">
              {site.delivery.zones.map((z) => (
                <li key={z.name} className="flex justify-between rounded-xl bg-white px-4 py-3 ring-1 ring-brand-100">
                  <span className="font-medium text-charcoal-800">{z.name}</span>
                  <span className="font-display font-bold text-brand-700">{z.fee}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ───────────────── CTA final ───────────────── */}
      <section className="relative overflow-hidden">
        <img src="/images/hero.webp" alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-charcoal-900/80" />
        <Reveal className="relative mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="font-display text-3xl font-extrabold text-white sm:text-4xl">
            ¿Listo para probar el Ahumado Tropical?
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-lg text-brand-50/85">
            Hacé tu pedido en línea en minutos. Recogé en Sucursal Central o pedí a domicilio.
          </p>
          <Link
            to="/tienda"
            className="mt-8 inline-block rounded-full bg-brand-600 px-10 py-4 text-lg font-bold text-white shadow-xl shadow-black/30 transition hover:-translate-y-0.5 hover:bg-brand-700"
          >
            Ordenar ahora
          </Link>
        </Reveal>
      </section>
    </div>
  );
}
