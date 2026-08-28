// Construcción del JSON del Documento Tributario Electrónico (El Salvador).
//
// Esquemas oficiales implementados (copiados en ./schemas/ para poder validar
// contra ellos en dte.check.ts). Ojo: NO son la misma versión.
//   fe-f-v2   → tipoDte "01" Factura .............. identificacion.version = 2
//   fe-ccf-v4 → tipoDte "03" Crédito Fiscal ....... identificacion.version = 4
//
// Los tres errores que hacen rechazar el documento y no son obvios:
//
//   1. `additionalProperties: false` en TODOS los bloques. Un campo de más
//      rechaza igual que uno de menos. Nada de `extension`, `tipoEstablecimiento`,
//      `codEstableMH` ni `codPuntoVentaMH` dentro de `emisor`: existen en otros
//      esquemas del MH, no en estos dos.
//
//   2. El receptor tiene forma DISTINTA en cada uno. La factura identifica al
//      cliente con tipoDocumento+numDocumento y admite null (consumidor final);
//      el CCF lo identifica con `nit` y es obligatorio.
//
//   3. En la FACTURA los precios llevan IVA incluido y `totalIva` es
//      informativo. En el CCF los precios van SIN IVA, el IVA se declara como
//      tributo "20" en `resumen.tributos`, y `totalIva` NO existe en el resumen
//      (ahí van `ivaPerci` e `ivaRete`).
//
// Este módulo no toca Deno ni la red a propósito: así el mismo código se
// verifica desde Node contra los esquemas reales (ver dte.check.ts).

export const IVA_RATE = 0.13;
const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface Emisor {
  nit: string;
  nrc: string;
  nombre: string;
  nombre_comercial: string | null;
  cod_actividad: string;
  desc_actividad: string;
  departamento: string;
  municipio: string;
  distrito: string;
  complemento: string;
  telefono: string | null;
  correo: string;
  /** Asignados por el contribuyente. Van dentro del bloque emisor. */
  cod_estable: string | null;
  cod_punto_venta: string | null;
}

export interface Receptor {
  /** Sólo factura: '36' NIT · '13' DUI · '37' otro */
  tipoDocumento?: string;
  numDocumento?: string;
  /** Sólo CCF: el NIT va en su propio campo. */
  nit?: string;
  nrc?: string | null;
  nombre?: string;
  nombreComercial?: string | null;
  codActividad?: string | null;
  descActividad?: string | null;
  correo?: string | null;
  telefono?: string | null;
  direccion?: {
    departamento: string; municipio: string; distrito: string; complemento: string;
  } | null;
}

export interface ItemVenta {
  codigo: string;
  descripcion: string;
  cantidad: number;
  /** Precio unitario tal como se cobra en caja (IVA incluido). */
  precioUnitario: number;
}

export interface DatosDte {
  tipoDte: '01' | '03';
  ambiente: string;          // '00' prueba · '01' producción
  numeroControl: string;
  codigoGeneracion: string;  // UUID en MAYÚSCULAS
  fecEmi: string;            // YYYY-MM-DD
  horEmi: string;            // HH:MM:SS
  emisor: Emisor;
  receptor?: Receptor | null;
  items: ItemVenta[];
  /** CAT-017: 01 efectivo · 02 débito · 03 crédito · 05 transferencia */
  codigoPago?: string;
  /**
   * Emisión en contingencia: el documento se generó sin poder llegar al MH y
   * se transmite después, ya declarado en un evento de contingencia. El MH
   * rechaza declarar en contingencia un documento que ya transmitiste, así que
   * el orden es: generar → declarar el evento → transmitir.
   */
  contingencia?: { tipo: number; motivo?: string | null } | null;
}

// ---------- número a letras (obligatorio en resumen.totalLetras) ----------

const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO',
  'DIECINUEVE', 'VEINTE'];
const DECENAS = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA',
  'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
  'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

function menorAMil(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  const cien = CENTENAS[c];
  let dec: string;
  if (resto <= 20) {
    dec = UNIDADES[resto];
  } else if (resto < 30) {
    dec = 'VEINTI' + UNIDADES[resto - 20];
  } else {
    const d = Math.floor(resto / 10);
    const u = resto % 10;
    dec = DECENAS[d] + (u ? ' Y ' + UNIDADES[u] : '');
  }
  return [cien, dec].filter(Boolean).join(' ');
}

/**
 * 12.95 → "DOCE 95/100". El CCF exige totalLetras de 8 caracteres como mínimo,
 * y "CERO 00/100" ya son 11, así que cualquier monto cumple.
 */
