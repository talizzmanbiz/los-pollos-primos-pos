import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/database';

function Loading() {
  return (
    <div className="flex h-screen items-center justify-center bg-amber-50">
      <p className="text-xl text-amber-900">Cargando…</p>
    </div>
  );
}

/** Requires a signed-in user with an active profile. */
export function RequireAuth() {
  const { session, profile, loading } = useAuth();
  if (loading) return <Loading />;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile || !profile.active) {
    return (
      <div className="flex h-screen items-center justify-center bg-amber-50 p-6 text-center">
        <p className="text-xl text-red-700">
          Tu cuenta no tiene un perfil activo. Contactá al administrador.
        </p>
      </div>
    );
  }
  return <Outlet />;
}

/** Restricts a route to the given roles. Superadmin always passes. */
export function RoleGuard({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { profile } = useAuth();
  if (!profile) return null;
  if (profile.role !== 'superadmin' && !roles.includes(profile.role)) {
    return <Navigate to="/inicio" replace />;
  }
  return <>{children}</>;
}

/**
 * Restricts a route to staff at the production hub (Central).
 * Superadmin passes (cross-location).
 */
export function ProductionLocationGuard({ children }: { children: ReactNode }) {
  const { profile, location } = useAuth();
  if (!profile) return null;
  if (profile.role !== 'superadmin' && !location?.is_production) {
    return <Navigate to="/inicio" replace />;
  }
  return <>{children}</>;
}
