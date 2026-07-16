import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/database';

interface Tile {
  to: string;
  title: string;
  desc: string;
  roles: UserRole[];
  productionOnly?: boolean;
}

const TILES: Tile[] = [
  { to: '/pos', title: 'POS', desc: 'Ventas en mostrador', roles: ['admin', 'cajero'] },
  { to: '/kitchen', title: 'Cocina', desc: 'Pantalla de pedidos', roles: ['admin', 'cocina'], productionOnly: true },
  { to: '/delivery', title: 'Delivery', desc: 'Pedidos a domicilio', roles: ['admin', 'repartidor'], productionOnly: true },
  { to: '/cash', title: 'Caja', desc: 'Apertura y cierre de caja', roles: ['admin', 'cajero'] },
  { to: '/batches', title: 'Lotes de Pollo', desc: 'Compras y producción', roles: ['admin', 'cocina'], productionOnly: true },
  { to: '/inventory', title: 'Inventario', desc: 'Existencias y ajustes', roles: ['admin', 'cajero'] },
  { to: '/transfers', title: 'Transferencias', desc: 'Envíos entre sucursales', roles: ['admin'] },
  { to: '/reports', title: 'Reportes', desc: 'Ventas, márgenes y lotes', roles: ['admin'] },
  { to: '/admin', title: 'Administración', desc: 'Usuarios y catálogo', roles: [] },
];

export default function Home() {
  const { profile, location } = useAuth();
  if (!profile) return null;
  const isSuper = profile.role === 'superadmin';

  const tiles = TILES.filter((t) => {
    if (isSuper) return true;
    if (!t.roles.includes(profile.role)) return false;
    if (t.productionOnly && !location?.is_production) return false;
    return true;
  });

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold text-brand-900">
        Hola, {profile.full_name.split(' ')[0]}
      </h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="rounded-2xl bg-white p-6 shadow transition hover:shadow-md active:scale-95"
          >
            <h2 className="text-xl font-semibold text-brand-700">{t.title}</h2>
            <p className="mt-1 text-gray-500">{t.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
