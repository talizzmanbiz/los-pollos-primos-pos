// Verificación del formato de los anexos F-07 contra los renglones de ejemplo
// que trae la plantilla oficial del MH ("PLANTILLAS IVA F-07 v11.7.4").
// Si una regla de formato se rompe, esto falla.
//
//   node --experimental-strip-types src/lib/hacienda.check.ts
import assert from 'node:assert/strict';
import {
  anexoComprasCsv,
  anexoConsumidorFinalCsv,
  anexoContribuyentesCsv,
  fechaMh,
  libroCompras,
  libroCompraCells,
  LIBRO_COMPRAS_HEADERS,
} from './hacienda.ts';

// ---- Anexo 3, fila 3 de la plantilla: FREUND, LTDA. DE C.V. ----
const compras = anexoComprasCsv([{
  fecha: '2026-06-18',
  claseDocumento: '4',
  tipoDocumento: '03',
  numeroDocumento: 'DTE-03-S020P009-000000000899368',
  nitProveedor: '41-8',
  nombreProveedor: 'FREUND, LTDA. DE C.V.',
  comprasExentas: 0,
  internacionesExentas: 0,
  importacionesExentas: 0,
  comprasGravadas: 200.07,
  internacionesGravadas: 0,
  importacionesGravadasBienes: 0,
  importacionesGravadasServicios: 0,
  creditoFiscal: 26.01,
  totalCompras: 226.08,
  duiProveedor: '',
  tipoOperacion: '1',
  clasificacion: '1',
  sector: '2',
  tipoCostoGasto: '4',
}]);
assert.equal(
  compras,
  '18/06/2026;4;03;DTE03S020P009000000000899368;418;FREUND, LTDA. DE C.V.;' +
  '0.00;0.00;0.00;200.07;0.00;0.00;0.00;26.01;226.08;;1;1;2;4;3',
);
assert.equal(compras.split(';').length, 21, 'el anexo de compras lleva 21 columnas');

// Las etiquetas completas de la plantilla se reducen al mismo código, así que
// da igual si el dato viene de un <select> o de la base.
const conEtiquetas = anexoComprasCsv([{
  fecha: '2026-06-18',
  claseDocumento: '4. DOCUMENTO TRIBUTARIO ELECTRONICO (DTE)',
  tipoDocumento: '03. COMPROBANTE DE CRÉDITO FISCAL',
  numeroDocumento: 'DTE-03-S020P009-000000000899368',
  nitProveedor: '41-8',
  nombreProveedor: 'FREUND, LTDA. DE C.V.',
  comprasExentas: 0,
  internacionesExentas: 0,
  importacionesExentas: 0,
  comprasGravadas: 200.07,
  internacionesGravadas: 0,
  importacionesGravadasBienes: 0,
  importacionesGravadasServicios: 0,
  creditoFiscal: 26.01,
  totalCompras: 226.08,
  duiProveedor: '',
  tipoOperacion: '1 Gravada',
  clasificacion: '1 Costo',
  sector: '2 Comercio',
  tipoCostoGasto: '4 Costo Artículos Producidos/Comprados Importaciones/Internaciones',
}]);
assert.equal(conEtiquetas, compras, 'etiqueta y código deben producir la misma línea');

// ---- Anexo 2, fila 3 de la plantilla ----
const cf = anexoConsumidorFinalCsv([{
  fecha: '2026-01-03',
  claseDocumento: '4',
  tipoDocumento: '01',
  numeroResolucion: '15041-RES-IN-38653-2025',
  serieDocumento: '25AS000F',
  controlInternoDel: '50',
  controlInternoAl: '50',
  numeroDocumentoDel: '50',
  numeroDocumentoAl: '50',
  maquinaRegistradora: '',
  ventasExentas: 0,
  ventasExentasNoProporcionalidad: 0,
  ventasNoSujetas: 0,
  ventasGravadas: 276,
  exportacionesCentroamerica: 0,
  exportacionesFueraCentroamerica: 0,
  exportacionesServicio: 0,
  ventasZonasFrancas: 0,
  ventasTerceros: 0,
  totalVentas: 276,
  tipoOperacion: '01',
  tipoIngreso: '02',
}]);
assert.equal(
  cf,
  '03/01/2026;4;01;15041RESIN386532025;25AS000F;50;50;50;50;;' +
  '0.00;0.00;0.00;276.00;0.00;0.00;0.00;0.00;0.00;276.00;01;02;2',
);
assert.equal(cf.split(';').length, 23, 'consumidor final lleva 23 columnas');

