import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { money, fmtDate } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useWorkingLocation } from '../../hooks/useWorkingLocation';
import type { AccountingExpense, Enums } from '../../types/database';
import { monthOptions, EXPENSE_TYPE_LABELS, DOC_TYPE_LABELS } from './month';

const r2 = (n: number) => Math.round(n * 100) / 100;
const EXPENSE_TYPES = Object.keys(EXPENSE_TYPE_LABELS) as Enums<'accounting_expense_type'>[];
const DOC_TYPES = Object.keys(DOC_TYPE_LABELS) as Enums<'accounting_doc_type'>[];

export default function ExpenseTab() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';
  const { location } = useWorkingLocation();
  const months = useMemo(() => monthOptions(), []);
  const [month, setMonth] = useState(months[0]);
  const [rows, setRows] = useState<AccountingExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // form
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [expenseType, setExpenseType] = useState<Enums<'accounting_expense_type'>>('ingredientes');
  const [supplier, setSupplier] = useState('');
  const [nit, setNit] = useState('');
  const [docType, setDocType] = useState<Enums<'accounting_doc_type'>>('ccf');
  const [docNumber, setDocNumber] = useState('');
  const [baseInput, setBaseInput] = useState('');
  const [hasIva, setHasIva] = useState(true);
  const [deductible, setDeductible] = useState(true);
  const [creditable, setCreditable] = useState(true);
  const [retain, setRetain] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('accounting_transactions_expense')
      .select('*')
      .gte('transaction_date', month.start)
      .lt('transaction_date', month.endExclusive)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false });
    setRows(data ?? []);
    setLoading(false);
  }, [month]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const base = parseFloat(baseInput) || 0;
  const iva = hasIva ? r2(base * 0.13) : 0;
  const total = r2(base + iva);
  const ccfWarning = creditable && docType !== 'ccf' && docType !== 'dte';
  // Gran Contribuyente retiene 1% del IVA en compras gravadas > $100
  const retentionEligible = hasIva && creditable && base > 100;
  const retention = retain && retentionEligible ? r2(base * 0.01) : 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!profile || base <= 0) return;
    setSaving(true);
    const { error } = await supabase.from('accounting_transactions_expense').insert({
      transaction_date: date,
      expense_type: expenseType,
      location_id: location?.id ?? null,
      base_amount_usd: r2(base),
      iva_rate: hasIva ? 0.13 : null,
      iva_amount_usd: iva,
      total_amount_usd: total,
      is_deductible: deductible,
      iva_creditable: hasIva && creditable,
      retention_amount: retention,
      document_type: docType,
      document_number: docNumber.trim() || null,
      supplier_name: supplier.trim() || null,
      supplier_nit: nit.trim() || null,
      created_by: profile.id,
    });
    setSaving(false);
    if (error) {
      alert(error.message);
      return;
    }
    setSupplier('');
    setNit('');
    setDocNumber('');
    setBaseInput('');
    setRetain(false);
    setShowForm(false);
    refetch();
  }

  const totals = rows.reduce(
    (acc, r) => {
      acc.base += Number(r.base_amount_usd);
      acc.iva += Number(r.iva_amount_usd);
      acc.total += Number(r.total_amount_usd);
      return acc;
    },
    { base: 0, iva: 0, total: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={month.value}
          onChange={(e) => setMonth(months.find((m) => m.value === e.target.value) ?? months[0])}
          className="rounded-lg border border-charcoal-200 bg-white px-3 py-2 text-sm font-medium"
        >
          {months.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        {isAdmin && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-primary-600 px-4 py-2 font-semibold text-white active:bg-primary-700"
          >
            {showForm ? 'Cancelar' : '+ Registrar gasto'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={submit} className="grid grid-cols-2 gap-4 rounded-2xl bg-white p-6 shadow md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-charcoal-400">Fecha</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
              className="w-full rounded-lg border border-charcoal-200 px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-charcoal-400">Categoría</label>
            <select value={expenseType} onChange={(e) => setExpenseType(e.target.value as Enums<'accounting_expense_type'>)}
              className="w-full rounded-lg border border-charcoal-200 px-3 py-2">
              {EXPENSE_TYPES.map((t) => <option key={t} value={t}>{EXPENSE_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-charcoal-400">Monto base (sin IVA)</label>
            <input type="number" step="0.01" min="0.01" value={baseInput} onChange={(e) => setBaseInput(e.target.value)}
              required placeholder="0.00" className="w-full rounded-lg border border-charcoal-200 px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-charcoal-400">Proveedor</label>
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)}
              className="w-full rounded-lg border border-charcoal-200 px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-charcoal-400">NIT proveedor</label>
            <input value={nit} onChange={(e) => setNit(e.target.value)}
              className="w-full rounded-lg border border-charcoal-200 px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-charcoal-400">Documento</label>
            <div className="flex gap-2">
              <select value={docType} onChange={(e) => setDocType(e.target.value as Enums<'accounting_doc_type'>)}
                className="rounded-lg border border-charcoal-200 px-2 py-2">
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
              </select>
              <input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} placeholder="N°"
                className="w-full rounded-lg border border-charcoal-200 px-3 py-2" />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-charcoal-500">
            <input type="checkbox" checked={hasIva} onChange={(e) => setHasIva(e.target.checked)} />
            Tiene IVA 13%
          </label>
          <label className="flex items-center gap-2 text-sm text-charcoal-500">
            <input type="checkbox" checked={deductible} onChange={(e) => setDeductible(e.target.checked)} />
            Deducible (ISR)
          </label>
          <label className={`flex items-center gap-2 text-sm ${hasIva ? 'text-charcoal-500' : 'text-charcoal-200'}`}>
            <input type="checkbox" checked={creditable} disabled={!hasIva}
              onChange={(e) => setCreditable(e.target.checked)} />
            Crédito fiscal recuperable
          </label>
          <label className={`flex items-center gap-2 text-sm ${retentionEligible ? 'text-charcoal-500' : 'text-charcoal-200'}`}>
            <input type="checkbox" checked={retain} disabled={!retentionEligible}
              onChange={(e) => setRetain(e.target.checked)} />
            Retención IVA 1% (Gran Contribuyente)
          </label>

          {ccfWarning && (
            <p className="col-span-2 rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-800 md:col-span-3">
              ⚠️ El crédito fiscal requiere un <strong>CCF o DTE</strong> como soporte. Con “{DOC_TYPE_LABELS[docType]}”
              no es recuperable ante Hacienda.
            </p>
          )}

          <div className="col-span-2 flex flex-wrap items-center gap-4 md:col-span-3">
            <p className="rounded-lg bg-accent-50 px-3 py-2 text-sm text-charcoal-500">
              IVA: <span className="font-bold">{money(iva)}</span> · Total:{' '}
              <span className="font-bold">{money(total)}</span>
              {retention > 0 && (
                <span className="text-charcoal-400"> · Retención 1%: <span className="font-bold">{money(retention)}</span> · Pago neto: <span className="font-bold">{money(total - retention)}</span></span>
              )}
            </p>
            <button type="submit" disabled={saving || base <= 0}
              className="ml-auto rounded-lg bg-primary-600 px-6 py-3 font-bold text-white active:bg-primary-700 disabled:opacity-60">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl bg-white shadow">
        <table className="w-full text-left">
          <thead className="bg-cream-100 text-sm text-charcoal-400">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3">Proveedor</th>
              <th className="px-4 py-3">Doc.</th>
              <th className="px-4 py-3 text-right">Base</th>
              <th className="px-4 py-3 text-right">IVA</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Crédito</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3">{fmtDate(r.transaction_date)}</td>
                <td className="px-4 py-3">{EXPENSE_TYPE_LABELS[r.expense_type] ?? r.expense_type}</td>
                <td className="px-4 py-3">{r.supplier_name ?? '—'}</td>
                <td className="px-4 py-3 text-sm text-charcoal-400">
                  {r.document_type.toUpperCase()}{r.document_number ? ` ${r.document_number}` : ''}
                </td>
                <td className="px-4 py-3 text-right">{money(Number(r.base_amount_usd))}</td>
                <td className="px-4 py-3 text-right text-charcoal-400">{money(Number(r.iva_amount_usd))}</td>
                <td className="px-4 py-3 text-right font-semibold">{money(Number(r.total_amount_usd))}</td>
                <td className="px-4 py-3">
                  {r.iva_creditable ? (
                    <span className="rounded-full bg-olive-100 px-2 py-0.5 text-xs font-medium text-olive-700">Sí</span>
                  ) : (
                    <span className="text-xs text-charcoal-300">—</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-charcoal-300">Sin gastos este mes</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t-2 border-cream-300 bg-cream-50 font-semibold">
              <tr>
                <td className="px-4 py-3" colSpan={4}>Total ({rows.length})</td>
                <td className="px-4 py-3 text-right">{money(totals.base)}</td>
                <td className="px-4 py-3 text-right">{money(totals.iva)}</td>
                <td className="px-4 py-3 text-right">{money(totals.total)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