export function numeroALetras(monto: number): string {
  const entero = Math.floor(r2(monto));
  const centavos = Math.round((r2(monto) - entero) * 100);
  const cents = String(centavos).padStart(2, '0') + '/100';

  if (entero === 0) return 'CERO ' + cents;

  const millones = Math.floor(entero / 1_000_000);
  const miles = Math.floor((entero % 1_000_000) / 1000);
  const resto = entero % 1000;

  const partes: string[] = [];
  if (millones === 1) partes.push('UN MILLON');
  else if (millones > 1) partes.push(menorAMil(millones) + ' MILLONES');
  if (miles === 1) partes.push('MIL');
  else if (miles > 1) partes.push(menorAMil(miles) + ' MIL');
  if (resto > 0) partes.push(menorAMil(resto));

  return partes.join(' ') + ' ' + cents;
}

// ---------- construcción del documento ----------

/**
 * Bloque emisor. Idéntico en fe-f-v2 y fe-ccf-v4, y en ambos los únicos códigos
 * de establecimiento admitidos son los del contribuyente. Los códigos del MH
 * (codEstableMH/codPuntoVentaMH) NO van acá: viven dentro del numeroControl.
 */
function bloqueEmisor(e: Emisor) {
  return {
    nit: e.nit.replace(/-/g, ''),
    nrc: e.nrc.replace(/-/g, ''),
    nombre: e.nombre,
    codActividad: e.cod_actividad,
    descActividad: e.desc_actividad,
    nombreComercial: e.nombre_comercial ?? null,
    direccion: {
      departamento: e.departamento,
      municipio: e.municipio,
      distrito: e.distrito,
      complemento: e.complemento,
    },
    telefono: e.telefono ?? null,
    correo: e.correo,
    codEstable: e.cod_estable ?? null,
    codPuntoVenta: e.cod_punto_venta ?? null,
  };
}

/**
 * Arma el JSON completo del DTE.
 * Devuelve también los totales ya redondeados para guardarlos en la fila de
 * `dte_documents` sin recalcularlos (y que no se desfasen del documento firmado).
 */