// ---- Anexo 1, fila 3 de la plantilla ----
const contrib = anexoContribuyentesCsv([{
  fecha: '2026-01-03',
  claseDocumento: '1',
  tipoDocumento: '03',
  numeroResolucion: '15041-RES-IN-34394-2020',
  serieDocumento: '20AS000C',
  numeroDocumento: '49',
  controlInterno: '49',
  nitCliente: '262274-5',
  nombreCliente: 'Liliana Maria Nieto Bence',
  ventasExentas: 0,
  ventasNoSujetas: 0,
  ventasGravadas: 21.24,
  debitoFiscal: 2.7612,          // la plantilla guarda el crudo; el CSV redondea
  ventasTerceros: 0,
  debitoTerceros: 0,
  totalVentas: 24.0012,
  duiCliente: '',
  tipoOperacion: '01',
  tipoIngreso: '05',
}]);
assert.equal(
  contrib,
  '03/01/2026;1;03;15041RESIN343942020;20AS000C;49;49;2622745;LILIANA MARIA NIETO BENCE;' +
  '0.00;0.00;21.24;2.76;0.00;0.00;24.00;;01;05;1',
);
assert.equal(contrib.split(';').length, 20, 'contribuyentes lleva 20 columnas');

// ---- reglas sueltas ----
assert.equal(fechaMh('2026-12-31'), '31/12/2026');
// El nombre no puede llevar ; ' " porque romperían el separador
assert.match(
  anexoComprasCsv([{
    fecha: '2026-01-01', claseDocumento: '4', tipoDocumento: '03', numeroDocumento: 'X',
    nitProveedor: '1', nombreProveedor: 'A;B\'C"D', comprasExentas: 0, internacionesExentas: 0,
    importacionesExentas: 0, comprasGravadas: 0, internacionesGravadas: 0,
    importacionesGravadasBienes: 0, importacionesGravadasServicios: 0, creditoFiscal: 0,
    totalCompras: 0, duiProveedor: '', tipoOperacion: '1', clasificacion: '1', sector: '2',
    tipoCostoGasto: '5',
  }]),
  /;ABCD;/,
);
// Varios renglones se separan con CRLF, sin encabezado
const dos = anexoComprasCsv([1, 2].map((n) => ({
  fecha: '2026-01-0' + n, claseDocumento: '4', tipoDocumento: '03', numeroDocumento: 'X' + n,
  nitProveedor: '1', nombreProveedor: 'P', comprasExentas: 0, internacionesExentas: 0,
  importacionesExentas: 0, comprasGravadas: 1, internacionesGravadas: 0,
  importacionesGravadasBienes: 0, importacionesGravadasServicios: 0, creditoFiscal: 0.13,
  totalCompras: 1.13, duiProveedor: '', tipoOperacion: '1', clasificacion: '1', sector: '2',
  tipoCostoGasto: '5',
})));
assert.equal(dos.split('\r\n').length, 2);
assert.ok(!dos.startsWith('FECHA'), 'los anexos no llevan fila de encabezados');

// ---- Libro de compras (libro legal, no anexo) ----
const libroBase = {
  fecha: '2026-06-18',
  numeroDocumento: 'DTE-03-S020P009-000000000899368',
  tipoDocumento: '03',
  nrcProveedor: '41-8',
  nombreProveedor: 'FREUND, LTDA. DE C.V.',
  exentasInternas: 0,
  exentasImportadas: 0,
  gravadasInternas: 200.07,
  gravadasImportadas: 0,
  creditoFiscal: 26.01,
  anticipoIvaPercibido: 0,
  totalCompras: 226.08,
};

const libro = libroCompras([
  libroBase,
  // Sujeto excluido: sin IVA, todo el monto va a la última columna.
  {
    ...libroBase,
    numeroDocumento: 'F-14-001',
    tipoDocumento: '14',
    nombreProveedor: 'JUAN PEREZ',
    gravadasInternas: 50,
    creditoFiscal: 0,
    totalCompras: 50,
  },
]);

assert.deepEqual(libroCompraCells(libro[0]), [
  1, '18/06/2026', 'DTE-03-S020P009-000000000899368', '41-8', 'FREUND, LTDA. DE C.V.',
  '0.00', '0.00', '200.07', '0.00', '26.01', '0.00', '226.08', '0.00',
]);
assert.deepEqual(libroCompraCells(libro[1]), [
  2, '18/06/2026', 'F-14-001', '41-8', 'JUAN PEREZ',
  '0.00', '0.00', '0.00', '0.00', '0.00', '0.00', '50.00', '50.00',
]);
assert.equal(LIBRO_COMPRAS_HEADERS.length, 13, 'el libro de compras lleva 13 columnas');
assert.equal(
  libroCompraCells(libro[0]).length,
  LIBRO_COMPRAS_HEADERS.length,
  'cada fila debe traer tantas celdas como encabezados',
);
// El libro sí lleva encabezados y separador coma (a diferencia de los anexos).
assert.ok(LIBRO_COMPRAS_HEADERS[0].startsWith('N'));

console.log('OK — los 3 anexos y el libro de compras coinciden con el formato del MH');
