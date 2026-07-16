import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import PurchaseBatchesTab from './PurchaseBatchesTab';
import ProductionBatchesTab from './ProductionBatchesTab';
import TraceabilityTab from './TraceabilityTab';

const TABS = [
  { id: 'purchase', label: 'Lotes de compra' },
  { id: 'production', label: 'Lotes de producción' },
  { id: 'trace', label: 'Trazabilidad' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function BatchesPage() {
  const { location, profile } = useAuth();
  const [tab, setTab] = useState<TabId>('production');

  if (!profile) return null;
  // superadmin picks Central implicitly: batches live at the production hub
  const locationId = location?.id;
  if (!locationId && profile.role !== 'superadmin') {
    return <p className="p-6 text-lg text-gray-600">Iniciá sesión con una cuenta de sucursal.</p>;
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-brand-900">Lotes de Pollo</h1>
      <div className="mb-6 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 font-medium ${
              tab === t.id ? 'bg-brand-600 text-white' : 'bg-white text-gray-700 shadow'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'purchase' && <PurchaseBatchesTab />}
      {tab === 'production' && <ProductionBatchesTab />}
      {tab === 'trace' && <TraceabilityTab />}
    </div>
  );
}
