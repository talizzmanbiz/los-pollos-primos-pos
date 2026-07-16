import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
  { to: '/admin', label: 'Administración', roles: [] }, // superadmin only
];

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
    <div className="flex min-h-screen flex-col bg-brand-50">
      <header className="flex items-center justify-between gap-2 bg-brand-700 px-4 py-2 text-white">
        <div className="flex items-baseline gap-3">
          <span className="text-lg font-bold">Los Pollos Primos</span>
          <span className="text-sm opacity-80">
            {location ? location.name : 'Todas las sucursales'}
          </span>
        </div>
        <nav className="flex flex-wrap items-center gap-1 overflow-x-auto">
          {visible.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-base font-medium ${
                  isActive ? 'bg-white text-brand-700' : 'hover:bg-brand-600'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <button
            onClick={handleChangePassword}
            className="rounded-lg px-3 py-2 text-sm text-white hover:bg-brand-600 cursor-pointer"
            title="Click para cambiar contraseña"
          >
            {profile.full_name}
          </button>
          <button
            onClick={signOut}
            className="rounded-lg bg-brand-800 px-3 py-2 text-sm hover:bg-brand-900"
          >
            Salir
          </button>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
