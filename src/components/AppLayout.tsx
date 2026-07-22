import { NavLink, Outlet } from 'react-router-dom';
import {
  Drumstick,
  ShoppingCart,
  ChefHat,
  Bike,
  Wallet,
  Package,
  Boxes,
  ArrowLeftRight,
  BarChart3,
  Calculator,
  Settings,
  MapPin,
  UserRound,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
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
  icon: LucideIcon;
  roles: UserRole[];       // superadmin always included
  productionOnly?: boolean; // only at Central (or superadmin)
}

const NAV: NavItem[] = [
  { to: '/pos', label: 'POS', icon: ShoppingCart, roles: ['admin', 'cajero'] },
  { to: '/kitchen', label: 'Cocina', icon: ChefHat, roles: ['admin', 'cocina'], productionOnly: true },
  { to: '/delivery', label: 'Delivery', icon: Bike, roles: ['admin', 'repartidor'], productionOnly: true },
  { to: '/cash', label: 'Caja', icon: Wallet, roles: ['admin', 'cajero'] },
  { to: '/batches', label: 'Lotes', icon: Package, roles: ['admin', 'cocina'], productionOnly: true },
  { to: '/inventory', label: 'Inventario', icon: Boxes, roles: ['admin', 'cajero'] },
  { to: '/transfers', label: 'Transferencias', icon: ArrowLeftRight, roles: ['admin'] },
  { to: '/reports', label: 'Reportes', icon: BarChart3, roles: ['admin'] },
  { to: '/contabilidad', label: 'Contabilidad', icon: Calculator, roles: ['admin', 'contador', 'auditor'] },
  { to: '/admin', label: 'Administración', icon: Settings, roles: ['admin'] },
];

function LocationSwitcher() {
  const { location, locations, canSwitch, setLocationId } = useWorkingLocationContext();
  if (!canSwitch) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/60 px-3 py-1.5 text-sm font-medium text-charcoal-500 shadow-sm ring-1 ring-primary-200/40 backdrop-blur">
        <MapPin className="h-4 w-4 text-primary-500" aria-hidden="true" />
        {location ? location.name : 'Cargando…'}
      </span>
    );
  }
  return (
    <div className="relative inline-flex items-center">
      <MapPin className="pointer-events-none absolute left-3 h-4 w-4 text-primary-500" aria-hidden="true" />
      <select
        value={location?.id ?? ''}
        onChange={(e) => setLocationId(e.target.value)}
        className="cursor-pointer rounded-full border-0 bg-white/70 py-2 pl-9 pr-8 text-sm font-semibold text-charcoal-600 shadow-sm ring-1 ring-primary-200/50 backdrop-blur transition-all hover:bg-white hover:ring-primary-300/60 focus:outline-none"
        title="Cambiar de sucursal"
        aria-label="Seleccionar sucursal"
      >
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </div>
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
      <div className="flex min-h-dvh flex-col bg-gradient-to-br from-cream-100 to-cream-200">
        <header className="sticky top-0 z-40 border-b border-primary-200/25 bg-cream-50/70 shadow-[0_8px_32px_rgba(44,44,44,0.08)] backdrop-blur-xl">
          {/* Row 1 — brand + sucursal · perfil + salir */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex items-center gap-2.5 whitespace-nowrap">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-md shadow-primary-600/25">
                  <Drumstick className="h-5 w-5 text-white" aria-hidden="true" />
                </span>
                <span className="hidden bg-gradient-to-r from-primary-700 to-primary-500 bg-clip-text text-lg font-extrabold tracking-tight text-transparent sm:inline sm:text-xl">
                  Pollos Primos
                </span>
              </span>
              <div className="hidden h-7 w-px bg-primary-200/50 sm:block" />
              <div className="hidden sm:block">
                <LocationSwitcher />
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={handleChangePassword}
                className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-charcoal-500 transition-colors hover:bg-white/70 hover:text-primary-700 sm:inline-flex"
                title="Click para cambiar contraseña"
                aria-label={`Perfil: ${profile.full_name}. Click para cambiar contraseña`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100/70 text-primary-600">
                  <UserRound className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="max-w-[10rem] truncate">{profile.full_name}</span>
              </button>
              <button
                onClick={signOut}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-primary-500 to-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary-600/25 transition-all hover:from-primary-600 hover:to-primary-700 hover:shadow-lg hover:shadow-primary-600/30 active:scale-95"
                title="Cerrar sesión"
                aria-label="Salir de la sesión"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Salir</span>
              </button>
            </div>
          </div>

          {/* Row 2 — navigation: single-line horizontal scroll (never collapses) */}
          <nav
            className="no-scrollbar flex items-center gap-1.5 overflow-x-auto px-3 pb-3 sm:px-5"
            aria-label="Navegación principal"
          >
            {visible.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `group inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-b from-primary-500 to-primary-600 text-white shadow-md shadow-primary-600/30'
                      : 'bg-white/50 text-charcoal-500 ring-1 ring-transparent hover:-translate-y-0.5 hover:bg-white/90 hover:text-primary-700 hover:shadow-sm hover:ring-primary-200/50'
                  }`
                }
                title={label}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Mobile sucursal selector */}
          <div className="border-t border-primary-200/20 px-4 py-2.5 sm:hidden">
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
