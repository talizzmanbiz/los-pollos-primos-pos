import { Link, NavLink, Navigate, Outlet } from 'react-router-dom';
import { site, whatsappLink, isPosHost } from './siteInfo';

const NAV = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/tienda', label: 'Menú' },
  { to: '/nosotros', label: 'Nosotros' },
  { to: '/contacto', label: 'Contacto' },
];

/**
 * Public marketing layout — served on the apex domain (los-pollosprimos.com).
 * On the internal POS host (`pos.…`) it redirects to the POS dashboard, so the
 * consumer pages are apex-only and staff never land on marketing content.
 */
export default function SiteLayout() {
  if (isPosHost()) return <Navigate to="/inicio" replace />;

  const wa = whatsappLink('Hola, quiero hacer un pedido 🍗');

  return (
    <div className="flex min-h-screen flex-col bg-brand-50 text-gray-900">
      <header className="sticky top-0 z-20 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-primos.png" alt={site.name} className="h-10 w-10 rounded-full object-cover" />
            <span className="text-lg font-bold text-brand-800">{site.name}</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium sm:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  isActive ? 'text-brand-700' : 'text-gray-600 hover:text-brand-700'
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <Link
            to="/tienda"
            className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            Ordenar
          </Link>
        </div>
        {/* mobile nav */}
        <nav className="flex items-center justify-around border-t border-brand-100 px-2 py-2 text-sm font-medium sm:hidden">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                isActive ? 'text-brand-700' : 'text-gray-600'
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-12 bg-brand-900 text-brand-50">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <img src="/logo-primos.png" alt="" className="h-9 w-9 rounded-full object-cover" />
              <span className="text-lg font-bold">{site.name}</span>
            </div>
            <p className="mt-3 text-sm text-brand-200">{site.brand}</p>
            <p className="mt-1 text-sm text-brand-200">{site.city}</p>
            {site.addressLine && <p className="mt-1 text-sm text-brand-200">{site.addressLine}</p>}
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-300">Horarios</h3>
            <ul className="mt-3 space-y-1 text-sm text-brand-100">
              {site.hours.map((h) => (
                <li key={h.days} className="flex justify-between gap-4">
                  <span>{h.days}</span>
                  <span className="text-brand-200">{h.time}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-brand-300">{site.delivery.note}</p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-300">Contacto</h3>
            <ul className="mt-3 space-y-2 text-sm text-brand-100">
              {wa && (
                <li>
                  <a href={wa} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    WhatsApp{site.whatsappDisplay ? ` · ${site.whatsappDisplay}` : ''}
                  </a>
                </li>
              )}
              {site.email && (
                <li>
                  <a href={`mailto:${site.email}`} className="hover:underline">{site.email}</a>
                </li>
              )}
              {site.instagram && (
                <li>
                  <a href={site.instagram} target="_blank" rel="noopener noreferrer" className="hover:underline">Instagram</a>
                </li>
              )}
              {site.facebook && (
                <li>
                  <a href={site.facebook} target="_blank" rel="noopener noreferrer" className="hover:underline">Facebook</a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="border-t border-brand-800">
          <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-brand-300 sm:flex-row">
            <span>© {new Date().getFullYear()} {site.name}. Todos los derechos reservados.</span>
            <span className="flex gap-4">
              <Link to="/privacidad" className="hover:underline">Política de Privacidad</Link>
              <Link to="/terminos" className="hover:underline">Términos de Servicio</Link>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
