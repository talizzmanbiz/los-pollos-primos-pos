// Anexos del formulario F-07 (IVA) — Ministerio de Hacienda, El Salvador.
//
// El formato NO es CSV estándar: es texto separado por punto y coma, sin fila
// de encabezados, con CRLF entre registros y codificación de Windows. Las
// columnas con lista desplegable viajan como CÓDIGO puro ("03", no
// "03. COMPROBANTE DE CRÉDITO FISCAL") y los números siempre llevan 2 decimales
// aunque estén vacíos ("0.00").
//
// Las reglas de abajo replican las macros de la plantilla oficial
// "PLANTILLAS IVA F-07 v11.7.4" (módulos ANEXO_DE_COMPRAS,
// ANEXO_CONSUMIDOR_FINAL, ANEXO_CONTRIBUYENTES y Funciones), que es lo que el
// portal del MH acepta hoy:
//
//   PadR(t, n)      = Left(UCase(t), n)      → mayúsculas, recorta a n
//   PadL(t, n)      = Right(t, n)            → conserva los últimos n
//   guiones(t)      = Replace(t, "-", "")    → quita los guiones
//   comillenter(t)  = quita  ;  '  "
//   moneda(v)       = Format(v, "####0.00")
//
// Ver docs/hacienda-anexos.md para el mapeo columna por columna.

/** Mayúsculas y recorte por la izquierda (PadR de la plantilla). */
const padR = (v: unknown, n: number): string =>
  String(v ?? '').trim().toUpperCase().slice(0, n);

/** Conserva los últimos n caracteres (PadL de la plantilla). */
const padL = (v: unknown, n: number): string => {
  const s = String(v ?? '').trim();
  // La macro recorta a la izquierda. Para montos eso convertiría $12,345,678.90
  // en un número distinto, así que sólo recortamos cuando no hay pérdida real.
  return s.length > n ? s.slice(-n) : s;
};

const guiones = (v: unknown): string => String(v ?? '').replace(/-/g, '');

