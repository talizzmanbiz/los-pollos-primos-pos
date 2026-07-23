import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { money } from '../../lib/format';
import { toCsv, downloadCsv } from '../../lib/csv';
import { printReport } from '../../lib/printDoc';
import type { LedgerRow } from '../../types/database';
import { monthOptions } from './month';

const d2 = (n: number) => n.toFixed(2);
/** Signed balance: credit-nature (negative) shown in parentheses. */
const signed = (v: number) => (v >= 0 ? money(v) : `(${money(-v)})`);

export default function LedgerTab() {
  const months = useMemo(() => monthOptions(), []);
  const [month, setMonth] = useState(months[0]);
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('accounting_ledger', {
      p_start: month.start,
      p_end: month.endExclusive,
    });
    if (error) {
      alert(`Error: ${error.message}`);
      setRows([]);
    } else {
      setRows((data as LedgerRow[] | null) ?? []);
    }
    setLoading(false);
  }, [month]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const totals = useMemo(() => {
    let debits = 0, credits = 0, deudor = 0, acreedor = 0;
    for (const r of rows) {
      debits += Number(r.period_debits);
      credits += Number(r.period_credits);
      const closing = Number(r.closing_balance);
      if (closing >= 0) deudor += closing; else acreedor += -closing;
    }
    return { debits, credits, deudor, acreedor };
  }, [rows]);

  const balanced = Math.abs(totals.deudor - totals.acreedor) < 0.005;

  function printPdf() {
    printReport({
      title: 'Libro Mayor',
      subtitle: month.label,
      headers: ['Código', 'Cuenta', 'Saldo inicial', 'Débitos', 'Créditos', 'Saldo final'],
      rows: rows.map((r) => {
        const closing = Number(r.closing_balance);
        return [
          r.account_code, r.account_name, signed(Number(r.opening_balance)),
          money(Number(r.period_debits)), money(Number(r.period_credits)),
          `${money(Math.abs(closing))} ${closing === 0 ? '' : closing > 0 ? 'D' : 'A'}`,
        ];
      }),
      footer: ['', 'Totales', '', money(totals.debits), money(totals.credits), ''],
      numericFrom: 2,
      note: `Balance de comprobación — saldos deudores: ${money(totals.deudor)} · saldos acreedores: ${money(totals.acreedor)} · ${balanced ? 'cuadrado' : 'DESCUADRADO'}.`,
    });
  }

  function exportCsv() {
    const csv = toCsv(
      ['Código', 'Cuenta', 'Tipo', 'Saldo inicial', 'Débitos', 'Créditos', 'Saldo final deudor', 'Saldo final acreedor'],
      rows.map((r) => {
        const closing = Number(r.closing_balance);
        return [
          r.account_code, r.account_name, r.account_type,
          d2(Number(r.opening_balance)), d2(Number(r.period_debits)), d2(Number(r.period_credits)),
          closing >= 0 ? d2(closing) : '0.00',
          closing < 0 ? d2(-closing) : '0.00',
        ];
      }),
    );
    downloadCsv(`libro-mayor-${month.value}.csv`, csv);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <select
            value={month.value}
            onChange={(e) => setMonth(months.find((m) => m.value === e.target.value) ?? months[0])}
            className="input w-auto"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          {loading && <span className="text-sm text-charcoal-300">Cargando…</span>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={printPdf}
            disabled={rows.length === 0}
            className="btn btn-secondary btn-sm"
          >
            Imprimir / PDF
          </button>
          <button
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="btn btn-primary btn-sm active:bg-brand-700 disabled:opacity-50"
          >
            Descargar CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow">
        <table className="w-full text-left text-sm">
          <thead className="bg-cream-100 text-charcoal-400">
            <tr>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Cuenta</th>
              <th className="px-3 py-2 text-right">Saldo inicial</th>
              <th className="px-3 py-2 text-right">Débitos</th>
              <th className="px-3 py-2 text-right">Créditos</th>
              <th className="px-3 py-2 text-right">Saldo final</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200">
            {rows.map((r) => {
              const closing = Number(r.closing_balance);
              return (
                <tr key={r.account_code}>
                  <td className="px-3 py-2 text-charcoal-300">{r.account_code}</td>
                  <td className="px-3 py-2 text-charcoal-600">{r.account_name}</td>
                  <td className="px-3 py-2 text-right text-charcoal-400">{signed(Number(r.opening_balance))}</td>
                  <td className="px-3 py-2 text-right">{money(Number(r.period_debits))}</td>
                  <td className="px-3 py-2 text-right">{money(Number(r.period_credits))}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {money(Math.abs(closing))}
                    <span className="ml-1 text-xs font-normal text-charcoal-300">
                      {closing === 0 ? '' : closing > 0 ? 'D' : 'A'}
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-charcoal-300">Sin movimientos este mes</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t-2 border-cream-300 bg-cream-50 font-semibold">
              <tr>
                <td className="px-3 py-2" colSpan={3}>Totales del período</td>
                <td className="px-3 py-2 text-right">{money(totals.debits)}</td>
                <td className="px-3 py-2 text-right">{money(totals.credits)}</td>
                <td className="px-3 py-2"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Balance de Comprobación */}
      {rows.length > 0 && (
        <div className="rounded-2xl bg-white p-4 shadow">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold text-charcoal-600">Balance de Comprobación</h3>
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${
              balanced ? 'bg-olive-100 text-olive-700' : 'bg-brand-100 text-brand-800'
            }`}>
              {balanced ? '✓ Cuadrado' : '⚠️ Descuadrado'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-charcoal-400">Suma saldos deudores</span>
            <span className="font-semibold text-charcoal-600">{money(totals.deudor)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-charcoal-400">Suma saldos acreedores</span>
            <span className="font-semibold text-charcoal-600">{money(totals.acreedor)}</span>
          </div>
        </div>
      )}

      <p className="rounded-lg bg-accent-50 px-4 py-3 text-xs text-charcoal-400">
        Saldo final: <strong>D</strong> = deudor (activos/gastos), <strong>A</strong> = acreedor
        (pasivos/capital/ingresos). El saldo inicial acumula todo movimiento anterior al mes.
      </p>
    </div>
  );
}
