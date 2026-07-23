import { NavLink, Outlet } from 'react-router-dom';
import {
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
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-semibold text-brand-800 ring-1 ring-brand-200">
        <MapPin className="h-4 w-4 text-brand-500" aria-hidden="true" />
        {location ? location.name : 'Cargando…'}
      </span>
    );
  }
  return (
    <div className="relative inline-flex items-center">
      <MapPin className="pointer-events-none absolute left-3 h-4 w-4 text-brand-500" aria-hidden="true" />
      <select
        value={location?.id ?? ''}
        onChange={(e) => setLocationId(e.target.value)}
        className="cursor-pointer rounded-full border-0 bg-brand-50 py-2 pl-9 pr-8 text-sm font-semibold text-brand-800 ring-1 ring-brand-200 transition-all hover:bg-brand-100 hover:ring-brand-300 focus:outline-none"
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
      <div className="flex h-dvh flex-col overflow-hidden bg-brand-50/40 font-sans">
        <header className="sticky top-0 z-40 border-b border-brand-100 bg-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.06)] backdrop-blur-md">
          {/* Row 1 — brand + sucursal · perfil + salir */}
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex items-center gap-2.5 whitespace-nowrap">
                <img
                  src="/logo-primos.png"
                  alt="Los Pollos Primos"
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-brand-200"
                />
                <span className="hidden font-display text-lg font-extrabold leading-none tracking-tight text-charcoal-800 sm:inline">
                  Los Pollos Primos
                </span>
              </span>
              <div className="hidden h-7 w-px bg-brand-200/70 sm:block" />
              <div className="hidden sm:block">
                <LocationSwitcher />
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={handleChangePassword}
                className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-charcoal-500 transition-colors hover:bg-brand-50 hover:text-brand-700 sm:inline-flex"
                title="Click para cambiar contraseña"
                aria-label={`Perfil: ${profile.full_name}. Click para cambiar contraseña`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                  <UserRound className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="max-w-[10rem] truncate">{profile.full_name}</span>
              </button>
              <button
                onClick={signOut}
                className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand-600/25 transition-all hover:-translate-y-0.5 hover:bg-brand-700 active:translate-y-0"
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
                  `inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-md shadow-brand-600/25'
                      : 'text-charcoal-500 hover:-translate-y-0.5 hover:bg-brand-50 hover:text-brand-700'
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
          <div className="border-t border-brand-100 px-4 py-2.5 sm:hidden">
            <LocationSwitcher />
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col overflow-auto">
          <Outlet />
        </main>
      </div>
    </WorkingLocationProvider>
  );
}
