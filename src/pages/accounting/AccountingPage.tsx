import { useState } from 'react';
import AccountingDashboard from './AccountingDashboard';
import IncomeTab from './IncomeTab';
import ExpenseTab from './ExpenseTab';
import JournalTab from './JournalTab';
import LedgerTab from './LedgerTab';
import ReportsTab from './ReportsTab';
import IsrTab from './IsrTab';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'income', label: 'Ingresos' },
  { id: 'expense', label: 'Gastos' },
  { id: 'journal', label: 'Libro Diario' },
  { id: 'ledger', label: 'Libro Mayor' },
  { id: 'reports', label: 'Reportes DGII' },
  { id: 'isr', label: 'ISR anual' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function AccountingPage() {
  const [tab, setTab] = useState<TabId>('dashboard');

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-bold text-primary-800">Contabilidad</h1>
          <span className="hidden text-sm text-charcoal-300 sm:inline">Ministerio de Hacienda · El Salvador</span>
        </div>
        <a
          href="/manual-contable.html"
          target="_blank"
          rel="noopener noreferrer"
          className="whitespace-nowrap rounded-lg bg-white px-3 py-2 text-sm font-semibold text-primary-700 shadow hover:bg-cream-100"
          title="Abrir el manual de usuario (imprimible)"
        >
          📄 Manual
        </a>
      </div>
      <p className="mb-6 text-sm text-charcoal-400">
        Herramienta de conformidad fiscal. No reemplaza a un contador público.
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 font-medium transition-colors ${
              tab === t.id ? 'bg-primary-600 text-white' : 'bg-white text-charcoal-500 shadow'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && <AccountingDashboard />}
      {tab === 'income' && <IncomeTab />}
      {tab === 'expense' && <ExpenseTab />}
      {tab === 'journal' && <JournalTab />}
      {tab === 'ledger' && <LedgerTab />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'isr' && <IsrTab />}
    </div>
  );
}
