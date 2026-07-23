import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { money, fmtDateTime } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import type { AccountingPeriod, AccountingPeriodStatus, IvaMonthly } from '../../types/database';
import { monthOptions } from './month';

const STATUS_LABELS: Record<AccountingPeriodStatus, string> = {
  abierto: 'Abierto',
  revisado: 'Revisado',
  cerrado: 'Cerrado',
};
const STATUS_STYLES: Record<AccountingPeriodStatus, string> = {
  abierto: 'bg-cream-200 text-charcoal-500',
  revisado: 'bg-accent-100 text-accent-700',
  cerrado: 'bg-brand-600 text-white',
};

const ZERO: IvaMonthly = {
  year_month: null,
  total_sales_base: 0,
  iva_debito: 0,
  total_purchases_base: 0,
  iva_credito: 0,
  iva_neto: 0,
};

export default function AccountingDashboard() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';
  const canReview = isAdmin || profile?.role === 'contador';
  const months = useMemo(() => monthOptions(), []);
  const [month, setMonth] = useState(months[0]);
  const [row, setRow] = useState<IvaMonthly>(ZERO);
  const [period, setPeriod] = useState<AccountingPeriod | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    const [iva, per] = await Promise.all([
      supabase.from('accounting_iva_monthly').select('*').eq('year_month', month.start).maybeSingle(),
      supabase.from('accounting_periods').select('*').eq('year_month', month.start).maybeSingle(),
    ]);
    setRow((iva.data as IvaMonthly | null) ?? { ...ZERO, year_month: month.start });
    setPeriod((per.data as AccountingPeriod | null) ?? null);
    setLoading(false);
  }, [month]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const status: AccountingPeriodStatus = period?.status ?? 'abierto';

  async function setStatus(next: AccountingPeriodStatus) {
    const verb = next === 'cerrado' ? 'cerrar' : next === 'revisado' ? 'marcar como revisado' : 'reabrir';
    if (!window.confirm(`¿Seguro que querés ${verb} el período ${month.label}?`)) return;
    setBusy(true);
    const { error } = await supabase.rpc('accounting_set_period', { p_month: month.start, p_status: next });
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    refetch();
  }

  const n = (v: number | null) => Number(v ?? 0);
  const neto = n(row.iva_neto);
  const salesTotal = n(row.total_sales_base) + n(row.iva_debito);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
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

      {/* Period status + close controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow">
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS_STYLES[status]}`}>
            {STATUS_LABELS[status]}
          </span>
          <div className="text-xs text-charcoal-300">
            {status === 'cerrado' && period?.closed_at && `Cerrado ${fmtDateTime(period.closed_at)}`}
            {status === 'revisado' && period?.reviewed_at && `Revisado ${fmtDateTime(period.reviewed_at)}`}
            {status === 'abierto' && 'El mes admite nuevos registros'}
          </div>
        </div>
        <div className="flex gap-2">
          {canReview && status !== 'revisado' && status !== 'cerrado' && (
            <button onClick={() => setStatus('revisado')} disabled={busy}
              className="btn btn-secondary btn-sm">
              Marcar revisado
            </button>
          )}
          {isAdmin && (status !== 'cerrado' ? (
            <button onClick={() => setStatus('cerrado')} disabled={busy}
              className="btn btn-primary btn-sm">
              Cerrar mes
            </button>
          ) : (
            <button onClick={() => setStatus('abierto')} disabled={busy}
              className="btn btn-secondary btn-sm">
              Reabrir mes
            </button>
          ))}
        </div>
      </div>

      {status === 'cerrado' && (
        <p className="rounded-lg bg-brand-50 px-4 py-2 text-sm text-brand-800">
          🔒 Período cerrado — no se pueden registrar ni editar ingresos/gastos de este mes.
        </p>
      )}

      {/* Headline: IVA neto a declarar (F-07) */}
      <div
        className={`rounded-2xl p-6 shadow ${
          neto > 0 ? 'bg-brand-600 text-white' : 'bg-olive-600 text-white'
        }`}
      >
        <p className="text-sm opacity-90">
          {neto > 0 ? 'IVA neto a pagar (F-07)' : neto < 0 ? 'Crédito fiscal a favor' : 'IVA neto del mes'}
        </p>
        <p className="text-4xl font-bold">{money(Math.abs(neto))}</p>
        <p className="mt-1 text-xs opacity-80">
          IVA Débito {money(n(row.iva_debito))} − IVA Crédito {money(n(row.iva_credito))}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Ventas (base sin IVA)" value={money(n(row.total_sales_base))} />
        <Kpi label="IVA Débito (cobrado)" value={money(n(row.iva_debito))} />
        <Kpi label="Compras (base sin IVA)" value={money(n(row.total_purchases_base))} />
        <Kpi label="IVA Crédito (pagado)" value={money(n(row.iva_credito))} />
      </div>

      <div className="rounded-2xl bg-white p-4 shadow sm:p-6">
        <h3 className="section-title mb-3">Resumen del mes</h3>
        <Row label="Ventas totales (con IVA)" value={money(salesTotal)} />
        <Row label="IVA Débito Fiscal (13%)" value={money(n(row.iva_debito))} />
        <Row label="IVA Crédito Fiscal (compras)" value={money(n(row.iva_credito))} />
        <div className="mt-2 border-t border-charcoal-100 pt-2">
          <Row
            label={neto >= 0 ? 'IVA neto a declarar' : 'Crédito fiscal a arrastrar'}
            value={money(Math.abs(neto))}
            strong
          />
        </div>
      </div>

      <p className="rounded-lg bg-accent-50 px-4 py-3 text-xs text-charcoal-400">
        Los ingresos del POS se importan desde la pestaña <strong>Ingresos</strong>. El IVA se calcula
        sobre precios con IVA incluido (base = total ÷ 1.13). Conservá siempre los CCF originales.
      </p>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow">
      <p className="text-xs text-charcoal-300">{label}</p>
      <p className="mt-1 text-2xl font-bold text-charcoal-600">{value}</p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between py-1">
      <span className={strong ? 'font-semibold text-charcoal-600' : 'text-charcoal-400'}>{label}</span>
      <span className={strong ? 'text-lg font-bold text-brand-700' : 'font-medium text-charcoal-600'}>
        {value}
      </span>
    </div>
  );
}
