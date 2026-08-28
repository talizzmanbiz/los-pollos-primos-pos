// Verificación del constructor de DTE contra los esquemas OFICIALES del MH.
//
// No comprueba lo que yo creo que pide Hacienda: carga los .json que el propio
// Ministerio publica (./schemas/) y valida contra ellos. Si el MH cambia un
// esquema, se reemplaza el archivo y esta prueba avisa sola.
//
// Correr:  node --experimental-strip-types supabase/functions/_shared/dte.check.ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { construirDte, numeroALetras, type Emisor } from './dte.ts';
import { construirInvalidacion, TIPO_ANULACION } from './invalidacion.ts';
import { construirContingencia, TIPO_CONTINGENCIA } from './contingencia.ts';

const aqui = dirname(fileURLToPath(import.meta.url));
const schema = (n: string) => JSON.parse(readFileSync(join(aqui, 'schemas', n), 'utf8'));

// multipleOfPrecision: sin esto ajv rechaza 16.40 por no ser "múltiplo exacto"
// de 0.01 — en IEEE754 16.4/0.01 da 1639.9999999999998. No es un rechazo real
// del MH: el DTE que nos manda un proveedor trae 3.56 y está sellado.
const ajv = new Ajv({ allErrors: true, strict: false, multipleOfPrecision: 6 });
addFormats(ajv);
const validarFactura = ajv.compile(schema('fe-f-v2.json'));
const validarCcf = ajv.compile(schema('fe-ccf-v4.json'));
const validarInvalidacion = ajv.compile(schema('invalidacion-schema-v3.json'));
const validarContingencia = ajv.compile(schema('contingencia-schema-v4.json'));

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

let fallos = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) { console.error('FALLA: ' + msg); fallos++; }
}

function validar(fn: ReturnType<typeof ajv.compile>, doc: unknown, etiqueta: string) {
  if (fn(doc)) return;
  fallos++;
  console.error('FALLA esquema ' + etiqueta + ':');
  for (const e of fn.errors ?? []) {
    console.error('   ' + (e.instancePath || '/') + ' ' + e.message +
      (e.params ? ' ' + JSON.stringify(e.params) : ''));
  }
}

const EMISOR: Emisor = {
  nit: '02032001831034',
  nrc: '3771710',
  nombre: 'MORAN MELGAR, GERSON OBED',
  nombre_comercial: 'LOS POLLOS PRIMOS',
  cod_actividad: '56299',
  desc_actividad: 'Servicios de preparación de comidas ncp',
  departamento: '02',
  municipio: '17',
  distrito: '05',
  complemento: 'PLAZA LAS PALMERAS LOCAL 5, CHALCHUAPA, SANTA ANA',
  telefono: '72830282',
  correo: 'admin@los-pollosprimos.com',
  cod_estable: 'M001',
  cod_punto_venta: 'P001',
};

const BASE = {
  ambiente: '00',
  codigoGeneracion: 'A1B2C3D4-E5F6-4A7B-8C9D-0E1F2A3B4C5D',
  fecEmi: '2026-08-27',
  horEmi: '13:45:09',
  emisor: EMISOR,
} as const;

// ---------- Factura (fe-f-v2) ----------

const factura = construirDte({
  ...BASE,
  tipoDte: '01',
  numeroControl: 'DTE-01-M001P001-000000000000001',
  receptor: null,
  items: [
    { codigo: 'COMBO1', descripcion: 'El Primo — Combo Medio', cantidad: 2, precioUnitario: 6.95 },
    { codigo: 'DELIVERY', descripcion: 'Servicio de entrega a domicilio', cantidad: 1, precioUnitario: 2.5 },
  ],
  codigoPago: '01',
});
validar(validarFactura, factura.documento, 'factura fe-f-v2');

// En la factura los precios llevan IVA: lo cobrado debe ser exactamente la suma
// de los ítems del menú, sin que el redondeo del IVA mueva un centavo.
ok(factura.totales.total_pagar === 16.4, 'total factura: ' + factura.totales.total_pagar);
ok(
  r2(factura.totales.total_gravado + factura.totales.total_iva) === factura.totales.total_pagar,
  'base + IVA debe dar el total cobrado en la factura',
);

// ---------- CCF (fe-ccf-v4) ----------

const ccf = construirDte({
  ...BASE,
  tipoDte: '03',
  numeroControl: 'DTE-03-M001P001-000000000000001',
  receptor: {
    nit: '06142211860013',
    nrc: '282359',
    nombre: 'PATRONIC, S.A. DE C.V.',
    codActividad: '10792',
    descActividad: 'Elaboracion de especies, sazonadores y condimentos',
    correo: 'ventas@ejemplo.com',
    telefono: '22188300',
    direccion: { departamento: '05', municipio: '11', distrito: '01', complemento: 'SANTA TECLA' },
  },
  items: [
    { codigo: 'COMBO1', descripcion: 'El Primo — Combo Medio', cantidad: 3, precioUnitario: 6.95 },
  ],
  codigoPago: '03',
});
validar(validarCcf, ccf.documento, 'ccf fe-ccf-v4');

