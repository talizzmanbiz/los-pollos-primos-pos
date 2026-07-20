import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { site, whatsappLink, isPosHost } from './siteInfo';

const NAV = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/tienda', label: 'Menú' },
  { to: '/nosotros', label: 'Nosotros' },
  { to: '/contacto', label: 'Contacto' },
];

export default function SiteLayout() {
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isHome = pathname === '/';
  const solid = scrolled || !isHome;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  if (isPosHost()) return <Navigate to="/inicio" replace />;

  const wa = whatsappLink('Hola, quiero hacer un pedido 🍗');

  return (
    <div className="flex min-h-screen flex-col bg-brand-50">
      <header
        className={`fixed inset-x-0 top-0 z-40 transition-all duration-300 ${
          solid
            ? 'bg-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md'
            : 'bg-gradient-to-b from-black/55 via-black/25 to-transparent'
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img
              src="/logo-primos.png"
              alt={site.name}
              className={`h-11 w-11 rounded-full object-cover ring-2 transition ${
                solid ? 'ring-brand-200' : 'ring-white/40'
              }`}
            />
            <span
              className={`font-display text-lg font-extrabold leading-none tracking-tight transition-colors ${
                solid ? 'text-brand-900' : 'text-white drop-shadow'
              }`}
            >
              {site.name}
            </span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `text-sm font-semibold transition-colors ${
                    solid
                      ? isActive
                        ? 'text-brand-700'
                        : 'text-charcoal-700 hover:text-brand-600'
                      : isActive
                        ? 'text-white'
                        : 'text-white/80 hover:text-white'
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
            <Link
              to="/tienda"
              className="rounded-full bg-brand-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-600/25 transition hover:-translate-y-0.5 hover:bg-brand-700"
            >
              Ordenar ahora
            </Link>
          </nav>

          {/* mobile toggle */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menú"
            className={`flex h-11 w-11 items-center justify-center rounded-full md:hidden ${
              solid ? 'text-brand-900' : 'text-white'
            }`}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              {menuOpen ? (
                <>
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="6" y1="18" x2="18" y2="6" />
                </>
              ) : (
                <>
                  <line x1="3" y1="7" x2="21" y2="7" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="17" x2="21" y2="17" />
                </>
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* mobile overlay menu */}
      <div
        className={`fixed inset-0 z-30 bg-charcoal-900/98 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <nav className="flex h-full flex-col items-center justify-center gap-7">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `font-display text-3xl font-bold ${isActive ? 'text-brand-400' : 'text-white'}`
              }
            >
              {n.label}
            </NavLink>
          ))}
          <Link
            to="/tienda"
            className="mt-4 rounded-full bg-brand-600 px-10 py-4 text-lg font-bold text-white shadow-lg"
          >
            Ordenar ahora
          </Link>
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="text-brand-200">
              o pedí por WhatsApp
            </a>
          )}
        </nav>
      </div>

      <main className={`flex-1 ${isHome ? '' : 'pt-16'}`}>
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}

function Footer() {
  const wa = whatsappLink('Hola, quiero hacer un pedido 🍗');
  return (
    <footer className="relative overflow-hidden bg-charcoal-900 text-brand-50">
      <div className="bg-radial-warm">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <img src="/logo-primos.png" alt="" className="h-11 w-11 rounded-full object-cover ring-2 ring-white/20" />
              <span className="font-display text-lg font-extrabold">{site.name}</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-brand-100/80">
              {site.brand}. {site.differentiator.split('.')[0]}.
            </p>
          </div>

          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-widest text-brand-300">Menú</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-brand-100/80">
              <li><Link to="/tienda" className="transition hover:text-white">Ver el menú</Link></li>
              <li><Link to="/tienda/mis-pedidos" className="transition hover:text-white">Mis pedidos</Link></li>
              <li><Link to="/tienda/estado" className="transition hover:text-white">Estado del pedido</Link></li>
              <li><Link to="/nosotros" className="transition hover:text-white">Nosotros</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-widest text-brand-300">Horarios</h3>
            <ul className="mt-4 space-y-2 text-sm text-brand-100/80">
              {site.hours.map((h) => (
                <li key={h.days} className="flex justify-between gap-3">
                  <span>{h.days}</span>
                  <span className="text-brand-200/70">{h.time}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-brand-300/70">{site.delivery.note}</p>
          </div>

          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-widest text-brand-300">Contacto</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-brand-100/80">
              <li>{site.city}</li>
              {site.whatsappNumber && (
                <li>
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="transition hover:text-white">
                    WhatsApp {site.whatsappDisplay}
                  </a>
                </li>
              )}
              {site.email && (
                <li><a href={`mailto:${site.email}`} className="transition hover:text-white">{site.email}</a></li>
              )}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-5 text-xs text-brand-300/60 sm:flex-row">
            <span>© {new Date().getFullYear()} {site.name}. Todos los derechos reservados.</span>
            <span className="flex gap-5">
              <Link to="/privacidad" className="transition hover:text-white">Privacidad</Link>
              <Link to="/terminos" className="transition hover:text-white">Términos</Link>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
