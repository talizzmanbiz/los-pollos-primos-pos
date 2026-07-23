import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { money } from '../../lib/format';
import { toCsv, downloadCsv } from '../../lib/csv';
import { printReport } from '../../lib/printDoc';
import type { AccountingExpense, LedgerRow } from '../../types/database';
import { EXPENSE_TYPE_LABELS } from './month';

const d2 = (n: number) => n.toFixed(2);
const COGS_TYPES = new Set(['ingredientes', 'empaques']);

/** ISR persona natural — tramos anuales vigentes (Art. 37 LISR El Salvador). */
function isrPersonaNatural(t: number): number {
  if (t <= 4064) return 0;
  if (t <= 9142.86) return (t - 4064) * 0.1;
  if (t <= 22857.14) return (t - 9142.86) * 0.2 + 507.88;
  return (t - 22857.14) * 0.3 + 3250.7;
}
/** ISR persona jurídica — 25% hasta $150,000 de renta gravada, 30% arriba (Art. 41). */
function isrPersonaJuridica(t: number): number {
  if (t <= 0) return 0;
  return t * (t <= 150000 ? 0.25 : 0.3);
}

function yearOptions(count = 4): string[] {
  const y = new Date().getFullYear();
  return Array.from({ length: count }, (_, i) => String(y - i));
}

export default function IsrTab() {
  const years = useMemo(() => yearOptions(), []);
  const [year, setYear] = useState(years[0]);
  const [persona, setPersona] = useState<'natural' | 'juridica'>('natural');
  const [ingresos, setIngresos] = useState(0);
  const [expenses, setExpenses] = useState<AccountingExpense[]>([]);
  const [loading, setLoading] = useState(true);

  const start = `${year}-01-01`;
  const end = `${Number(year) + 1}-01-01`;

  const refetch = useCallback(async () => {
    setLoading(true);
    const [ledger, exp] = await Promise.all([
      supabase.rpc('accounting_ledger', { p_start: start, p_end: end }),
      supabase
        .from('accounting_transactions_expense')
        .select('*')
        .gte('transaction_date', start)
        .lt('transaction_date', end),
    ]);
    const rows = (ledger.data as LedgerRow[] | null) ?? [];
    // ingresos = créditos del período en cuentas de ingreso (ventas base sin IVA)
    setIngresos(rows.filter((r) => r.account_type === 'ingreso').reduce((s, r) => s + Number(r.period_credits), 0));
    setExpenses(exp.data ?? []);
    setLoading(false);
  }, [start, end]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const calc = useMemo(() => {
    let cogs = 0;
    let opex = 0;
    const byCat = new Map<string, number>();
    for (const e of expenses) {
      if (!e.is_deductible) continue;
      const base = Number(e.base_amount_usd);
      if (COGS_TYPES.has(e.expense_type)) cogs += base;
      else opex += base;
      byCat.set(e.expense_type, (byCat.get(e.expense_type) ?? 0) + base);
    }
    const utilidadBruta = ingresos - cogs;
    const taxable = Math.max(0, ingresos - cogs - opex);
    const isr = persona === 'natural' ? isrPersonaNatural(taxable) : isrPersonaJuridica(taxable);
    return { cogs, opex, utilidadBruta, taxable, isr, byCat };
  }, [expenses, ingresos, persona]);

  const rate = calc.taxable > 0 ? (calc.isr / calc.taxable) * 100 : 0;

  const summaryRows: [string, number][] = [
    ['Ingresos gravables (base sin IVA)', ingresos],
    ['(−) Costo de ventas (COGS)', -calc.cogs],
    ['(=) Utilidad bruta', calc.utilidadBruta],
    ['(−) Gastos operativos deducibles', -calc.opex],
    ['(=) Utilidad imponible', calc.taxable],
    ['ISR estimado', calc.isr],
  ];

  function exportCsv() {
    downloadCsv(
      `ISR-${year}.csv`,
      toCsv(
        ['Concepto', 'Monto USD'],
        [
          [`Declaración ISR ${year} — persona ${persona}`, ''],
          ...summaryRows.map(([l, v]) => [l, d2(v)]),
        ],
      ),
    );
  }

  function printPdf() {
    printReport({
      title: `Cálculo ISR ${year}`,
      subtitle: `Persona ${persona}`,
      headers: ['Concepto', 'Monto USD'],
      rows: summaryRows.map(([l, v]) => [l, money(v)]),
      numericFrom: 1,
      note: 'Estimación derivada de los libros contables. La tarifa depende de la forma jurídica; confirmá con tu contador antes de presentar.',
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={year} onChange={(e) => setYear(e.target.value)}
          className="input w-auto">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="flex overflow-hidden rounded-lg border border-charcoal-200 text-sm">
          {(['natural', 'juridica'] as const).map((p) => (
            <button key={p} onClick={() => setPersona(p)}
              className={`tab rounded-none ${persona === p ? 'tab-on' : 'tab-off'}`}>
              Persona {p}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={printPdf} className="btn btn-secondary btn-sm">
            Imprimir / PDF
          </button>
          <button onClick={exportCsv} className="btn btn-primary btn-sm">
            Descargar CSV
          </button>
        </div>
        {loading && <span className="text-sm text-charcoal-300">Cargando…</span>}
      </div>

      <div className="rounded-2xl bg-brand-600 p-6 text-white shadow">
        <p className="text-sm opacity-90">ISR estimado {year} (persona {persona})</p>
        <p className="text-4xl font-bold">{money(calc.isr)}</p>
        <p className="mt-1 text-xs opacity-80">
          Sobre utilidad imponible {money(calc.taxable)} · tasa efectiva {rate.toFixed(1)}%
        </p>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow sm:p-6">
        <h3 className="mb-3 font-semibold text-charcoal-600">Determinación de la renta</h3>
        {summaryRows.map(([label, value], i) => {
          const isResult = label.startsWith('(=)') || label === 'ISR estimado';
          return (
            <div key={i} className={`flex justify-between py-1 ${isResult ? 'border-t border-charcoal-100 mt-1 pt-1' : ''}`}>
              <span className={isResult ? 'font-semibold text-charcoal-600' : 'text-charcoal-400'}>{label}</span>
              <span className={isResult ? 'font-bold text-brand-700' : 'font-medium text-charcoal-600'}>{money(value)}</span>
            </div>
          );
        })}
      </div>

      {calc.byCat.size > 0 && (
        <div className="rounded-2xl bg-white p-4 shadow sm:p-6">
          <h3 className="mb-3 font-semibold text-charcoal-600">Gastos deducibles por categoría</h3>
          {[...calc.byCat.entries()].sort((a, b) => b[1] - a[1]).map(([cat, v]) => (
            <div key={cat} className="flex justify-between py-1">
              <span className="text-charcoal-400">
                {EXPENSE_TYPE_LABELS[cat] ?? cat}
                {COGS_TYPES.has(cat) && <span className="ml-2 text-xs text-accent-600">(COGS)</span>}
              </span>
              <span className="font-medium text-charcoal-600">{money(v)}</span>
            </div>
          ))}
        </div>
      )}

      <p className="rounded-lg bg-accent-50 px-4 py-3 text-xs text-charcoal-400">
        Estimación anual derivada de los libros. Solo incluye gastos marcados como deducibles y registrados en
        Contabilidad — el pollo crudo comprado en el POS debe registrarse como gasto (categoría Ingredientes)
        para reflejarse aquí. La tarifa de ISR y las deducciones definitivas deben validarse con tu contador.
      </p>
    </div>
  );
}
