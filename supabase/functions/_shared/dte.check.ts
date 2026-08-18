// Verificación del armado del DTE. Lo que se comprueba es lo que Hacienda
// rechaza en la práctica: que los totales cuadren y que la factura lleve el IVA
// dentro del precio mientras que el CCF lo lleva aparte.
//
//   node --experimental-strip-types supabase/functions/_shared/dte.check.ts
import assert from 'node:assert/strict';
import { construirDte, numeroALetras, type Emisor } from './dte.ts';

const emisor: Emisor = {
  nit: '0614-241090-102-2',
  nrc: '123456-7',
  nombre: 'LOS POLLOS PRIMOS, S.A. DE C.V.',
  nombre_comercial: 'Los Pollos Primos',
  cod_actividad: '56101',
  desc_actividad: 'Restaurantes y puestos de comida',
  tipo_establecimiento: '01',
  departamento: '02',
  municipio: '14',
  complemento: 'Chalchuapa, Santa Ana',
  telefono: '25551234',
  correo: 'admin@los-pollosprimos.com',
  cod_estable_mh: '0001',
  cod_estable: 'C001',
  cod_punto_venta_mh: '0001',
  cod_punto_venta: 'P001',
};

const base = {
  ambiente: '00',
  numeroControl: 'DTE-01-00010001-000000000000001',
  codigoGeneracion: 'a1b2c3d4-1111-2222-3333-444455556666',
  fecEmi: '2026-08-10',
  horEmi: '13:45:00',
  emisor,
  items: [
    { codigo: 'COMBO-ENT', descripcion: 'El Primo Grande', cantidad: 1, precioUnitario: 12.95 },
    { codigo: 'CHIMI-30', descripcion: 'Chimichurri 30ml', cantidad: 2, precioUnitario: 0.75 },
  ],
};

// ---- FACTURA (01): precio de caja CON IVA ----
const { documento: fa, totales: tFa } = construirDte({ ...base, tipoDte: '01' });

assert.equal(fa.identificacion.version, 1);
assert.equal(fa.identificacion.tipoDte, '01');
assert.equal(fa.identificacion.codigoGeneracion, 'A1B2C3D4-1111-2222-3333-444455556666',
  'el código de generación viaja en mayúsculas');
assert.equal(fa.emisor.nit, '06142410901022', 'el NIT va sin guiones');
assert.equal(fa.receptor, null, 'consumidor final sin datos → receptor nulo');

// 12.95 + 2×0.75 = 14.45, todo con IVA incluido
assert.equal(fa.resumen.totalGravada, 14.45);
assert.equal(fa.resumen.montoTotalOperacion, 14.45, 'en factura el IVA NO se vuelve a sumar');
assert.equal(fa.resumen.totalPagar, 14.45);
assert.equal(fa.resumen.totalIva, 1.66);           // 14.45 − 14.45/1.13
assert.equal(fa.resumen.tributos, null, 'la factura no declara el tributo 20');
assert.equal(fa.cuerpoDocumento[0].ivaItem, 1.49);
assert.equal(fa.resumen.totalLetras, 'CATORCE 45/100');
assert.equal(tFa.total_gravado + tFa.total_iva, tFa.total_pagar, 'los totales guardados cuadran');

// ---- CCF (03): mismo precio de caja, pero desglosado ----
const { documento: cc, totales: tCc } = construirDte({
  ...base,
  tipoDte: '03',
  numeroControl: 'DTE-03-00010001-000000000000001',
  receptor: { tipoDocumento: '36', numDocumento: '0614-241090-102-2', nrc: '99999-9', nombre: 'CLIENTE S.A. DE C.V.' },
});

assert.equal(cc.identificacion.version, 3);
assert.equal(cc.resumen.totalGravada, 12.79);      // round(14.45 / 1.13)
assert.equal(cc.resumen.tributos?.[0].codigo, '20');
assert.equal(cc.resumen.tributos?.[0].valor, 1.66);
assert.equal(cc.resumen.montoTotalOperacion, 14.45, 'el CCF sí suma el IVA al gravado');
// El residuo de redondear ítem por ítem se absorbe: la suma cuadra con el resumen.
assert.equal(
  Math.round(cc.cuerpoDocumento.reduce((s, it) => s + it.ventaGravada, 0) * 100) / 100,
  cc.resumen.totalGravada,
  'la suma de los ítems debe cuadrar con totalGravada',
);
assert.equal(
  Math.round(cc.resumen.totalGravada * 100 + cc.resumen.tributos![0].valor * 100) / 100,
  cc.resumen.montoTotalOperacion,
  'base + IVA debe dar exactamente lo cobrado',
);
assert.equal(cc.cuerpoDocumento[0].ivaItem, undefined, 'el CCF no lleva ivaItem por ítem');
assert.deepEqual(cc.cuerpoDocumento[0].tributos, ['20']);
assert.equal(cc.receptor?.numDocumento, '06142410901022');
assert.equal(cc.receptor?.nrc, '999999');
assert.equal(tCc.total_gravado + tCc.total_iva, tCc.total_pagar);

// La factura y el CCF cobran lo mismo al cliente: sólo cambia cómo se declara.
assert.equal(fa.resumen.totalPagar, cc.resumen.totalPagar);

// ---- número a letras ----
assert.equal(numeroALetras(0), 'CERO 00/100');
assert.equal(numeroALetras(1), 'UNO 00/100');
assert.equal(numeroALetras(15.5), 'QUINCE 50/100');
assert.equal(numeroALetras(21), 'VEINTIUNO 00/100');
assert.equal(numeroALetras(100), 'CIEN 00/100');
assert.equal(numeroALetras(101.01), 'CIENTO UNO 01/100');
assert.equal(numeroALetras(1000), 'MIL 00/100');
assert.equal(numeroALetras(2345.67), 'DOS MIL TRESCIENTOS CUARENTA Y CINCO 67/100');
assert.equal(numeroALetras(1_000_000), 'UN MILLON 00/100');

console.log('OK — el DTE cuadra en factura y en CCF');
