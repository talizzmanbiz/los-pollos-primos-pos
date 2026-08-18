import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { money, fmtDate } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useWorkingLocation } from '../../hooks/useWorkingLocation';
import type { AccountingExpense, AccountingSupplier, Enums } from '../../types/database';
import { monthOptions, EXPENSE_TYPE_LABELS } from '../accounting/month';
import {
  CLASE_DOCUMENTO, TIPO_DOCUMENTO, RENTA_TIPO_OPERACION, RENTA_CLASIFICACION,
  RENTA_SECTOR, RENTA_TIPO_COSTO_GASTO, COMPRA_DEFAULTS, opciones,
} from '../../lib/mhCodes';

const r2 = (n: number) => Math.round(n * 100) / 100;
const EXPENSE_TYPES = Object.keys(EXPENSE_TYPE_LABELS) as Enums<'accounting_expense_type'>[];

/** Todo lo gravado de una compra, sin importar por dónde entró al país. */
const gravado = (r: AccountingExpense) =>
  Number(r.base_amount_usd) + Number(r.internaciones_gravadas) +
  Number(r.importaciones_gravadas_bienes) + Number(r.importaciones_gravadas_servicios);

const exento = (r: AccountingExpense) =>
  Number(r.compras_exentas) + Number(r.internaciones_exentas) + Number(r.importaciones_exentas);

const EMPTY_FORM = {
  date: new Date().toISOString().slice(0, 10),
  expenseType: 'ingredientes' as Enums<'accounting_expense_type'>,
  supplier: '',
  nit: '',
  dui: '',
  claseDoc: '4',
  tipoDoc: '03',
  docNumber: '',
  gravadas: '',
  exentas: '',
  internacionesGravadas: '',
  importacionesGravadasBienes: '',
  importacionesGravadasServicios: '',
  description: '',
  // los códigos de renta se editan en el formulario, así que van como string
  tipoOperacion: COMPRA_DEFAULTS.tipoOperacion as string,
  clasificacion: COMPRA_DEFAULTS.clasificacion as string,
  sector: COMPRA_DEFAULTS.sector as string,
  tipoCostoGasto: COMPRA_DEFAULTS.tipoCostoGasto as string,
};