// En el CCF el precio va sin IVA, pero el total a pagar sigue siendo lo cobrado.
ok(ccf.totales.total_pagar === 20.85, 'total ccf: ' + ccf.totales.total_pagar);
ok(
  r2(ccf.totales.total_gravado + ccf.totales.total_iva) === ccf.totales.total_pagar,
  'base + IVA debe dar el total cobrado en el CCF',
);

// La suma de los ítems tiene que cuadrar con el resumen: el MH lo valida y un
// centavo de diferencia por redondeo rechaza el documento.
const sumaCcf = ccf.documento.cuerpoDocumento.reduce((s, i) => s + i.ventaGravada, 0);
ok(
  Math.abs(sumaCcf - ccf.documento.resumen.totalGravada) < 0.005,
  'los ítems del CCF deben sumar totalGravada',
);

// ---------- número a letras ----------

ok(numeroALetras(3.56) === 'TRES 56/100', 'letras 3.56: ' + numeroALetras(3.56));
ok(numeroALetras(0) === 'CERO 00/100', 'letras 0');
ok(numeroALetras(1000) === 'MIL 00/100', 'letras 1000: ' + numeroALetras(1000));
ok(numeroALetras(21.5) === 'VEINTIUNO 50/100', 'letras 21.5: ' + numeroALetras(21.5));
// El CCF exige totalLetras de 8 caracteres mínimo.
ok(numeroALetras(0).length >= 8, 'totalLetras debe tener 8 caracteres o más');

// ---------- Evento de Invalidación (invalidacion-schema-v3) ----------

const EMISOR_INV = {
  nit: '02032001831034',
  nombre: 'MORAN MELGAR, GERSON OBED',
  cod_estable_mh: 'M001',
  cod_punto_venta_mh: 'P001',
  cod_estable: 'M001',
  cod_punto_venta: 'P001',
  telefono: '72830282',
  correo: 'admin@los-pollosprimos.com',
};

// El sello del MH son 40 caracteres exactos; se usa el de un DTE real recibido
// para no inventar un largo que el esquema rechazaría.
const SELLO = '202675BD9489338C4DD9B840EE5B8F4389DDU6FG';
ok(SELLO.length === 40, 'el sello de prueba debe tener 40 caracteres');

const CAJERO = { nombre: 'GERSON MORAN', tipoDocumento: '13', numDocumento: '012345678' };

const invalidacion = construirInvalidacion({
  ambiente: '00',
  codigoGeneracion: 'B2C3D4E5-F6A7-4B8C-9D0E-1F2A3B4C5D6E',
  fecEmi: '2026-08-27',
  horEmi: '14:10:00',
  emisor: EMISOR_INV,
  documento: {
    tipoDte: '01',
    codigoGeneracion: 'A1B2C3D4-E5F6-4A7B-8C9D-0E1F2A3B4C5D',
    selloRecibido: SELLO,
    numeroControl: 'DTE-01-M001P001-000000000000001',
    fecEmi: '2026-08-27',
  },
  tipoAnulacion: TIPO_ANULACION.RESCINDIR_OPERACION,
  motivoAnulacion: 'El cliente canceló el pedido antes de la entrega',
  responsable: CAJERO,
  solicita: CAJERO,
});
validar(validarInvalidacion, invalidacion, 'invalidacion v3');

// Reglas de negocio que el esquema NO puede expresar y el MH sí exige:
let rechazoSinReemplazo = false;
try {
  construirInvalidacion({
    ambiente: '00',
    codigoGeneracion: 'B2C3D4E5-F6A7-4B8C-9D0E-1F2A3B4C5D6E',
    fecEmi: '2026-08-27', horEmi: '14:10:00',
    emisor: EMISOR_INV,
    documento: {
      tipoDte: '01', codigoGeneracion: 'A1B2C3D4-E5F6-4A7B-8C9D-0E1F2A3B4C5D',
      selloRecibido: SELLO, numeroControl: null, fecEmi: '2026-08-27',
    },
    // tipo 1 sin codigoGeneracionR: el MH lo rechaza
    tipoAnulacion: TIPO_ANULACION.ERROR_EN_INFORMACION,
    responsable: CAJERO, solicita: CAJERO,
  });
} catch { rechazoSinReemplazo = true; }
ok(rechazoSinReemplazo, 'tipoAnulacion 1 sin documento de reemplazo debe fallar');