const comillenter = (v: unknown): string => String(v ?? '').replace(/[;'"]/g, '');

/** Monto con 2 decimales; vacío/NaN → "0.00" (el MH prohíbe celdas vacías). */
const moneda = (v: unknown): string => {
  const n = Number(v);
  return (Number.isFinite(n) ? n : 0).toFixed(2);
};

/** 'YYYY-MM-DD' (date de Postgres) → 'DD/MM/YYYY'. Sin `Date` para no
 *  desplazar el día por zona horaria. */
export function fechaMh(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Número de documento tal como lo espera el anexo: sin guiones y en mayúsculas.
 *  "DTE-03-S020P009-000000000899368" → "DTE03S020P009000000000899368" */
const numDoc = (v: unknown): string => padR(guiones(v), 100);

// ============================================================
// Anexo 3 — COMPRAS
// ============================================================

export interface AnexoCompraRow {
  fecha: string;              // ISO
  claseDocumento: string;     // 1 | 2 | 4
  tipoDocumento: string;      // 03, 01, 05…
  numeroDocumento: string;
  nitProveedor: string;       // NIT o NRC
  nombreProveedor: string;
  comprasExentas: number;
  internacionesExentas: number;
  importacionesExentas: number;
  comprasGravadas: number;
  internacionesGravadas: number;
  importacionesGravadasBienes: number;
  importacionesGravadasServicios: number;
  creditoFiscal: number;
  totalCompras: number;
  duiProveedor: string;
  tipoOperacion: string;      // renta
  clasificacion: string;      // renta
  sector: string;             // renta
  tipoCostoGasto: string;     // renta
}

function lineaCompra(r: AnexoCompraRow): string {
  return [
    padR(fechaMh(r.fecha), 10),
    padR(r.claseDocumento, 1),
    padR(r.tipoDocumento, 2),
    numDoc(r.numeroDocumento),
    padL(guiones(r.nitProveedor), 14),
    padR(comillenter(r.nombreProveedor), 100),
    padL(moneda(r.comprasExentas), 11),
    padL(moneda(r.internacionesExentas), 11),
    padL(moneda(r.importacionesExentas), 11),
    padL(moneda(r.comprasGravadas), 11),
    padL(moneda(r.internacionesGravadas), 11),
    padL(moneda(r.importacionesGravadasBienes), 11),
    padL(moneda(r.importacionesGravadasServicios), 11),
    padL(moneda(r.creditoFiscal), 11),
    padL(moneda(r.totalCompras), 11),
    padL(guiones(r.duiProveedor), 9),
    padR(r.tipoOperacion, 1),
    padR(r.clasificacion, 1),
    padR(r.sector, 1),
    padR(r.tipoCostoGasto, 1),
    '3', // número del anexo
  ].join(';');
}

export const anexoComprasCsv = (rows: AnexoCompraRow[]): string =>
  rows.map(lineaCompra).join('\r\n');

// ============================================================
// Anexo 2 — CONSUMIDOR FINAL (resumen por día / rango de documentos)
// ============================================================

export interface AnexoConsumidorFinalRow {
  fecha: string;
  claseDocumento: string;
  tipoDocumento: string;      // 01 = factura
  numeroResolucion: string;
  serieDocumento: string;
  controlInternoDel: string;
  controlInternoAl: string;
  numeroDocumentoDel: string;
  numeroDocumentoAl: string;
  maquinaRegistradora: string;
  ventasExentas: number;
  ventasExentasNoProporcionalidad: number;
  ventasNoSujetas: number;
  ventasGravadas: number;
  exportacionesCentroamerica: number;
  exportacionesFueraCentroamerica: number;
  exportacionesServicio: number;
  ventasZonasFrancas: number;
  ventasTerceros: number;
  totalVentas: number;
  tipoOperacion: string;      // renta, 2 dígitos
  tipoIngreso: string;        // renta, 2 dígitos
}

function lineaConsumidorFinal(r: AnexoConsumidorFinalRow): string {
  return [
    padR(fechaMh(r.fecha), 10),
    padR(r.claseDocumento, 1),
    padR(r.tipoDocumento, 2),
    padL(guiones(r.numeroResolucion), 100),
    padR(r.serieDocumento, 100),
    padR(guiones(r.controlInternoDel), 100),
    padR(guiones(r.controlInternoAl), 100),
    padR(guiones(r.numeroDocumentoDel), 100),
    padR(guiones(r.numeroDocumentoAl), 100),
    padR(r.maquinaRegistradora, 14),
    padL(moneda(r.ventasExentas), 11),
    padL(moneda(r.ventasExentasNoProporcionalidad), 11),
    padL(moneda(r.ventasNoSujetas), 11),
    padL(moneda(r.ventasGravadas), 11),
    padL(moneda(r.exportacionesCentroamerica), 11),
    padL(moneda(r.exportacionesFueraCentroamerica), 11),
    padL(moneda(r.exportacionesServicio), 11),
    padL(moneda(r.ventasZonasFrancas), 11),
    padL(moneda(r.ventasTerceros), 11),
    padL(moneda(r.totalVentas), 11),
    padR(r.tipoOperacion, 2),
    padR(r.tipoIngreso, 2),
    '2', // número del anexo
  ].join(';');
}

export const anexoConsumidorFinalCsv = (rows: AnexoConsumidorFinalRow[]): string =>
  rows.map(lineaConsumidorFinal).join('\r\n');

// ============================================================
// Anexo 1 — CONTRIBUYENTES (un renglón por CCF emitido)
// ============================================================

export interface AnexoContribuyenteRow {
  fecha: string;
  claseDocumento: string;
  tipoDocumento: string;      // 03 = CCF
  numeroResolucion: string;
  serieDocumento: string;
  numeroDocumento: string;
  controlInterno: string;
  nitCliente: string;
  nombreCliente: string;
  ventasExentas: number;
  ventasNoSujetas: number;
  ventasGravadas: number;
  debitoFiscal: number;
  ventasTerceros: number;
  debitoTerceros: number;
  totalVentas: number;
  duiCliente: string;
  tipoOperacion: string;      // 2 dígitos
  tipoIngreso: string;        // 2 dígitos
}

function lineaContribuyente(r: AnexoContribuyenteRow): string {
  return [
    padR(fechaMh(r.fecha), 10),
    padR(r.claseDocumento, 1),
    padR(r.tipoDocumento, 2),
    padL(guiones(r.numeroResolucion), 100),
    padR(r.serieDocumento, 100),
    padR(guiones(r.numeroDocumento), 100),
    padR(guiones(r.controlInterno), 100),
    padL(guiones(r.nitCliente), 14),
    padR(comillenter(r.nombreCliente), 100),
    padL(moneda(r.ventasExentas), 11),
    padL(moneda(r.ventasNoSujetas), 11),
    padL(moneda(r.ventasGravadas), 11),
    padL(moneda(r.debitoFiscal), 11),
    padL(moneda(r.ventasTerceros), 11),
    padL(moneda(r.debitoTerceros), 11),
    padL(moneda(r.totalVentas), 11),
    padL(guiones(r.duiCliente), 9),
    padR(r.tipoOperacion, 2),
    padR(r.tipoIngreso, 2),
    '1', // número del anexo
  ].join(';');
}

export const anexoContribuyentesCsv = (rows: AnexoContribuyenteRow[]): string =>
  rows.map(lineaContribuyente).join('\r\n');

// ============================================================
// LIBRO DE COMPRAS (Art. 141 Código Tributario)
//
// No es un anexo que se sube al portal: es el libro legal que la empresa
// conserva y que el auditor pide. Por eso sí lleva encabezados y se abre en
// Excel como CSV normal. Difiere del anexo 3 en tres cosas:
//
//   · importaciones e internaciones van SUMADAS en una sola columna,
//   · las compras a sujetos excluidos (documento 14) van en su propia columna
//     y no en gravadas ni exentas,
//   · lleva la columna del 1% de anticipo a cuenta de IVA.
// ============================================================

export const LIBRO_COMPRAS_HEADERS = [
  'N°',
  'Fecha de emisión',
  'N° de documento',
  'N° registro de contribuyente',
  'Nombre del proveedor',
  'Compras exentas internas',
  'Importaciones e internaciones exentas',
  'Compras internas gravadas',
  'Importaciones e internaciones gravadas',
  'Crédito fiscal',
  'Anticipo a cuenta IVA percibido',
  'Total compras',
  'Compras a sujetos excluidos',
] as const;

export interface LibroCompraInput {
  fecha: string;              // ISO
  numeroDocumento: string;
  tipoDocumento: string;      // 14 = factura de sujeto excluido
  nrcProveedor: string;
  nombreProveedor: string;
  exentasInternas: number;
  exentasImportadas: number;  // importaciones + internaciones exentas
  gravadasInternas: number;
  gravadasImportadas: number; // importaciones + internaciones gravadas
  creditoFiscal: number;
  anticipoIvaPercibido: number;
  totalCompras: number;
}

export interface LibroCompraRow extends LibroCompraInput {
  numero: number;
  sujetosExcluidos: number;
}

/** Numera y reparte los montos en las columnas del libro. */
export function libroCompras(rows: LibroCompraInput[]): LibroCompraRow[] {
  return rows.map((r, i) => {
    // Un sujeto excluido no cobra IVA y no genera crédito fiscal: su compra no
    // es "gravada" ni "exenta", va en la última columna. Si se dejara entre las
    // gravadas, el libro dejaría de cuadrar con el crédito fiscal declarado.
    const excluido = r.tipoDocumento === '14';
    const compra = excluido
      ? r.gravadasInternas + r.gravadasImportadas + r.exentasInternas + r.exentasImportadas
      : 0;
    return {
      ...r,
      numero: i + 1,
      exentasInternas: excluido ? 0 : r.exentasInternas,
      exentasImportadas: excluido ? 0 : r.exentasImportadas,
      gravadasInternas: excluido ? 0 : r.gravadasInternas,
      gravadasImportadas: excluido ? 0 : r.gravadasImportadas,
      creditoFiscal: excluido ? 0 : r.creditoFiscal,
      sujetosExcluidos: compra,
    };
  });
}

/** Fila del libro lista para `toCsv`: fechas DD/MM/YYYY y montos a 2 decimales. */
export const libroCompraCells = (r: LibroCompraRow): (string | number)[] => [
  r.numero,
  fechaMh(r.fecha),
  r.numeroDocumento,
  r.nrcProveedor,
  r.nombreProveedor,
  moneda(r.exentasInternas),
  moneda(r.exentasImportadas),
  moneda(r.gravadasInternas),
  moneda(r.gravadasImportadas),
  moneda(r.creditoFiscal),
  moneda(r.anticipoIvaPercibido),
  moneda(r.totalCompras),
  moneda(r.sujetosExcluidos),
];

// ============================================================
// Descarga
// ============================================================

/**
 * Descarga un anexo. A diferencia de `downloadCsv`, NO lleva BOM: la plantilla
 * oficial escribe con `Print #` (texto plano de Windows) y el validador del MH
 * toma el BOM como parte del primer campo, lo que invalida la fecha.
 * Se codifica en latin1, que es lo que produce Excel en español.
 */
export function downloadAnexo(filename: string, contenido: string): void {
  const bytes = Uint8Array.from(
    [...contenido].map((ch) => {
      const code = ch.codePointAt(0) ?? 63;
      return code <= 0xff ? code : 63; // '?' para lo que no cabe en latin1
    }),
  );
  const url = URL.createObjectURL(new Blob([bytes], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
