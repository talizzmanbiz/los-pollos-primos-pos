import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  WorkingLocationProvider,
  useWorkingLocationContext,
} from '../context/WorkingLocationContext';
import { supabase } from '../lib/supabase';
import type { UserRole } from '../types/database';

interface NavItem {
  to: string;
  label: string;
  roles: UserRole[];       // superadmin always included
  productionOnly?: boolean; // only at Central (or superadmin)
}

const NAV: NavItem[] = [
  { to: '/pos', label: 'POS', roles: ['admin', 'cajero'] },
  { to: '/kitchen', label: 'Cocina', roles: ['admin', 'cocina'], productionOnly: true },
  { to: '/delivery', label: 'Delivery', roles: ['admin', 'repartidor'], productionOnly: true },
  { to: '/cash', label: 'Caja', roles: ['admin', 'cajero'] },
  { to: '/batches', label: 'Lotes', roles: ['admin', 'cocina'], productionOnly: true },
  { to: '/inventory', label: 'Inventario', roles: ['admin', 'cajero'] },
  { to: '/transfers', label: 'Transferencias', roles: ['admin'] },
  { to: '/reports', label: 'Reportes', roles: ['admin'] },
  { to: '/contabilidad', label: 'Contabilidad', roles: ['admin', 'contador', 'auditor'] },
  { to: '/admin', label: 'Administración', roles: ['admin'] },
];

function LocationSwitcher() {
  const { location, locations, canSwitch, setLocationId } = useWorkingLocationContext();
  if (!canSwitch) {
    return (
      <span className="text-sm font-medium text-white opacity-90">
        📍 {location ? location.name : 'Cargando…'}
      </span>
    );
  }
  return (
    <select
      value={location?.id ?? ''}
      onChange={(e) => setLocationId(e.target.value)}
      className="rounded-lg border border-cream-200/30 bg-primary-600/80 backdrop-blur px-3 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors cursor-pointer"
      title="Cambiar de sucursal"
      aria-label="Seleccionar sucursal"
    >
      {locations.map((l) => (
        <option key={l.id} value={l.id} className="bg-primary-700">
          {l.name}
        </option>
      ))}
    </select>
  );
}

export default function AppLayout() {
  const { profile, location, signOut } = useAuth();
  if (!profile) return null;

  async function handleChangePassword() {
    const newPwd = window.prompt('Nueva contraseña:');
    if (!newPwd) return;
    try {
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      alert(error ? `Error: ${error.message}` : 'Contraseña actualizada ✓');
    } catch (err) {
      alert(`Error: ${err}`);
    }
  }

  const isSuper = profile.role === 'superadmin';
  const visible = NAV.filter((item) => {
    if (isSuper) return true;
    if (!item.roles.includes(profile.role)) return false;
    if (item.productionOnly && !location?.is_production) return false;
    return true;
  });

  return (
    <WorkingLocationProvider>
      <div className="flex min-h-screen flex-col bg-gradient-to-br from-cream-100 to-cream-200">
        <header className="sticky top-0 z-40 glass border-b border-primary-200/20">
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            {/* Logo & Location */}
            <div className="flex items-center gap-4">
              <span className="text-lg sm:text-xl font-semibold text-primary-600">🍗 Pollos Primos</span>
              <div className="hidden sm:block">
                <LocationSwitcher />
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex flex-wrap items-center gap-1 overflow-x-auto flex-1 justify-center px-4 max-w-2xl">
              {visible.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `px-3 py-2 text-sm sm:text-base font-medium rounded-lg transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-primary-600 text-white'
                        : 'text-charcoal-600 hover:bg-primary-100/50'
                    }`
                  }
                  title={item.label}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* Profile & Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={handleChangePassword}
                className="hidden sm:block px-3 py-2 text-sm font-medium text-charcoal-600 hover:text-primary-600 transition-colors rounded-lg hover:bg-primary-100/40"
                title="Click para cambiar contraseña"
                aria-label={`Perfil: ${profile.full_name}`}
              >
                👤 {profile.full_name}
              </button>
              <button
                onClick={signOut}
                className="px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors active:scale-95"
                title="Cerrar sesión"
                aria-label="Salir de la sesión"
              >
                Salir
              </button>
            </div>
          </div>

          {/* Mobile location selector */}
          <div className="sm:hidden px-4 pb-3 border-t border-primary-200/20">
            <LocationSwitcher />
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </WorkingLocationProvider>
  );
}