export function construirDte(d: DatosDte) {
  const esFactura = d.tipoDte === '01';

  // Lo que la caja cobra: los precios del menú ya llevan IVA.
  const totalConIva = r2(d.items.reduce((s, it) => s + r2(it.precioUnitario * it.cantidad), 0));
  // La factura declara el monto con IVA; el CCF declara la base.
  const totalGravada = esFactura ? totalConIva : r2(totalConIva / (1 + IVA_RATE));
  // Se despeja por resta, nunca por multiplicación: así base + IVA da exactamente
  // lo cobrado y el documento nunca difiere un centavo del ingreso registrado.
  const totalIva = r2(totalConIva - (esFactura ? r2(totalConIva / (1 + IVA_RATE)) : totalGravada));
  const montoTotalOperacion = totalConIva;

  const cuerpoDocumento = d.items.map((it, i) => {
    const bruto = r2(it.precioUnitario * it.cantidad);
    const precioUni = esFactura ? r2(it.precioUnitario) : it.precioUnitario / (1 + IVA_RATE);
    const ventaGravada = esFactura ? bruto : r2(bruto / (1 + IVA_RATE));
    return {
      numItem: i + 1,
      tipoItem: 1,                 // 1 = bienes
      numeroDocumento: null,
      codigo: it.codigo,
      codTributo: null,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      uniMedida: 59,               // CAT-014: unidad
      // El CCF admite hasta 8 decimales en precioUni; se conserva la precisión
      // para que precioUni × cantidad reproduzca ventaGravada.
      precioUni: esFactura ? precioUni : Math.round(precioUni * 1e6) / 1e6,
      montoDescu: 0,
      ventaNoSuj: 0,
      ventaExenta: 0,
      ventaGravada,
      tributos: esFactura ? null : ['20'],
      psv: 0,
      noGravado: 0,
      // Sólo la factura lleva ivaItem; en fe-ccf-v4 el campo ni existe y
      // additionalProperties:false lo rechazaría.
      ...(esFactura ? { ivaItem: r2(bruto - bruto / (1 + IVA_RATE)) } : {}),
    };
  });

  // Redondear ítem por ítem puede dejar un centavo suelto contra el total del
  // documento. El MH valida que la suma de los ítems cuadre con el resumen, así
  // que el residuo se absorbe en el último ítem.
  const sumaItems = r2(cuerpoDocumento.reduce((s, it) => s + it.ventaGravada, 0));
  const residuo = r2(totalGravada - sumaItems);
  if (residuo !== 0 && cuerpoDocumento.length > 0) {
    const ultimo = cuerpoDocumento[cuerpoDocumento.length - 1];
    ultimo.ventaGravada = r2(ultimo.ventaGravada + residuo);
    ultimo.precioUni = Math.round((ultimo.ventaGravada / ultimo.cantidad) * 1e6) / 1e6;
  }

  const comunes = {
    totalNoSuj: 0,
    totalExenta: 0,
    totalGravada,
    subTotalVentas: totalGravada,
    descuNoSuj: 0,
    descuExenta: 0,
    descuGravada: 0,
    porcentajeDescuento: 0,
    totalDescu: 0,
    subTotal: totalGravada,
    montoTotalOperacion,
    totalNoGravado: 0,
    totalPagar: montoTotalOperacion,
    totalLetras: numeroALetras(montoTotalOperacion),
    saldoFavor: 0,
    condicionOperacion: 1,       // contado
    pagos: [{
      codigo: d.codigoPago ?? '01',
      montoPago: montoTotalOperacion,
      referencia: null,
      plazo: null,
      periodo: null,
    }],
    numPagoElectronico: null,
    observaciones: null,
  };

  // Los dos resúmenes divergen justo en el IVA: la factura lo informa en
  // `totalIva`; el CCF lo declara como tributo y en su lugar pide ivaPerci.
  const resumen = esFactura
    ? { ...comunes, tributos: null, ivaRete: 0, totalIva }
    : {
        ...comunes,
        tributos: [
          { codigo: '20', descripcion: 'Impuesto al Valor Agregado 13%', valor: totalIva },
        ],
        ivaPerci: 0,
        ivaRete: 0,
      };

  const dir = d.receptor?.direccion ?? null;

  // Factura: identifica al cliente por tipo+número de documento, y va en null
  // cuando es consumidor final anónimo.
  const receptorFactura = d.receptor && (d.receptor.numDocumento || d.receptor.nombre)
    ? {
        tipoDocumento: d.receptor.tipoDocumento ?? '36',
        numDocumento: (d.receptor.numDocumento ?? '').replace(/-/g, '') || null,
        nrc: d.receptor.nrc ? d.receptor.nrc.replace(/-/g, '') : null,
        nombre: d.receptor.nombre ?? null,
        codActividad: d.receptor.codActividad ?? null,
        descActividad: d.receptor.descActividad ?? null,
        direccion: dir,
        telefono: d.receptor.telefono ?? null,
        correo: d.receptor.correo ?? null,
      }
    : null;

  // CCF: el receptor es obligatorio y se identifica por NIT; además exige
  // actividad económica y dirección, porque siempre es un contribuyente.
  const receptorCcf = {
    nit: (d.receptor?.nit ?? d.receptor?.numDocumento ?? '').replace(/-/g, ''),
    nrc: d.receptor?.nrc ? d.receptor.nrc.replace(/-/g, '') : null,
    nombre: d.receptor?.nombre ?? '',
    codActividad: d.receptor?.codActividad ?? '',
    descActividad: d.receptor?.descActividad ?? '',
    nombreComercial: d.receptor?.nombreComercial ?? null,
    direccion: dir,
    telefono: d.receptor?.telefono ?? null,
    correo: d.receptor?.correo ?? null,
  };

  const documento = {
    identificacion: {
      version: esFactura ? 2 : 4,
      ambiente: d.ambiente,
      tipoDte: d.tipoDte,
      numeroControl: d.numeroControl,
      codigoGeneracion: d.codigoGeneracion.toUpperCase(),
      // Modelo 1 / operación 1 es la emisión normal. El 2/2 le dice al MH que
      // el documento se generó sin conexión y se transmite después, ya
      // declarado en un evento de contingencia.
      tipoModelo: d.contingencia ? 2 : 1,
      tipoOperacion: d.contingencia ? 2 : 1,
      tipoContingencia: d.contingencia ? d.contingencia.tipo : null,
      motivoContin: d.contingencia?.motivo ?? null,
      fecEmi: d.fecEmi,
      horEmi: d.horEmi,
      tipoMoneda: 'USD',
    },
    documentoRelacionado: null,
    emisor: bloqueEmisor(d.emisor),
    receptor: esFactura ? receptorFactura : receptorCcf,
    otrosDocumentos: null,
    ventaTercero: null,
    cuerpoDocumento,
    resumen,
    apendice: null,
  };

  return {
    documento,
    totales: {
      total_gravado: esFactura ? r2(totalGravada - totalIva) : totalGravada,
      total_exento: 0,
      total_iva: totalIva,
      total_pagar: montoTotalOperacion,
    },
  };
}
