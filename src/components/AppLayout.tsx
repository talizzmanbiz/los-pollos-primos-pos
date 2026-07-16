import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
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
  const [showProfile, setShowProfile] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  if (!profile) return null;

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
            onClick={() => setShowProfile(true)}
            className="rounded-lg px-3 py-2 text-sm text-white hover:bg-brand-600 cursor-pointer"
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

      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-bold text-gray-900">Perfil: {profile.full_name}</h3>
            <p className="mb-4 text-sm text-gray-600">{profile.email}</p>

            <div className="mb-6 rounded-lg bg-gray-50 p-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Nueva contraseña
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Ingresá tu nueva contraseña"
                className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2"
              />
              <button
                onClick={async () => {
                  if (!newPassword.trim()) {
                    setPasswordMsg('Ingresá una contraseña');
                    return;
                  }
                  setPasswordMsg('Actualizando...');
                  try {
                    const { error } = await supabase.auth.updateUser({ password: newPassword });
                    if (error) {
                      setPasswordMsg(`Error: ${error.message}`);
                    } else {
                      setPasswordMsg('Contraseña actualizada ✓');
                      setNewPassword('');
                      setTimeout(() => setShowProfile(false), 1500);
                    }
                  } catch (err) {
                    setPasswordMsg(`Error: ${err}`);
                  }
                }}
                className="w-full rounded-lg bg-brand-600 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Cambiar contraseña
              </button>
              {passwordMsg && (
                <p className="mt-2 text-sm text-gray-600">{passwordMsg}</p>
              )}
            </div>

            <button
              onClick={() => {
                setShowProfile(false);
                setPasswordMsg(null);
                setNewPassword('');
              }}
              className="w-full rounded-lg border border-gray-300 py-2 text-gray-600 hover:bg-gray-50"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
