import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { money, fmtDate } from '../../lib/format';
import { printReport } from '../../lib/printDoc';
import type { AccountingJournalLine } from '../../types/database';
import { monthOptions } from './month';

interface Entry {
  entry_number: number;
  journal_date: string;
  description: string | null;
  lines: AccountingJournalLine[];
  debit: number;
  credit: number;
}

export default function JournalTab() {
  const months = useMemo(() => monthOptions(), []);
  const [month, setMonth] = useState(months[0]);
  const [lines, setLines] = useState<AccountingJournalLine[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('accounting_journal')
      .select('*')
      .gte('journal_date', month.start)
      .lt('journal_date', month.endExclusive)
      .order('entry_number', { ascending: true })
      .order('line_number', { ascending: true });
    setLines(data ?? []);
    setLoading(false);
  }, [month]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const entries = useMemo<Entry[]>(() => {
    const map = new Map<number, Entry>();
    for (const l of lines) {
      let e = map.get(l.entry_number);
      if (!e) {
        e = { entry_number: l.entry_number, journal_date: l.journal_date, description: l.description, lines: [], debit: 0, credit: 0 };
        map.set(l.entry_number, e);
      }
      e.lines.push(l);
      e.debit += Number(l.debit_amount);
      e.credit += Number(l.credit_amount);
    }
    return [...map.values()];
  }, [lines]);

  const grand = entries.reduce(
    (acc, e) => { acc.debit += e.debit; acc.credit += e.credit; return acc; },
    { debit: 0, credit: 0 },
  );
  const balanced = Math.abs(grand.debit - grand.credit) < 0.005;

  function printPdf() {
    printReport({
      title: 'Libro Diario',
      subtitle: month.label,
      headers: ['Fecha', 'Asiento', 'Código', 'Cuenta', 'Concepto', 'Débito', 'Crédito'],
      rows: lines.map((l) => [
        fmtDate(l.journal_date),
        `#${l.entry_number}`,
        l.account_code,
        l.account_name,
        l.description ?? '',
        Number(l.debit_amount) > 0 ? money(Number(l.debit_amount)) : '',
        Number(l.credit_amount) > 0 ? money(Number(l.credit_amount)) : '',
      ]),
      footer: ['', '', '', '', 'Totales', money(grand.debit), money(grand.credit)],
      numericFrom: 5,
      note: `Este Libro Diario corresponde a ${month.label}. ${balanced ? 'Débitos = Créditos.' : 'ADVERTENCIA: descuadrado.'}`,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={month.value}
          onChange={(e) => setMonth(months.find((m) => m.value === e.target.value) ?? months[0])}
          className="rounded-lg border border-charcoal-200 bg-white px-3 py-2 text-sm font-medium"
        >
          {months.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${
              balanced ? 'bg-olive-100 text-olive-700' : 'bg-brand-100 text-brand-800'
            }`}>
              {balanced ? '✓ Débitos = Créditos' : '⚠️ Descuadrado'} · {money(grand.debit)}
            </span>
          )}
          <button
            onClick={printPdf}
            disabled={entries.length === 0}
            className="btn btn-primary btn-sm"
          >
            Imprimir / PDF
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-charcoal-300">Cargando…</p>
      ) : entries.length === 0 ? (
        <p className="rounded-2xl bg-white p-6 text-center text-charcoal-300 shadow">Sin asientos este mes</p>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => {
            const ok = Math.abs(e.debit - e.credit) < 0.005;
            return (
              <div key={e.entry_number} className="overflow-hidden rounded-2xl bg-white shadow">
                <div className="flex items-center justify-between bg-cream-100 px-4 py-2 text-sm">
                  <span className="font-semibold text-charcoal-600">
                    Asiento #{e.entry_number} · {fmtDate(e.journal_date)}
                  </span>
                  <span className="text-charcoal-400">{e.description}</span>
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="text-charcoal-300">
                    <tr>
                      <th className="px-4 py-2">Cuenta</th>
                      <th className="px-4 py-2 text-right">Débito</th>
                      <th className="px-4 py-2 text-right">Crédito</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-200">
                    {e.lines.map((l) => (
                      <tr key={l.id}>
                        <td className="px-4 py-2">
                          <span className="text-charcoal-300">{l.account_code}</span>{' '}
                          <span className="text-charcoal-600">{l.account_name}</span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          {Number(l.debit_amount) > 0 ? money(Number(l.debit_amount)) : ''}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {Number(l.credit_amount) > 0 ? money(Number(l.credit_amount)) : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-cream-300 font-semibold">
                    <tr>
                      <td className="px-4 py-2 text-right text-charcoal-400">
                        {ok ? '' : '⚠️ '}Totales
                      </td>
                      <td className="px-4 py-2 text-right">{money(e.debit)}</td>
                      <td className="px-4 py-2 text-right">{money(e.credit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
