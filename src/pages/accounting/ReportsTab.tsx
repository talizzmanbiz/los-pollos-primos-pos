import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { money, fmtDate } from '../../lib/format';
import { toCsv, downloadCsv } from '../../lib/csv';
import type { AccountingIncome, AccountingExpense } from '../../types/database';
import { monthOptions, EXPENSE_TYPE_LABELS } from './month';

const d2 = (n: number) => n.toFixed(2);

interface SalesRow {
  correlativo: number;
  fecha: string;
  tipoDoc: string;
  numDoc: string;
  nit: string;
  nombre: string;
  base: number;
  iva: number;
  total: number;
}

interface PurchaseRow extends SalesRow {
  categoria: string;
}

export default function ReportsTab() {
  const months = useMemo(() => monthOptions(), []);
  const [month, setMonth] = useState(months[0]);
  const [income, setIncome] = useState<AccountingIncome[]>([]);
  const [expense, setExpense] = useState<AccountingExpense[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const [inc, exp] = await Promise.all([
      supabase
        .from('accounting_transactions_income')
        .select('*')
        .gte('transaction_date', month.start)
        .lt('transaction_date', month.endExclusive)
        .order('transaction_date', { ascending: true }),
      supabase
        .from('accounting_transactions_expense')
        .select('*')
        .gte('transaction_date', month.start)
        .lt('transaction_date', month.endExclusive)
        .order('transaction_date', { ascending: true }),
    ]);
    setIncome(inc.data ?? []);
    setExpense(exp.data ?? []);
    setLoading(false);
  }, [month]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // ---- Registro de Ventas: contribuyentes (con NIT) itemized; consumidor final summarized per day ----
  const salesRows = useMemo<SalesRow[]>(() => {
    const withNit = income.filter((r) => r.customer_nit);
    const finalConsumers = income.filter((r) => !r.customer_nit);

    const byDay = new Map<string, { base: number; iva: number; total: number; count: number }>();
    for (const r of finalConsumers) {
      const d = r.transaction_date;
      const agg = byDay.get(d) ?? { base: 0, iva: 0, total: 0, count: 0 };
      agg.base += Number(r.base_amount_usd);
      agg.iva += Number(r.iva_amount_usd);
      agg.total += Number(r.total_amount_usd);
      agg.count += 1;
      byDay.set(d, agg);
    }

    const rows: Omit<SalesRow, 'correlativo'>[] = [];
    for (const r of withNit) {
      rows.push({
        fecha: r.transaction_date,
        tipoDoc: 'CCF',
        numDoc: r.document_number ?? '',
        nit: r.customer_nit ?? '',
        nombre: r.customer_name ?? '',
        base: Number(r.base_amount_usd),
        iva: Number(r.iva_amount_usd),
        total: Number(r.total_amount_usd),
      });
    }
    for (const [d, agg] of byDay) {
      rows.push({
        fecha: d,
        tipoDoc: 'FCF',
        numDoc: `Resumen diario (${agg.count})`,
        nit: '',
        nombre: 'Consumidor Final',
        base: agg.base,
        iva: agg.iva,
        total: agg.total,
      });
    }
    rows.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
    return rows.map((r, i) => ({ correlativo: i + 1, ...r }));
  }, [income]);

  // ---- Registro de Compras: only creditable purchases (CCF/DTE support) ----
  const purchaseRows = useMemo<PurchaseRow[]>(() => {
    return expense
      .filter((r) => r.iva_creditable)
      .map((r, i) => ({
        correlativo: i + 1,
        fecha: r.transaction_date,
        tipoDoc: r.document_type.toUpperCase(),
        numDoc: r.document_number ?? '',
        nit: r.supplier_nit ?? '',
        nombre: r.supplier_name ?? '',
        categoria: EXPENSE_TYPE_LABELS[r.expense_type] ?? r.expense_type,
        base: Number(r.base_amount_usd),
        iva: Number(r.iva_amount_usd),
        total: Number(r.total_amount_usd),
      }));
  }, [expense]);

  // ---- F-07 figures ----
  const f07 = useMemo(() => {
    const ventasGravadas = income.reduce((s, r) => s + Number(r.base_amount_usd), 0);
    const debito = income.reduce((s, r) => s + Number(r.iva_amount_usd), 0);
    const comprasGravadas = expense
      .filter((r) => r.iva_creditable)
      .reduce((s, r) => s + Number(r.base_amount_usd), 0);
    const credito = expense
      .filter((r) => r.iva_creditable)
      .reduce((s, r) => s + Number(r.iva_amount_usd), 0);
    return { ventasGravadas, debito, comprasGravadas, credito, neto: debito - credito };
  }, [income, expense]);

  // ---- F-14: 1% IVA retenido a proveedores (solo si eres Gran Contribuyente) ----
  const f14 = useMemo(() => expense.reduce((s, r) => s + Number(r.retention_amount), 0), [expense]);

  const sum = (rows: SalesRow[], k: 'base' | 'iva' | 'total') =>
    rows.reduce((s, r) => s + r[k], 0);

  function exportVentas() {
    const csv = toCsv(
      ['Correlativo', 'Fecha', 'Tipo Doc', 'N° Documento', 'NIT/DUI', 'Cliente', 'Ventas Gravadas', 'Débito Fiscal (13%)', 'Total'],
      salesRows.map((r) => [r.correlativo, r.fecha, r.tipoDoc, r.numDoc, r.nit, r.nombre, d2(r.base), d2(r.iva), d2(r.total)]),
    );
    downloadCsv(`registro-ventas-${month.value}.csv`, csv);
  }

  function exportCompras() {
    const csv = toCsv(
      ['Correlativo', 'Fecha', 'Tipo Doc', 'N° Documento', 'NIT Proveedor', 'Proveedor', 'Clasificación', 'Compras Gravadas', 'Crédito Fiscal', 'Total'],
      purchaseRows.map((r) => [r.correlativo, r.fecha, r.tipoDoc, r.numDoc, r.nit, r.nombre, r.categoria, d2(r.base), d2(r.iva), d2(r.total)]),
    );
    downloadCsv(`registro-compras-${month.value}.csv`, csv);
  }

  function exportF07() {
    const csv = toCsv(
      ['Concepto', 'Monto USD'],
      [
        [`Declaración F-07 — ${month.label}`, ''],
        ['Ventas gravadas (base sin IVA)', d2(f07.ventasGravadas)],
        ['Débito fiscal (IVA 13%)', d2(f07.debito)],
        ['Compras gravadas (base sin IVA)', d2(f07.comprasGravadas)],
        ['Crédito fiscal (IVA compras)', d2(f07.credito)],
        ['Remanente período anterior', '0.00'],
        [f07.neto >= 0 ? 'IVA a pagar' : 'Remanente para siguiente período', d2(Math.abs(f07.neto))],
      ],
    );
    downloadCsv(`F07-${month.value}.csv`, csv);
  }

  return (
    <div className="space-y-6">
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
        {loading && <span className="text-sm text-charcoal-300">Cargando…</span>}
      </div>

      {/* F-07 */}
      <div className="rounded-2xl bg-white p-6 shadow">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-charcoal-600">Declaración F-07 (IVA mensual)</h3>
          <button onClick={exportF07} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white active:bg-primary-700">
            Descargar F-07 (CSV)
          </button>
        </div>
        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          <F07Row label="Ventas gravadas (base)" value={money(f07.ventasGravadas)} />
          <F07Row label="Débito fiscal (13%)" value={money(f07.debito)} />
          <F07Row label="Compras gravadas (base)" value={money(f07.comprasGravadas)} />
          <F07Row label="Crédito fiscal (compras)" value={money(f07.credito)} />
        </div>
        <div className="mt-3 border-t border-charcoal-100 pt-3">
          <F07Row
            label={f07.neto >= 0 ? 'IVA a pagar (F-07)' : 'Remanente a favor'}
            value={money(Math.abs(f07.neto))}
            strong
          />
        </div>
      </div>

      {/* F-14: retenciones (solo aparece si hay retenciones registradas) */}
      {f14 > 0 && (
        <div className="rounded-2xl bg-white p-6 shadow">
          <h3 className="mb-2 font-semibold text-charcoal-600">Anexo F-14 — IVA retenido a proveedores</h3>
          <div className="flex justify-between">
            <span className="text-charcoal-400">Total 1% IVA retenido en el mes</span>
            <span className="text-lg font-bold text-primary-700">{money(f14)}</span>
          </div>
          <p className="mt-2 text-xs text-charcoal-300">
            Monto retenido a proveedores que debés enterar a Hacienda (F-14). Aplica solo si sos Gran Contribuyente.
          </p>
        </div>
      )}

      {/* Registro de Ventas */}
      <Register
        title="Registro de Ventas"
        subtitle="Contribuyentes (CCF) detallados · Consumidor final resumido por día"
        onExport={exportVentas}
        disabled={salesRows.length === 0}
        headers={['#', 'Fecha', 'Doc', 'N°', 'NIT', 'Cliente', 'Base', 'Débito', 'Total']}
        rows={salesRows.map((r) => [
          r.correlativo, fmtDate(r.fecha), r.tipoDoc, r.numDoc, r.nit || '—', r.nombre,
          money(r.base), money(r.iva), money(r.total),
        ])}
        totals={['', '', '', '', '', 'Totales', money(sum(salesRows, 'base')), money(sum(salesRows, 'iva')), money(sum(salesRows, 'total'))]}
      />

      {/* Registro de Compras */}
      <Register
        title="Registro de Compras"
        subtitle="Solo compras con crédito fiscal recuperable (CCF / DTE)"
        onExport={exportCompras}
        disabled={purchaseRows.length === 0}
        headers={['#', 'Fecha', 'Doc', 'N°', 'NIT', 'Proveedor', 'Base', 'Crédito', 'Total']}
        rows={purchaseRows.map((r) => [
          r.correlativo, fmtDate(r.fecha), r.tipoDoc, r.numDoc, r.nit || '—', r.nombre,
          money(r.base), money(r.iva), money(r.total),
        ])}
        totals={['', '', '', '', '', 'Totales', money(sum(purchaseRows, 'base')), money(sum(purchaseRows, 'iva')), money(sum(purchaseRows, 'total'))]}
      />

      <p className="rounded-lg bg-accent-50 px-4 py-3 text-xs text-charcoal-400">
        Los archivos CSV abren directamente en Excel (codificación UTF-8). Validá el formato de columnas
        exacto con tu contador según la versión vigente del formato DGII antes de presentar. Este sistema
        no reemplaza a un contador público.
      </p>
    </div>
  );
}

