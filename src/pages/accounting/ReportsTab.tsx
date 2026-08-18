import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { money, fmtDate } from '../../lib/format';
import { toCsv, downloadCsv } from '../../lib/csv';
import {
  anexoComprasCsv, anexoConsumidorFinalCsv, anexoContribuyentesCsv, downloadAnexo,
  libroCompras, libroCompraCells, LIBRO_COMPRAS_HEADERS,
} from '../../lib/hacienda';
import { VENTA_DEFAULTS } from '../../lib/mhCodes';
import type {
  AccountingIncome, AccountingExpense, DteDocument, FiscalSettings,
} from '../../types/database';
import { monthOptions } from './month';

const d2 = (n: number) => n.toFixed(2);
const round2 = (n: number) => Math.round(n * 100) / 100;

// Pago a cuenta del ISR: 1.75% sobre los ingresos brutos, sin deducción alguna
// (Art. 151 Código Tributario). Es un anticipo acreditable contra el ISR anual.
const PAGO_A_CUENTA_RATE = 0.0175;

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


export default function ReportsTab() {
  const months = useMemo(() => monthOptions(), []);
  const [month, setMonth] = useState(months[0]);
  const [income, setIncome] = useState<AccountingIncome[]>([]);
  const [expense, setExpense] = useState<AccountingExpense[]>([]);
  const [dtes, setDtes] = useState<DteDocument[]>([]);
  const [fiscal, setFiscal] = useState<FiscalSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('fiscal_settings').select('*').maybeSingle()
      .then(({ data }) => setFiscal(data));
  }, []);

  const refetch = useCallback(async () => {
    setLoading(true);
    const [inc, exp, dte] = await Promise.all([
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
      supabase
        .from('dte_documents')
        .select('*')
        .gte('fecha_emision', month.start)
        .lt('fecha_emision', month.endExclusive)
        .eq('estado', 'procesado')
        .order('numero_control', { ascending: true }),
    ]);
    setIncome(inc.data ?? []);
    setExpense(exp.data ?? []);
    setDtes(dte.data ?? []);
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

  // ---- Libro de Compras (Art. 141 CT): TODAS las compras con documento, no
  // sólo las que dan crédito fiscal. El libro es el registro completo; el
  // crédito fiscal es una columna dentro de él.
  const purchaseRows = useMemo(
    () => libroCompras(
      expense
        .filter((r) => r.document_type !== 'ninguno')
        .map((r) => ({
          fecha: r.transaction_date,
          numeroDocumento: r.document_number ?? '',
          tipoDocumento: r.tipo_documento_mh,
          // El formulario pide "NIT o NRC" en un solo campo; si el proveedor es
          // persona natural sin NRC queda el DUI.
          nrcProveedor: r.supplier_nit ?? r.supplier_dui ?? '',
          nombreProveedor: r.supplier_name ?? '',
          exentasInternas: Number(r.compras_exentas),
          exentasImportadas: Number(r.internaciones_exentas) + Number(r.importaciones_exentas),
          gravadasInternas: Number(r.base_amount_usd),
          gravadasImportadas: Number(r.internaciones_gravadas) +
            Number(r.importaciones_gravadas_bienes) + Number(r.importaciones_gravadas_servicios),
          creditoFiscal: Number(r.iva_amount_usd),
          // El sistema guarda un solo campo de 1% por compra. En una compra a
          // Gran Contribuyente ese 1% es percepción, que para nosotros es
          // anticipo a cuenta. Si se usó para registrar retenciones hechas a
          // proveedores, va en el registro de retenciones, no acá.
          anticipoIvaPercibido: Number(r.retention_amount),
          totalCompras: Number(r.total_amount_usd),
        })),
    ),
    [expense],
  );

  // Un total por columna: el libro debe sumar en vertical igual que la hoja.
  const purchaseTotals = useMemo(
    () => purchaseRows.reduce((a, r) => ({
      exentasInternas: a.exentasInternas + r.exentasInternas,
      exentasImportadas: a.exentasImportadas + r.exentasImportadas,
      gravadasInternas: a.gravadasInternas + r.gravadasInternas,
      gravadasImportadas: a.gravadasImportadas + r.gravadasImportadas,
      creditoFiscal: a.creditoFiscal + r.creditoFiscal,
      anticipoIvaPercibido: a.anticipoIvaPercibido + r.anticipoIvaPercibido,
      totalCompras: a.totalCompras + r.totalCompras,
      sujetosExcluidos: a.sujetosExcluidos + r.sujetosExcluidos,
    }), {
      exentasInternas: 0, exentasImportadas: 0, gravadasInternas: 0, gravadasImportadas: 0,
      creditoFiscal: 0, anticipoIvaPercibido: 0, totalCompras: 0, sujetosExcluidos: 0,
    }),
    [purchaseRows],
  );

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

  // ---- F-14: Pago a Cuenta e Impuesto Retenido (renta, mensual) ----
  // Ingresos brutos = ventas del mes SIN IVA (el IVA débito no es ingreso, es un
  // pasivo a enterar). El sistema no registra retenciones de renta a terceros
  // (planilla, servicios profesionales), así que ese renglón queda en 0.
  const f14 = useMemo(() => {
    const ingresosBrutos = income.reduce((s, r) => s + Number(r.base_amount_usd), 0);
    const pagoACuenta = round2(ingresosBrutos * PAGO_A_CUENTA_RATE);
    const rentaRetenida = 0;
    return { ingresosBrutos, pagoACuenta, rentaRetenida, total: round2(pagoACuenta + rentaRetenida) };
  }, [income]);

  // 1% de IVA retenido a proveedores (Gran Contribuyente). NO es el F-14: la
  // retención de IVA se declara junto con el F-07, no en la declaración de renta.
  const ivaRetenido = useMemo(
    () => expense.reduce((s, r) => s + Number(r.retention_amount), 0),
    [expense],
  );

  const sum = (rows: SalesRow[], k: 'base' | 'iva' | 'total') =>
    rows.reduce((s, r) => s + r[k], 0);

  function exportVentas() {
    const csv = toCsv(
      ['Correlativo', 'Fecha', 'Tipo Doc', 'N° Documento', 'NIT/DUI', 'Cliente', 'Ventas Gravadas', 'Débito Fiscal (13%)', 'Total'],
      salesRows.map((r) => [r.correlativo, r.fecha, r.tipoDoc, r.numDoc, r.nit, r.nombre, d2(r.base), d2(r.iva), d2(r.total)]),
    );
    downloadCsv(`registro-ventas-${month.value}.csv`, csv);
  }

  function exportLibroCompras() {
    const csv = toCsv([...LIBRO_COMPRAS_HEADERS], purchaseRows.map(libroCompraCells));
    downloadCsv(`libro-compras-${month.value}.csv`, csv);
  }

  // ============================================================
  // Anexos oficiales del F-07 (formato exacto del MH: ; sin encabezados)
  // ============================================================

  /** Anexo 3 — compras. Incluye exentas: el anexo no es sólo del crédito fiscal. */
  function exportAnexoCompras() {
    const rows = expense.filter((r) => r.document_type !== 'ninguno');
    downloadAnexo(
      `ANEXO-COMPRAS-${month.value}.csv`,
      anexoComprasCsv(rows.map((r) => ({
        fecha: r.transaction_date,
        claseDocumento: r.clase_documento,
        tipoDocumento: r.tipo_documento_mh,
        numeroDocumento: r.document_number ?? '',
        nitProveedor: r.supplier_nit ?? '',
        nombreProveedor: r.supplier_name ?? '',
        comprasExentas: Number(r.compras_exentas),
        internacionesExentas: Number(r.internaciones_exentas),
        importacionesExentas: Number(r.importaciones_exentas),
        comprasGravadas: Number(r.base_amount_usd),
        internacionesGravadas: Number(r.internaciones_gravadas),
        importacionesGravadasBienes: Number(r.importaciones_gravadas_bienes),
        importacionesGravadasServicios: Number(r.importaciones_gravadas_servicios),
        creditoFiscal: Number(r.iva_amount_usd),
        totalCompras: Number(r.total_amount_usd),
        duiProveedor: r.supplier_dui ?? '',
        tipoOperacion: r.renta_tipo_operacion,
        clasificacion: r.renta_clasificacion,
        sector: r.renta_sector,
        tipoCostoGasto: r.renta_tipo_costo_gasto,
      }))),
    );
  }

  /** Anexo 2 — consumidor final: un renglón por día con el rango de documentos. */
  function exportAnexoConsumidorFinal() {
    const porDia = new Map<string, DteDocument[]>();
    for (const d of dtes.filter((x) => x.tipo_dte === '01')) {
      const lista = porDia.get(d.fecha_emision) ?? [];
      lista.push(d);
      porDia.set(d.fecha_emision, lista);
    }
    const rows = [...porDia.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([fecha, docs]) => {
        // Los números de control llevan 15 dígitos con ceros a la izquierda,
        // así que ordenarlos como texto es ordenarlos numéricamente.
        const nums = docs.map((d) => d.numero_control).sort();
        const sum = (k: 'total_gravado' | 'total_exento' | 'total_iva' | 'total_pagar') =>
          docs.reduce((s, d) => s + Number(d[k]), 0);
        return {
          fecha,
          claseDocumento: '4',            // DTE
          tipoDocumento: '01',            // factura
          numeroResolucion: fiscal?.num_resolucion ?? '',
          serieDocumento: fiscal?.serie_documento ?? '',
          controlInternoDel: nums[0],
          controlInternoAl: nums[nums.length - 1],
          numeroDocumentoDel: nums[0],
          numeroDocumentoAl: nums[nums.length - 1],
          maquinaRegistradora: '',
          ventasExentas: sum('total_exento'),
          ventasExentasNoProporcionalidad: 0,
          ventasNoSujetas: 0,
          // En la factura de consumidor final el IVA va incluido en el precio, así
          // que el anexo reporta la venta gravada CON IVA (por eso en la plantilla
          // oficial la columna de gravadas y la de total coinciden).
          ventasGravadas: sum('total_gravado') + sum('total_iva'),
          exportacionesCentroamerica: 0,
          exportacionesFueraCentroamerica: 0,
          exportacionesServicio: 0,
          ventasZonasFrancas: 0,
          ventasTerceros: 0,
          totalVentas: sum('total_pagar'),
          tipoOperacion: VENTA_DEFAULTS.tipoOperacion,
          tipoIngreso: VENTA_DEFAULTS.tipoIngreso,
        };
      });
    downloadAnexo(`ANEXO-CONSUMIDOR-FINAL-${month.value}.csv`, anexoConsumidorFinalCsv(rows));
  }

  /** Anexo 1 — contribuyentes: un renglón por CCF emitido. */
  function exportAnexoContribuyentes() {
    const rows = dtes.filter((d) => d.tipo_dte === '03').map((d) => ({
      fecha: d.fecha_emision,
      claseDocumento: '4',
      tipoDocumento: '03',
      numeroResolucion: fiscal?.num_resolucion ?? '',
      serieDocumento: fiscal?.serie_documento ?? '',
      numeroDocumento: d.numero_control,
      controlInterno: d.numero_control,
      nitCliente: d.receptor_nit ?? d.receptor_nrc ?? '',
      nombreCliente: d.receptor_nombre ?? '',
      ventasExentas: Number(d.total_exento),
      ventasNoSujetas: 0,
      ventasGravadas: Number(d.total_gravado),
      debitoFiscal: Number(d.total_iva),
      ventasTerceros: 0,
      debitoTerceros: 0,
      totalVentas: Number(d.total_pagar),
      duiCliente: '',
      tipoOperacion: VENTA_DEFAULTS.tipoOperacion,
      tipoIngreso: VENTA_DEFAULTS.tipoIngreso,
    }));
    downloadAnexo(`ANEXO-CONTRIBUYENTES-${month.value}.csv`, anexoContribuyentesCsv(rows));
  }

  const cfCount = dtes.filter((d) => d.tipo_dte === '01').length;
  const ccfCount = dtes.filter((d) => d.tipo_dte === '03').length;
  const comprasCount = expense.filter((r) => r.document_type !== 'ninguno').length;

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

  function exportF14() {
    const csv = toCsv(
      ['Concepto', 'Monto USD'],
      [
        [`Declaración F-14 (Pago a Cuenta e Impuesto Retenido) — ${month.label}`, ''],
        ['Ingresos brutos del mes (base sin IVA)', d2(f14.ingresosBrutos)],
        ['Tasa de pago a cuenta', '1.75%'],
        ['Pago a cuenta (1.75%)', d2(f14.pagoACuenta)],
        ['ISR retenido a terceros', d2(f14.rentaRetenida)],
        ['Total a pagar (F-14)', d2(f14.total)],
      ],
    );
    downloadCsv(`F14-${month.value}.csv`, csv);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
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

      {/* Anexos oficiales — lo que realmente se sube al portal del MH */}
      <div className="rounded-2xl bg-white p-4 shadow sm:p-6">
        <h3 className="section-title mb-1">Anexos del F-07 (archivos para el MH)</h3>
        <p className="mb-3 text-xs text-charcoal-300">
          Formato oficial: separado por punto y coma, sin encabezados, códigos puros.
          Se cargan tal cual en el portal de Hacienda.
        </p>
        {!fiscal && (
          <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
            Falta configurar la identidad fiscal (NIT, NRC, resolución y serie) antes de
            generar los anexos de ventas.
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          <AnexoButton
            n={1} title="Contribuyentes" count={ccfCount} unit="CCF"
            onClick={exportAnexoContribuyentes}
          />
          <AnexoButton
            n={2} title="Consumidor final" count={cfCount} unit="facturas"
            onClick={exportAnexoConsumidorFinal}
          />
          <AnexoButton
            n={3} title="Compras" count={comprasCount} unit="documentos"
            onClick={exportAnexoCompras}
          />
        </div>
      </div>

      {/* F-07 */}
      <div className="rounded-2xl bg-white p-4 shadow sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="section-title">Declaración F-07 (IVA mensual)</h3>
          <button onClick={exportF07} className="btn btn-primary btn-sm">
            Descargar F-07 (CSV)
          </button>
        </div>
        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          <SummaryRow label="Ventas gravadas (base)" value={money(f07.ventasGravadas)} />
          <SummaryRow label="Débito fiscal (13%)" value={money(f07.debito)} />
          <SummaryRow label="Compras gravadas (base)" value={money(f07.comprasGravadas)} />
          <SummaryRow label="Crédito fiscal (compras)" value={money(f07.credito)} />
        </div>
        <div className="mt-3 border-t border-charcoal-100 pt-3">
          <SummaryRow
            label={f07.neto >= 0 ? 'IVA a pagar (F-07)' : 'Remanente a favor'}
            value={money(Math.abs(f07.neto))}
            strong
          />
        </div>
      </div>

      {/* F-14: Pago a Cuenta e Impuesto Retenido (renta, mensual) */}
      <div className="rounded-2xl bg-white p-4 shadow sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="section-title">Declaración F-14 (Pago a Cuenta · renta)</h3>
          <button onClick={exportF14} className="btn btn-primary btn-sm">
            Descargar F-14 (CSV)
          </button>
        </div>
        <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          <SummaryRow label="Ingresos brutos (base sin IVA)" value={money(f14.ingresosBrutos)} />
          <SummaryRow label="Tasa de pago a cuenta" value="1.75%" />
          <SummaryRow label="Pago a cuenta (1.75%)" value={money(f14.pagoACuenta)} />
          <SummaryRow label="ISR retenido a terceros" value={money(f14.rentaRetenida)} />
        </div>
        <div className="mt-3 border-t border-charcoal-100 pt-3">
          <SummaryRow label="Total a pagar (F-14)" value={money(f14.total)} strong />
        </div>
        <p className="mt-2 text-xs text-charcoal-300">
          Anticipo mensual del 1.75% sobre los ingresos brutos (Art. 151 Código Tributario), acreditable
          contra el ISR anual. El sistema no registra retenciones de renta a terceros (planilla, servicios
          profesionales); si las hubo, sumalas manualmente en el formulario.
        </p>
      </div>

      {/* Retención de IVA 1% — se declara con el F-07, no en el F-14 de renta */}
      {ivaRetenido > 0 && (
        <div className="rounded-2xl bg-white p-4 shadow sm:p-6">
          <h3 className="section-title mb-2">Retención IVA 1% a proveedores</h3>
          <div className="flex justify-between">
            <span className="text-charcoal-400">Total 1% IVA retenido en el mes</span>
            <span className="text-lg font-bold text-brand-700">{money(ivaRetenido)}</span>
          </div>
          <p className="mt-2 text-xs text-charcoal-300">
            IVA retenido a proveedores que debés enterar a Hacienda. Se declara dentro del F-07
            (retenciones y percepciones de IVA), no en el F-14. Aplica solo si sos Gran Contribuyente.
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

      {/* Libro de Compras — libro legal (Art. 141 CT), todas las compras */}
      <Register
        title="Libro de Compras"
        subtitle="Todas las compras con documento · 13 columnas del formato legal"
        onExport={exportLibroCompras}
        disabled={purchaseRows.length === 0}
        numericFrom={5}
        headers={[
          'N°', 'Fecha', 'N° documento', 'NRC/NIT', 'Proveedor', 'Exentas internas',
          'Exentas import.', 'Gravadas internas', 'Gravadas import.', 'Crédito fiscal',
          'Anticipo IVA 1%', 'Total', 'Sujetos excluidos',
        ]}
        rows={purchaseRows.map((r) => [
          r.numero, fmtDate(r.fecha), r.numeroDocumento || '—', r.nrcProveedor || '—',
          r.nombreProveedor || '—', money(r.exentasInternas), money(r.exentasImportadas),
          money(r.gravadasInternas), money(r.gravadasImportadas), money(r.creditoFiscal),
          money(r.anticipoIvaPercibido), money(r.totalCompras), money(r.sujetosExcluidos),
        ])}
        totals={[
          '', '', '', '', 'Totales',
          money(purchaseTotals.exentasInternas), money(purchaseTotals.exentasImportadas),
          money(purchaseTotals.gravadasInternas), money(purchaseTotals.gravadasImportadas),
          money(purchaseTotals.creditoFiscal), money(purchaseTotals.anticipoIvaPercibido),
          money(purchaseTotals.totalCompras), money(purchaseTotals.sujetosExcluidos),
        ]}
      />

      <p className="rounded-lg bg-accent-50 px-4 py-3 text-xs text-charcoal-400">
        Los archivos CSV abren directamente en Excel (codificación UTF-8). Validá el formato de columnas
        exacto con tu contador según la versión vigente del formato DGII antes de presentar. Este sistema
        no reemplaza a un contador público.
      </p>
    </div>
  );
}

function AnexoButton({ n, title, count, unit, onClick }: {
  n: number;
  title: string;
  count: number;
  unit: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={count === 0}
      className="rounded-xl border border-cream-300 px-3 py-3 text-left transition hover:border-brand-400 disabled:opacity-40"
    >
      <span className="block text-xs text-charcoal-300">Anexo {n}</span>
      <span className="block font-semibold text-charcoal-600">{title}</span>
      <span className="block text-xs text-charcoal-400">{count} {unit}</span>
    </button>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between py-1">
      <span className={strong ? 'font-semibold text-charcoal-600' : 'text-charcoal-400'}>{label}</span>
      <span className={strong ? 'text-lg font-bold text-brand-700' : 'font-medium text-charcoal-600'}>{value}</span>
    </div>
  );
}

function Register({
  title, subtitle, onExport, disabled, headers, rows, totals, numericFrom = 6,
}: {
  title: string;
  subtitle: string;
  onExport: () => void;
  disabled: boolean;
  headers: string[];
  rows: (string | number)[][];
  totals: (string | number)[];
  /** Índice de la primera columna de montos: se alinean a la derecha. */
  numericFrom?: number;
}) {
  return (
    <div className="rounded-2xl bg-white shadow">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cream-200 p-4">
        <div>
          <h3 className="section-title">{title}</h3>
          <p className="text-xs text-charcoal-300">{subtitle}</p>
        </div>
        <button
          onClick={onExport}
          disabled={disabled}
          className="btn btn-primary btn-sm active:bg-brand-700 disabled:opacity-50"
        >
          Descargar CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-left text-[13px] sm:text-sm">
          <thead className="bg-cream-100 text-charcoal-400">
            <tr>{headers.map((h, i) => (
              <th key={i} className={`px-3 py-2 ${i >= numericFrom ? 'text-right' : ''}`}>{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-cream-200">
            {rows.map((r, ri) => (
              <tr key={ri}>{r.map((c, ci) => (
                <td key={ci} className={`px-3 py-2 ${ci >= numericFrom ? 'text-right' : ''}`}>{c}</td>
              ))}</tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={headers.length} className="px-3 py-6 text-center text-charcoal-300">Sin registros este mes</td></tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t-2 border-cream-300 bg-cream-50 font-semibold">
              <tr>{totals.map((c, i) => (
                <td key={i} className={`px-3 py-2 ${i >= numericFrom ? 'text-right' : ''}`}>{c}</td>
              ))}</tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
