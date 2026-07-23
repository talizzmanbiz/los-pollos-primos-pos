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
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <h1 className="page-title mb-4">Lotes de Pollo</h1>
      <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`tab ${
              tab === t.id ? 'tab-on' : 'tab-off'
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
