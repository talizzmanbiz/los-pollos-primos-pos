// Catálogos del Ministerio de Hacienda usados por los anexos F-07.
// Tomados de la hoja PARAMETROS y "TIPOS DE DOCUMENTO" de la plantilla oficial
// v11.7.4. El código (la llave) es lo que viaja en el CSV; la etiqueta es sólo
// para los <select>.

export const CLASE_DOCUMENTO: Record<string, string> = {
  '1': 'Impreso por imprenta o tiquetes',
  '2': 'Formulario único',
  '3': 'Otros',
  '4': 'Documento Tributario Electrónico (DTE)',
};

export const TIPO_DOCUMENTO: Record<string, string> = {
  '01': 'Factura',
  '02': 'Factura de venta simplificada',
  '03': 'Comprobante de crédito fiscal',
  '04': 'Nota de remisión',
  '05': 'Nota de crédito',
  '06': 'Nota de débito',
  '07': 'Comprobante de retención',
  '08': 'Comprobante de liquidación',
  '09': 'Documento contable de liquidación',
  '10': 'Tiquetes de máquinas registradoras',
  '11': 'Factura de exportación',
  '14': 'Factura de sujeto excluido',
};

/** Tipo de operación (renta) — anexo de compras, 1 dígito. */
export const RENTA_TIPO_OPERACION: Record<string, string> = {
  '1': 'Gravada',
  '2': 'No gravada o exenta',
  '3': 'Excluido o no constituye renta',
  '4': 'Mixta (regímenes especiales)',
  '8': 'Operaciones informadas en más de 1 anexo',
  '9': 'Excepciones (instituciones públicas, no inscritos…)',
};

/** Clasificación (renta) — costo o gasto. */
export const RENTA_CLASIFICACION: Record<string, string> = {
  '1': 'Costo',
  '2': 'Gasto',
  '8': 'Operaciones informadas en más de 1 anexo',
  '9': 'Excepciones',
};

export const RENTA_SECTOR: Record<string, string> = {
  '1': 'Industria',
  '2': 'Comercio',
  '3': 'Agropecuaria',
  '4': 'Servicios, profesiones, artes y oficios',
  '8': 'Operaciones informadas en más de 1 anexo',
  '9': 'Excepciones',
};

export const RENTA_TIPO_COSTO_GASTO: Record<string, string> = {
  '1': 'Gasto de venta sin donación',
  '2': 'Gasto de administración sin donación',
  '3': 'Gastos financieros sin donación',
  '4': 'Costo artículos producidos/comprados — importaciones/internaciones',
  '5': 'Costo artículos producidos/comprados — interno',
  '6': 'Costos indirectos de fabricación',
  '7': 'Mano de obra',
  '8': 'Operaciones informadas en más de 1 anexo',
  '9': 'Excepciones',
};

/** Tipo de operación (renta) para los anexos de ventas — 2 dígitos. */
export const VENTAS_TIPO_OPERACION: Record<string, string> = {
  '01': 'Gravada',
  '02': 'No gravada o exenta',
  '03': 'Excluido o no constituye renta',
  '04': 'Mixta',
};

export const VENTAS_TIPO_INGRESO: Record<string, string> = {
  '01': 'Profesiones, artes y oficios',
  '02': 'Actividades de servicios',
  '03': 'Actividades comerciales',
  '04': 'Actividades industriales',
  '05': 'Actividades agropecuarias',
  '06': 'Utilidades y dividendos',
  '07': 'Exportaciones de bienes',
  '09': 'Exportaciones de servicios',
  '10': 'Otras rentas gravables',
};

/**
 * Los Pollos Primos vende comida preparada en local: para el anexo de ventas
 * eso es operación gravada (01) por actividad de servicios (02).
 */
export const VENTA_DEFAULTS = { tipoOperacion: '01', tipoIngreso: '02' } as const;

/** Compra típica de insumos: gravada, costo, comercio, costo interno. */
export const COMPRA_DEFAULTS = {
  tipoOperacion: '1',
  clasificacion: '1',
  sector: '2',
  tipoCostoGasto: '5',
} as const;

export const opciones = (cat: Record<string, string>) =>
  Object.entries(cat).map(([code, label]) => ({ code, label: `${code} — ${label}` }));
