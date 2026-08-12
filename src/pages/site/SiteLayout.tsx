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
    <div className="flex min-h-screen flex-col bg-brand-50 font-sans">
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          solid
            ? 'bg-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md'
            : 'bg-gradient-to-b from-black/55 via-black/25 to-transparent'
        }`}
      >
        <div className="site-container flex items-center justify-between gap-3 py-2">
          {/* The logo is a badge, not a disc: "LOS POLLOS PRIMOS" arcs OUTSIDE
              the orange circle. Forcing it into a square with object-cover and
              then masking it with rounded-full clipped exactly that wordmark —
              which is what looked broken. object-contain + w-auto keeps the
              842x943 artwork whole; no ring, since a circular ring would cut
              back across the same text.

              The separate text wordmark is gone on purpose: the badge already
              spells the name, and reclaiming that width is what lets the logo
              be big enough for its lettering to actually read. */}
          <Link to="/" aria-label={`${site.name} — inicio`} className="flex shrink-0 items-center">
            <img
              src="/logo-primos.png"
              alt={`${site.name} — ${site.brand}`}
              width={842}
              height={943}
              className={`h-16 w-auto object-contain transition md:h-20 ${
                solid ? '' : 'drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]'
              }`}
            />
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
              className="flex min-h-12 items-center rounded-full bg-brand-600 px-6 text-sm font-bold text-white shadow-lg shadow-brand-600/25 transition hover:-translate-y-0.5 hover:bg-brand-700"
            >
              Ordenar ahora
            </Link>
          </nav>

          {/* mobile toggle */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
            aria-controls="site-mobile-nav"
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full md:hidden ${
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

      {/* mobile overlay menu — z-40 keeps it under the z-50 header so the close
          button stays reachable. Scrollable so the links survive landscape. */}
      {/* Closed state is opacity-0 + pointer-events-none (not `invisible`) so
          the fade still plays on the way out; the links are pulled out of the
          tab order with tabIndex and hidden from screen readers with
          aria-hidden, which `pointer-events-none` alone would not do. */}
      <div
        id="site-mobile-nav"
        aria-hidden={!menuOpen}
        className={`fixed inset-0 z-40 overflow-y-auto bg-charcoal-900/98 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <nav className="flex min-h-full flex-col items-center justify-center gap-2 px-6 pt-24 pb-[max(2rem,env(safe-area-inset-bottom))]">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              tabIndex={menuOpen ? undefined : -1}
              className={({ isActive }) =>
                `flex min-h-14 w-full max-w-xs items-center justify-center rounded-2xl px-4 font-display text-2xl font-bold transition-colors sm:text-3xl ${
                  isActive ? 'text-brand-400' : 'text-white active:bg-white/10'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
          <Link
            to="/tienda"
            tabIndex={menuOpen ? undefined : -1}
            className="mt-5 flex min-h-14 w-full max-w-xs items-center justify-center rounded-full bg-brand-600 px-10 text-lg font-bold text-white shadow-lg"
          >
            Ordenar ahora
          </Link>
          {wa && (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={menuOpen ? undefined : -1}
              className="mt-2 flex min-h-12 items-center px-4 text-brand-200"
            >
              o pedí por WhatsApp
            </a>
          )}
        </nav>
      </div>

      {/* Clears the fixed header (80px phones / 96px md) with room to spare. */}
      <main className={`flex-1 ${isHome ? '' : 'pt-24 md:pt-28'}`}>
        <Outlet />
      </main>

      {/* Floating WhatsApp — hidden on /tienda* where the sticky cart bar is
          the primary CTA and would overlap it, and while the mobile menu is
          open (it used to float on top of the fullscreen nav). */}
      {wa && !pathname.startsWith('/tienda') && !menuOpen && (
        <a
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Pedir por WhatsApp"
          className="fixed right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_8px_24px_rgba(37,211,102,0.45)] transition hover:-translate-y-0.5 hover:bg-[#1ebe5b]"
          style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <svg viewBox="0 0 32 32" className="h-7 w-7 fill-current" aria-hidden="true">
            <path d="M16.004 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.257.59 4.462 1.712 6.406L3.2 28.8l6.573-1.724a12.74 12.74 0 0 0 6.23 1.587h.006c7.058 0 12.797-5.74 12.797-12.8 0-3.42-1.331-6.633-3.75-9.05a12.72 12.72 0 0 0-9.052-3.613zm0 23.306h-.005a10.58 10.58 0 0 1-5.392-1.476l-.387-.23-3.9 1.023 1.041-3.802-.252-.39a10.55 10.55 0 0 1-1.63-5.63c0-5.867 4.775-10.641 10.65-10.641 2.843 0 5.514 1.108 7.523 3.119a10.58 10.58 0 0 1 3.114 7.53c-.003 5.867-4.778 10.497-10.762 10.497zm5.838-7.953c-.32-.16-1.893-.934-2.186-1.04-.293-.107-.507-.16-.72.16-.214.32-.827 1.04-1.014 1.253-.187.214-.373.24-.693.08-.32-.16-1.352-.498-2.575-1.588-.952-.849-1.594-1.897-1.781-2.217-.187-.32-.02-.493.14-.652.144-.144.32-.374.48-.56.16-.187.214-.32.32-.534.107-.213.054-.4-.026-.56-.08-.16-.72-1.736-.987-2.377-.26-.624-.524-.54-.72-.55l-.613-.01c-.214 0-.56.08-.854.4-.293.32-1.12 1.094-1.12 2.67s1.147 3.098 1.307 3.312c.16.213 2.257 3.447 5.47 4.834.764.33 1.36.527 1.825.674.767.244 1.465.21 2.017.127.615-.092 1.893-.774 2.16-1.521.267-.747.267-1.387.187-1.521-.08-.133-.293-.213-.613-.373z" />
          </svg>
        </a>
      )}

      <Footer />
    </div>
  );
}

/**
 * Social solo-logo: sin fondo ni borde, el glifo y nada más. El área táctil de
 * 44px la da el <a>, no un círculo visible. `aria-label` porque no hay texto
 * que un lector de pantalla pueda anunciar.
 */
function SocialIcon({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="flex h-11 w-11 items-center justify-center text-brand-100/70 transition hover:text-white"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden="true">
        {children}
      </svg>
    </a>
  );
}

function Footer() {
  const wa = whatsappLink('Hola, quiero hacer un pedido 🍗');
  return (
    <footer className="relative overflow-hidden bg-charcoal-900 text-brand-50">
      <div className="bg-radial-warm">
        <div className="site-container grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            {/* Same badge rule as the header: contain, never crop to a circle. */}
            <img
              src="/logo-primos.png"
              alt={site.name}
              width={842}
              height={943}
              loading="lazy"
              className="h-20 w-auto object-contain drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]"
            />
            <p className="mt-4 text-sm leading-relaxed text-brand-100/80">
              {site.brand}. {site.differentiator.split('.')[0]}.
            </p>
          </div>

          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-widest text-brand-300">Menú</h3>
            {/* inline-flex + min-h-11 gives each footer link a 44px touch row
                without changing how the list looks. */}
            <ul className="mt-2 text-sm text-brand-100/80">
              <li><Link to="/tienda" className="inline-flex min-h-11 items-center transition hover:text-white">Ver el menú</Link></li>
              <li><Link to="/tienda/mis-pedidos" className="inline-flex min-h-11 items-center transition hover:text-white">Mis pedidos</Link></li>
              <li><Link to="/tienda/estado" className="inline-flex min-h-11 items-center transition hover:text-white">Estado del pedido</Link></li>
              <li><Link to="/nosotros" className="inline-flex min-h-11 items-center transition hover:text-white">Nosotros</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-widest text-brand-300">Horarios</h3>
            <ul className="site-rows mt-4 space-y-2.5 text-sm text-brand-100/80">
              {site.hours.map((h) => (
                <li key={h.days} className="site-row">
                  <span>{h.days}</span>
                  <span className="text-brand-200/70">{h.time}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-brand-300/70">{site.delivery.note}</p>
          </div>

          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-widest text-brand-300">Contacto</h3>
            <ul className="mt-2 text-sm text-brand-100/80">
              <li className="py-2">{site.city}</li>
              {site.mapsUrl && (
                <li>
                  <a href={site.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center transition hover:text-white">
                    Cómo llegar
                  </a>
                </li>
              )}
              {site.reviewUrl && (
                <li>
                  <a href={site.reviewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center transition hover:text-white">
                    Dejanos tu reseña
                  </a>
                </li>
              )}
              {site.whatsappNumber && (
                <li>
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center transition hover:text-white">
                    WhatsApp {site.whatsappDisplay}
                  </a>
                </li>
              )}
              {site.email && (
                <li><a href={`mailto:${site.email}`} className="inline-flex min-h-11 items-center break-all transition hover:text-white">{site.email}</a></li>
              )}
            </ul>

            {/* Redes: solo el logo, sin fondo ni borde. lucide v1 ya no incluye
                logos de marca, así que van como <path> inline igual que el botón
                de WhatsApp. El -ml-2.5 compensa el padding del área táctil para
                que el primer logo quede a ras del texto de la columna. */}
            {(site.facebook || site.instagram) && (
              <div className="-ml-2.5 mt-2 flex gap-1">
                {site.facebook && (
                  <SocialIcon href={site.facebook} label="Facebook">
                    <path d="M22.675 0h-21.35C.595 0 0 .593 0 1.325v21.351C0 23.407.595 24 1.325 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116C23.407 24 24 23.407 24 22.675V1.325C24 .593 23.407 0 22.675 0z" />
                  </SocialIcon>
                )}
                {site.instagram && (
                  <SocialIcon href={site.instagram} label="Instagram">
                    <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm7.846-10.405a1.441 1.441 0 01-2.88 0 1.44 1.44 0 012.88 0z" />
                  </SocialIcon>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="site-container flex flex-col items-center justify-between gap-3 py-5 text-center text-xs text-brand-300/60 sm:flex-row sm:text-left">
            <span>© {new Date().getFullYear()} {site.name}. Todos los derechos reservados.</span>
            <span className="flex gap-2">
              <Link to="/privacidad" className="flex min-h-11 items-center px-2 transition hover:text-white">Privacidad</Link>
              <Link to="/terminos" className="flex min-h-11 items-center px-2 transition hover:text-white">Términos</Link>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
