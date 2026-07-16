import { useState } from 'react';
import SalesReport from './SalesReport';
import MarginReport from './MarginReport';
import BatchReport from './BatchReport';

const TABS = [
  { id: 'sales', label: 'Ventas' },
  { id: 'margins', label: 'Márgenes' },
  { id: 'batches', label: 'Lotes y rendimiento' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function ReportsPage() {
  const [tab, setTab] = useState<TabId>('sales');

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-bold text-brand-900">Reportes</h1>
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
      {tab === 'sales' && <SalesReport />}
      {tab === 'margins' && <MarginReport />}
      {tab === 'batches' && <BatchReport />}
    </div>
  );
}
