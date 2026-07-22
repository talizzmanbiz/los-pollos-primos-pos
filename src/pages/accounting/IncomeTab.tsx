import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { money, fmtDate } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useWorkingLocation } from '../../hooks/useWorkingLocation';
import type { AccountingIncome } from '../../types/database';
import { monthOptions } from './month';

/** Round to cents. */
const r2 = (n: number) => Math.round(n * 100) / 100;

export default function IncomeTab() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';
  const { location } = useWorkingLocation();
  const months = useMemo(() => monthOptions(), []);
  const [month, setMonth] = useState(months[0]);
  const [rows, setRows] = useState<AccountingIncome[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // manual form
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState('venta');
  const [total, setTotal] = useState('');
  const [payment, setPayment] = useState<'efectivo' | 'wompi'>('efectivo');
  const [customer, setCustomer] = useState('');
  const [docNumber, setDocNumber] = useState('');
  const [saving, setSaving] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('accounting_transactions_income')
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

  async function sync() {
    setSyncing(true);
    const { data, error } = await supabase.rpc('accounting_sync_from_pos', {});
    setSyncing(false);
    if (error) {
      alert(`Error al sincronizar: ${error.message}`);
      return;
    }
    alert(`${data ?? 0} venta(s) importada(s) del POS.`);
    refetch();
  }

  const nTotal = parseFloat(total) || 0;
  const base = r2(nTotal / 1.13);
  const iva = r2(nTotal - base);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!profile || nTotal <= 0) return;
    setSaving(true);
    const { error } = await supabase.from('accounting_transactions_income').insert({
      transaction_date: date,
      transaction_type: type,
      location_id: location?.id ?? null,
      base_amount_usd: base,
      iva_amount_usd: iva,
      total_amount_usd: nTotal,
      payment_method: payment,
      customer_name: customer.trim() || null,
      document_number: docNumber.trim() || null,
      synced_from_pos: false,
      created_by: profile.id,
    });
    setSaving(false);
    if (error) {
      alert(error.message);
      return;
    }
    setTotal('');
    setCustomer('');
    setDocNumber('');
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
          <>
            <button
              onClick={sync}
              disabled={syncing}
              className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white active:bg-brand-700 disabled:opacity-60"
            >
              {syncing ? 'Sincronizando…' : '↻ Sincronizar desde POS'}
            </button>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="rounded-lg bg-white px-4 py-2 font-semibold text-brand-700 shadow active:bg-cream-100"
            >
              {showForm ? 'Cancelar' : '+ Registrar ingreso'}
            </button>
          </>
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
            <label className="mb-1 block text-sm text-charcoal-400">Tipo</label>
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="w-full rounded-lg border border-charcoal-200 px-3 py-2">
              <option value="venta">Venta</option>
              <option value="venta_chimichurri">Venta chimichurri</option>
              <option value="otro">Otro ingreso</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-charcoal-400">Total cobrado (con IVA)</label>
            <input type="number" step="0.01" min="0.01" value={total} onChange={(e) => setTotal(e.target.value)}
              required placeholder="0.00" className="w-full rounded-lg border border-charcoal-200 px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-charcoal-400">Pago</label>
            <select value={payment} onChange={(e) => setPayment(e.target.value as 'efectivo' | 'wompi')}
              className="w-full rounded-lg border border-charcoal-200 px-3 py-2">
              <option value="efectivo">Efectivo</option>
              <option value="wompi">Wompi / tarjeta</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-charcoal-400">Cliente (opcional)</label>
            <input value={customer} onChange={(e) => setCustomer(e.target.value)}
              className="w-full rounded-lg border border-charcoal-200 px-3 py-2" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-charcoal-400">N° documento (opcional)</label>
            <input value={docNumber} onChange={(e) => setDocNumber(e.target.value)}
              className="w-full rounded-lg border border-charcoal-200 px-3 py-2" />
          </div>
          <div className="col-span-2 flex flex-wrap items-center gap-4 md:col-span-3">
            <p className="rounded-lg bg-accent-50 px-3 py-2 text-sm text-charcoal-500">
              Base: <span className="font-bold">{money(base)}</span> · IVA 13%:{' '}
              <span className="font-bold">{money(iva)}</span>
            </p>
            <button type="submit" disabled={saving || nTotal <= 0}
              className="ml-auto rounded-lg bg-brand-600 px-6 py-3 font-bold text-white active:bg-brand-700 disabled:opacity-60">
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
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3 text-right">Base</th>
              <th className="px-4 py-3 text-right">IVA</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Pago</th>
              <th className="px-4 py-3">Origen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3">{fmtDate(r.transaction_date)}</td>
                <td className="px-4 py-3">{r.document_number ?? r.transaction_type}</td>
                <td className="px-4 py-3 text-right">{money(Number(r.base_amount_usd))}</td>
                <td className="px-4 py-3 text-right text-charcoal-400">{money(Number(r.iva_amount_usd))}</td>
                <td className="px-4 py-3 text-right font-semibold">{money(Number(r.total_amount_usd))}</td>
                <td className="px-4 py-3 capitalize">{r.payment_method}</td>
                <td className="px-4 py-3">
                  {r.synced_from_pos ? (
                    <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800">POS</span>
                  ) : (
                    <span className="rounded-full bg-cream-200 px-2 py-0.5 text-xs text-charcoal-400">Manual</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-charcoal-300">Sin ingresos este mes</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t-2 border-cream-300 bg-cream-50 font-semibold">
              <tr>
                <td className="px-4 py-3" colSpan={2}>Total ({rows.length})</td>
                <td className="px-4 py-3 text-right">{money(totals.base)}</td>
                <td className="px-4 py-3 text-right">{money(totals.iva)}</td>
                <td className="px-4 py-3 text-right">{money(totals.total)}</td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