function F07Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between py-1">
      <span className={strong ? 'font-semibold text-charcoal-600' : 'text-charcoal-400'}>{label}</span>
      <span className={strong ? 'text-lg font-bold text-primary-700' : 'font-medium text-charcoal-600'}>{value}</span>
    </div>
  );
}

function Register({
  title, subtitle, onExport, disabled, headers, rows, totals,
}: {
  title: string;
  subtitle: string;
  onExport: () => void;
  disabled: boolean;
  headers: string[];
  rows: (string | number)[][];
  totals: (string | number)[];
}) {
  return (
    <div className="rounded-2xl bg-white shadow">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cream-200 p-4">
        <div>
          <h3 className="font-semibold text-charcoal-600">{title}</h3>
          <p className="text-xs text-charcoal-300">{subtitle}</p>
        </div>
        <button
          onClick={onExport}
          disabled={disabled}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white active:bg-primary-700 disabled:opacity-50"
        >
          Descargar CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-cream-100 text-charcoal-400">
            <tr>{headers.map((h, i) => (
              <th key={i} className={`px-3 py-2 ${i >= 6 ? 'text-right' : ''}`}>{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-cream-200">
            {rows.map((r, ri) => (
              <tr key={ri}>{r.map((c, ci) => (
                <td key={ci} className={`px-3 py-2 ${ci >= 6 ? 'text-right' : ''}`}>{c}</td>
              ))}</tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={headers.length} className="px-3 py-6 text-center text-charcoal-300">Sin registros este mes</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t-2 border-cream-300 bg-cream-50 font-semibold">
              <tr>{totals.map((c, i) => (
                <td key={i} className={`px-3 py-2 ${i >= 6 ? 'text-right' : ''}`}>{c}</td>
              ))}</tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