export default function PurchasesTab() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';
  const { location } = useWorkingLocation();
  const months = useMemo(() => monthOptions(), []);
  const [month, setMonth] = useState(months[0]);
  const [rows, setRows] = useState<AccountingExpense[]>([]);
  const [suppliers, setSuppliers] = useState<AccountingSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState(EMPTY_FORM);

  const set = <K extends keyof typeof EMPTY_FORM>(k: K, v: (typeof EMPTY_FORM)[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

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

  useEffect(() => { refetch(); }, [refetch]);

  useEffect(() => {
    supabase.from('accounting_suppliers').select('*').order('name')
      .then(({ data }) => setSuppliers(data ?? []));
  }, []);

  // Elegir un proveedor conocido rellena NIT y los códigos de renta: son los
  // campos que más se equivocan al teclearlos compra tras compra.
  function pickSupplier(name: string) {
    set('supplier', name);
    const s = suppliers.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (!s) return;
    setF((prev) => ({
      ...prev,
      supplier: s.name,
      nit: s.nit ?? s.nrc ?? '',
      dui: s.dui ?? '',
      expenseType: s.expense_type,
      clasificacion: s.renta_clasificacion,
      sector: s.renta_sector,
      tipoCostoGasto: s.renta_tipo_costo_gasto,
    }));
  }

  const num = (v: string) => parseFloat(v) || 0;
  const totalGravado = num(f.gravadas) + num(f.internacionesGravadas) +
    num(f.importacionesGravadasBienes) + num(f.importacionesGravadasServicios);
  const iva = r2(totalGravado * 0.13);
  const total = r2(totalGravado + num(f.exentas) + iva);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!profile || total <= 0) return;
    setSaving(true);
    const { error } = await supabase.from('accounting_transactions_expense').insert({
      transaction_date: f.date,
      expense_type: f.expenseType,
      location_id: location?.id ?? null,
      base_amount_usd: r2(num(f.gravadas)),
      compras_exentas: r2(num(f.exentas)),
      internaciones_gravadas: r2(num(f.internacionesGravadas)),
      importaciones_gravadas_bienes: r2(num(f.importacionesGravadasBienes)),
      importaciones_gravadas_servicios: r2(num(f.importacionesGravadasServicios)),
      iva_rate: 0.13,
      iva_amount_usd: iva,
      total_amount_usd: total,
      is_deductible: true,
      // Sólo CCF (03) y notas de crédito (05) dan derecho a crédito fiscal.
      iva_creditable: iva > 0 && (f.tipoDoc === '03' || f.tipoDoc === '05'),
      document_type: f.tipoDoc === '03' ? 'ccf' : f.claseDoc === '4' ? 'dte' : 'factura',
      clase_documento: f.claseDoc,
      tipo_documento_mh: f.tipoDoc,
      document_number: f.docNumber.trim() || null,
      supplier_name: f.supplier.trim() || null,
      supplier_nit: f.nit.trim() || null,
      supplier_dui: f.dui.trim() || null,
      renta_tipo_operacion: f.tipoOperacion,
      renta_clasificacion: f.clasificacion,
      renta_sector: f.sector,
      renta_tipo_costo_gasto: f.tipoCostoGasto,
      description: f.description.trim() || null,
      source: 'manual',
      created_by: profile.id,
    });
    setSaving(false);
    if (error) { alert(error.message); return; }

    // Recordar el proveedor con sus códigos para la próxima compra.
    if (f.supplier.trim()) {
      await supabase.from('accounting_suppliers').upsert({
        name: f.supplier.trim(),
        nit: f.nit.trim() || null,
        dui: f.dui.trim() || null,
        expense_type: f.expenseType,
        renta_clasificacion: f.clasificacion,
        renta_sector: f.sector,
        renta_tipo_costo_gasto: f.tipoCostoGasto,
      }, { onConflict: 'nit', ignoreDuplicates: false });
    }
    setF({ ...EMPTY_FORM, date: f.date });
    setShowForm(false);
    refetch();
  }

  const totals = rows.reduce((a, r) => ({
    gravado: a.gravado + gravado(r),
    exento: a.exento + exento(r),
    iva: a.iva + Number(r.iva_amount_usd),
    total: a.total + Number(r.total_amount_usd),
  }), { gravado: 0, exento: 0, iva: 0, total: 0 });

  const sinCodigos = rows.filter((r) => r.source === 'email' && !r.supplier_nit).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={month.value}
          onChange={(e) => setMonth(months.find((m) => m.value === e.target.value) ?? months[0])}
          className="input w-auto"
        >
          {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        {isAdmin && (
          <button onClick={() => setShowForm((v) => !v)} className="btn btn-primary btn-sm">
            {showForm ? 'Cancelar' : '+ Registrar compra'}
          </button>
        )}
        {loading && <span className="text-sm text-charcoal-300">Cargando…</span>}
      </div>

      {sinCodigos > 0 && (
        <p className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-800">
          {sinCodigos} compra(s) importada(s) del correo sin NIT del proveedor. Completalas antes
          de generar el anexo.
        </p>
      )}

      {showForm && (
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 rounded-2xl bg-white p-4 shadow sm:grid-cols-2 sm:gap-4 sm:p-6 md:grid-cols-3">
          <Field label="Fecha de emisión">
            <input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} required className="input" />
          </Field>
          <Field label="Proveedor">
            <input list="proveedores" value={f.supplier} onChange={(e) => pickSupplier(e.target.value)}
              required className="input" />
            <datalist id="proveedores">
              {suppliers.map((s) => <option key={s.id} value={s.name} />)}
            </datalist>
          </Field>
          <Field label="NIT o NRC del proveedor">
            <input value={f.nit} onChange={(e) => set('nit', e.target.value)} placeholder="0614-241090-102-2"
              className="input" />
          </Field>

          <Field label="Clase de documento">
            <Select cat={CLASE_DOCUMENTO} value={f.claseDoc} onChange={(v) => set('claseDoc', v)} />
          </Field>
          <Field label="Tipo de documento">
            <Select cat={TIPO_DOCUMENTO} value={f.tipoDoc} onChange={(v) => set('tipoDoc', v)} />
          </Field>
          <Field label="N° de documento">
            <input value={f.docNumber} onChange={(e) => set('docNumber', e.target.value)}
              placeholder="DTE-03-S020P009-0000…" className="input" />
          </Field>

          <Field label="Compras internas gravadas">
            <input type="number" step="0.01" min="0" value={f.gravadas}
              onChange={(e) => set('gravadas', e.target.value)} placeholder="0.00" className="input" />
          </Field>
          <Field label="Compras internas exentas">
            <input type="number" step="0.01" min="0" value={f.exentas}
              onChange={(e) => set('exentas', e.target.value)} placeholder="0.00" className="input" />
          </Field>
          <Field label="Categoría contable">
            <select value={f.expenseType} className="input"
              onChange={(e) => set('expenseType', e.target.value as Enums<'accounting_expense_type'>)}>
              {EXPENSE_TYPES.map((t) => <option key={t} value={t}>{EXPENSE_TYPE_LABELS[t]}</option>)}
            </select>
          </Field>

          {/* Importaciones: raras en este negocio, así que van plegadas. */}
          <details className="sm:col-span-2 md:col-span-3">
            <summary className="cursor-pointer text-sm text-charcoal-400">
              Importaciones e internaciones (opcional)
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Internaciones gravadas de bienes">
                <input type="number" step="0.01" min="0" value={f.internacionesGravadas}
                  onChange={(e) => set('internacionesGravadas', e.target.value)} placeholder="0.00" className="input" />
              </Field>
              <Field label="Importaciones gravadas de bienes">
                <input type="number" step="0.01" min="0" value={f.importacionesGravadasBienes}
                  onChange={(e) => set('importacionesGravadasBienes', e.target.value)} placeholder="0.00" className="input" />
              </Field>
              <Field label="Importaciones gravadas de servicios">
                <input type="number" step="0.01" min="0" value={f.importacionesGravadasServicios}
                  onChange={(e) => set('importacionesGravadasServicios', e.target.value)} placeholder="0.00" className="input" />
              </Field>
            </div>
          </details>

          <Field label="Tipo de operación (renta)">
            <Select cat={RENTA_TIPO_OPERACION} value={f.tipoOperacion} onChange={(v) => set('tipoOperacion', v)} />
          </Field>
          <Field label="Clasificación (renta)">
            <Select cat={RENTA_CLASIFICACION} value={f.clasificacion} onChange={(v) => set('clasificacion', v)} />
          </Field>
          <Field label="Sector (renta)">
            <Select cat={RENTA_SECTOR} value={f.sector} onChange={(v) => set('sector', v)} />
          </Field>
          <Field label="Tipo de costo/gasto (renta)">
            <Select cat={RENTA_TIPO_COSTO_GASTO} value={f.tipoCostoGasto} onChange={(v) => set('tipoCostoGasto', v)} />
          </Field>
          <Field label="Detalle (opcional)">
            <input value={f.description} onChange={(e) => set('description', e.target.value)} className="input" />
          </Field>

          <div className="flex flex-wrap items-center gap-3 sm:col-span-2 md:col-span-3">
            <p className="rounded-lg bg-accent-50 px-3 py-2 text-sm text-charcoal-500">
              Crédito fiscal: <span className="font-bold">{money(iva)}</span> · Total:{' '}
              <span className="font-bold">{money(total)}</span>
            </p>
            <button type="submit" disabled={saving || total <= 0} className="btn btn-primary ml-auto">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl bg-white shadow">
        <table className="w-full min-w-max text-left text-[13px] sm:text-base">
          <thead className="bg-cream-100 text-[12px] text-charcoal-400 sm:text-sm">
            <tr>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">Fecha</th>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">Doc.</th>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">Proveedor</th>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">NIT/NRC</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums sm:px-4 sm:py-3">Gravado</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums sm:px-4 sm:py-3">Exento</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums sm:px-4 sm:py-3">Crédito fiscal</th>
              <th className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums sm:px-4 sm:py-3">Total</th>
              <th className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">Origen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">{fmtDate(r.transaction_date)}</td>
                <td className="px-3 py-2.5 text-sm text-charcoal-400 sm:px-4 sm:py-3">
                  <span className="font-medium text-charcoal-500">{r.tipo_documento_mh}</span>
                  {r.document_number ? ` ${r.document_number}` : ''}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">{r.supplier_name ?? '—'}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-sm text-charcoal-400 sm:px-4 sm:py-3">
                  {r.supplier_nit ?? r.supplier_dui ?? '—'}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums sm:px-4 sm:py-3">{money(gravado(r))}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-charcoal-400 sm:px-4 sm:py-3">{money(exento(r))}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums sm:px-4 sm:py-3">{money(Number(r.iva_amount_usd))}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums sm:px-4 sm:py-3">{money(Number(r.total_amount_usd))}</td>
                <td className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3">
                  {r.source === 'email' ? (
                    <span className="rounded-full bg-accent-50 px-2 py-0.5 text-xs font-medium text-charcoal-500">correo</span>
                  ) : (
                    <span className="text-xs text-charcoal-300">manual</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-charcoal-300">Sin compras este mes</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t-2 border-cream-300 bg-cream-50 font-semibold">
              <tr>
                <td className="whitespace-nowrap px-3 py-2.5 sm:px-4 sm:py-3" colSpan={4}>Total ({rows.length})</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums sm:px-4 sm:py-3">{money(totals.gravado)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums sm:px-4 sm:py-3">{money(totals.exento)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums sm:px-4 sm:py-3">{money(totals.iva)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums sm:px-4 sm:py-3">{money(totals.total)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="rounded-lg bg-accent-50 px-4 py-3 text-xs text-charcoal-400">
        Este registro alimenta el <strong>Anexo de Compras (anexo 3)</strong> del F-07 y el{' '}
        <strong>Libro de Compras</strong>; los dos se descargan desde Contabilidad → Reportes.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm text-charcoal-400">{label}</label>
      {children}
    </div>
  );
}

function Select({ cat, value, onChange }: {
  cat: Record<string, string>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="input">
      {opciones(cat).map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
    </select>
  );
}
