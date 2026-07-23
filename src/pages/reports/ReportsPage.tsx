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
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <h1 className="page-title mb-4">Reportes</h1>
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
      {tab === 'sales' && <SalesReport />}
      {tab === 'margins' && <MarginReport />}
      {tab === 'batches' && <BatchReport />}
    </div>
  );
}