let rechazoSinSello = false;
try {
  construirInvalidacion({
    ambiente: '00',
    codigoGeneracion: 'B2C3D4E5-F6A7-4B8C-9D0E-1F2A3B4C5D6E',
    fecEmi: '2026-08-27', horEmi: '14:10:00',
    emisor: EMISOR_INV,
    documento: {
      tipoDte: '01', codigoGeneracion: 'A1B2C3D4-E5F6-4A7B-8C9D-0E1F2A3B4C5D',
      selloRecibido: '', numeroControl: null, fecEmi: '2026-08-27',
    },
    tipoAnulacion: TIPO_ANULACION.OTRO,
    responsable: CAJERO, solicita: CAJERO,
  });
} catch { rechazoSinSello = true; }
ok(rechazoSinSello, 'no se puede invalidar un DTE que el MH nunca selló');

// ---------- Factura emitida EN contingencia (fe-f-v2, modelo 2) ----------

const enContingencia = construirDte({
  ...BASE,
  tipoDte: '01',
  numeroControl: 'DTE-01-M001P001-000000000000002',
  receptor: null,
  items: [{ codigo: 'MEDIO', descripcion: 'Medio pollo', cantidad: 1, precioUnitario: 6.0 }],
  contingencia: { tipo: 3 },
});
validar(validarFactura, enContingencia.documento, 'factura en contingencia');
ok(enContingencia.documento.identificacion.tipoModelo === 2, 'contingencia: tipoModelo debe ser 2');
ok(enContingencia.documento.identificacion.tipoOperacion === 2, 'contingencia: tipoOperacion debe ser 2');
ok(enContingencia.documento.identificacion.tipoContingencia === 3, 'contingencia: tipoContingencia debe ir');
// La emision normal no debe arrastrar nada de contingencia.
ok(factura.documento.identificacion.tipoModelo === 1, 'emision normal: tipoModelo 1');
ok(factura.documento.identificacion.tipoContingencia === null, 'emision normal: sin tipoContingencia');

// ---------- Evento de Contingencia (contingencia-schema-v4) ----------

const contingencia = construirContingencia({
  ambiente: '00',
  codigoGeneracion: 'C3D4E5F6-A7B8-4C9D-8E0F-1A2B3C4D5E6F',
  fTransmision: '2026-08-27',
  hTransmision: '20:00:00',
  emisor: {
    nit: '02032001831034',
    nombre: 'MORAN MELGAR, GERSON OBED',
    tipo_establecimiento: '01',
    cod_estable_mh: 'M001',
    cod_punto_venta_mh: 'P001',
    telefono: '72830282',
    correo: 'admin@los-pollosprimos.com',
  },
  responsable: CAJERO,
  documentos: [{ tipoDte: '01', codigoGeneracion: 'A1B2C3D4-E5F6-4A7B-8C9D-0E1F2A3B4C5D' }],
  tipoContingencia: TIPO_CONTINGENCIA.FALLA_INTERNET,
  motivoContingencia: null,
  fInicio: '2026-08-27', hInicio: '18:00:00',
  fFin: '2026-08-27', hFin: '19:30:00',
});
validar(validarContingencia, contingencia, 'contingencia v4');

// El tipo 5 es "otro": sin descripcion el MH no sabe que paso.
let rechazoSinMotivo = false;
try {
  construirContingencia({
    ambiente: '00', codigoGeneracion: 'C3D4E5F6-A7B8-4C9D-8E0F-1A2B3C4D5E6F',
    fTransmision: '2026-08-27', hTransmision: '20:00:00',
    emisor: {
      nit: '02032001831034', nombre: 'X', tipo_establecimiento: '01',
      cod_estable_mh: 'M001', cod_punto_venta_mh: 'P001',
      telefono: '72830282', correo: 'admin@los-pollosprimos.com',
    },
    responsable: CAJERO,
    documentos: [{ tipoDte: '01', codigoGeneracion: 'A1B2C3D4-E5F6-4A7B-8C9D-0E1F2A3B4C5D' }],
    tipoContingencia: TIPO_CONTINGENCIA.OTRO,
    fInicio: '2026-08-27', hInicio: '18:00:00', fFin: '2026-08-27', hFin: '19:30:00',
  });
} catch { rechazoSinMotivo = true; }
ok(rechazoSinMotivo, 'tipoContingencia 5 sin motivo debe fallar');

if (fallos > 0) {
  console.error('\n' + fallos + ' falla(s)');
  process.exit(1);
}
console.log('OK — factura, CCF, invalidación y contingencia validan contra los esquemas del MH');
