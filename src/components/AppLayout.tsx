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
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-charcoal-500">
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
        className="cursor-pointer rounded-lg border border-primary-200/40 bg-white/70 py-2 pl-9 pr-3 text-sm font-medium text-charcoal-600 shadow-sm backdrop-blur transition-colors hover:bg-white focus:outline-none"
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
        <header className="sticky top-0 z-40 border-b border-primary-200/20 bg-cream-50/80 backdrop-blur-xl">
          {/* Row 1 — brand + location · profile + salir */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex items-center gap-2 whitespace-nowrap text-lg font-bold text-primary-600 sm:text-xl">
                <Drumstick className="h-6 w-6 text-primary-500" aria-hidden="true" />
                <span className="hidden sm:inline">Pollos Primos</span>
              </span>
              <div className="hidden h-6 w-px bg-primary-200/40 sm:block" />
              <div className="hidden sm:block">
                <LocationSwitcher />
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={handleChangePassword}
                className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-charcoal-500 transition-colors hover:bg-primary-100/50 hover:text-primary-600 sm:inline-flex"
                title="Click para cambiar contraseña"
                aria-label={`Perfil: ${profile.full_name}. Click para cambiar contraseña`}
              >
                <UserRound className="h-4 w-4" aria-hidden="true" />
                <span className="max-w-[10rem] truncate">{profile.full_name}</span>
              </button>
              <button
                onClick={signOut}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-700 active:scale-95"
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
            className="no-scrollbar flex items-center gap-1.5 overflow-x-auto px-3 pb-2.5 sm:px-5"
            aria-label="Navegación principal"
          >
            {visible.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-charcoal-500 hover:bg-primary-100/60 hover:text-primary-700'
                  }`
                }
                title={label}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Mobile location selector */}
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
