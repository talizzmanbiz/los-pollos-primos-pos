// Evento de Invalidación de un DTE ya sellado por el Ministerio de Hacienda.
//
// Esquema oficial: invalidacion-schema-v3.json (identificacion.version = 3).
//
// Un DTE transmitido y sellado NO se borra ni se edita: se invalida con un
// evento aparte, que también se firma y se transmite. Por eso este módulo no
// vive dentro de dte.ts — es otro documento, con otro esquema y otro endpoint.
//
// Diferencia con la Nota de Crédito, que es la confusión habitual:
//   · INVALIDACIÓN  → el documento no debió existir (se digitó mal, el cliente
//     se arrepintió). Desaparece del cómputo fiscal.
//   · NOTA DE CRÉDITO → el documento estuvo bien pero hay que devolver parte o
//     todo. Sólo aplica sobre CCF, y deja rastro de ambos documentos.
//
// Para la factura de consumidor final el mecanismo correcto es este, no la NC.

/** CAT-024. El 1 obliga a informar el DTE que reemplaza al invalidado. */
export const TIPO_ANULACION = {
  ERROR_EN_INFORMACION: 1,
  RESCINDIR_OPERACION: 2,
  OTRO: 3,
} as const;

export type TipoAnulacion = (typeof TIPO_ANULACION)[keyof typeof TIPO_ANULACION];

export interface EmisorInvalidacion {
  nit: string;
  nombre: string;
  /** Asignados por el MH. Acá NO admiten null, a diferencia del DTE. */
  cod_estable_mh: string;
  cod_punto_venta_mh: string;
  cod_estable: string | null;
  cod_punto_venta: string | null;
  telefono: string | null;
  correo: string;
}

export interface DocumentoAInvalidar {
  tipoDte: string;
  codigoGeneracion: string;
  /** El sello que devolvió el MH al recibirlo. Son 40 caracteres exactos. */
  selloRecibido: string;
  numeroControl: string | null;
  fecEmi: string;
  /** Datos del receptor del documento original, si los hubo. */
  tipoDocumento?: string | null;
  numDocumento?: string | null;
  nombre?: string | null;
  telefono?: string | null;
  correo?: string | null;
}

export interface Responsable {
  nombre: string;
  tipoDocumento: string;   // CAT-022: '13' DUI · '36' NIT · '37' otro
  numDocumento: string;
}

export interface DatosInvalidacion {
  ambiente: string;
  codigoGeneracion: string;   // el del EVENTO, no el del documento invalidado
  fecEmi: string;
  horEmi: string;
  emisor: EmisorInvalidacion;
  documento: DocumentoAInvalidar;
  tipoAnulacion: TipoAnulacion;
  motivoAnulacion?: string | null;
  /** Código de generación del DTE que sustituye al invalidado (tipo 1). */
  codigoGeneracionR?: string | null;
  /** Quien ejecuta la invalidación en el sistema. */
  responsable: Responsable;
  /** Quien la pide. En una cancelación de mostrador suele ser el cliente. */
  solicita: Responsable;
}

export function construirInvalidacion(d: DatosInvalidacion) {
  const t = d.tipoAnulacion;

  // El tipo 1 dice "me equivoqué y ya emití el correcto", así que el MH exige
  // saber cuál es el que reemplaza. Sin eso el evento se rechaza.
  if (t === TIPO_ANULACION.ERROR_EN_INFORMACION && !d.codigoGeneracionR) {
    throw new Error(
      'tipoAnulacion 1 exige el código de generación del DTE que reemplaza al invalidado',
    );
  }
  // Y al revés: informar un reemplazo cuando se rescinde la operación es
  // contradictorio — no hay documento sustituto porque la venta no ocurrió.
  if (t !== TIPO_ANULACION.ERROR_EN_INFORMACION && d.codigoGeneracionR) {
    throw new Error('sólo tipoAnulacion 1 lleva documento de reemplazo');
  }
  if (d.documento.selloRecibido.length !== 40) {
    throw new Error(
      'el sello recibido debe tener 40 caracteres; un DTE sin sello no está ' +
      'sellado por el MH y no se puede invalidar',
    );
  }

  return {
    identificacion: {
      version: 3,
      ambiente: d.ambiente,
      codigoGeneracion: d.codigoGeneracion.toUpperCase(),
      fecEmi: d.fecEmi,
      horEmi: d.horEmi,
      fusion: null,
    },
    emisor: {
      nit: d.emisor.nit.replace(/-/g, ''),
      nombre: d.emisor.nombre,
      codEstableMH: d.emisor.cod_estable_mh,
      codEstable: d.emisor.cod_estable ?? null,
      codPuntoVentaMH: d.emisor.cod_punto_venta_mh,
      codPuntoVenta: d.emisor.cod_punto_venta ?? null,
      telefono: d.emisor.telefono ?? '',
      correo: d.emisor.correo,
    },
    documento: {
      tipoDte: d.documento.tipoDte,
      codigoGeneracion: d.documento.codigoGeneracion.toUpperCase(),
      selloRecibido: d.documento.selloRecibido,
      numeroControl: d.documento.numeroControl ?? null,
      fecEmi: d.documento.fecEmi,
      codigoGeneracionR: d.codigoGeneracionR
        ? d.codigoGeneracionR.toUpperCase()
        : null,
      tipoDocumento: d.documento.tipoDocumento ?? null,
      numDocumento: d.documento.numDocumento ?? null,
      nombre: d.documento.nombre ?? null,
      telefono: d.documento.telefono ?? null,
      correo: d.documento.correo ?? null,
    },
    motivo: {
      tipoAnulacion: t,
      motivoAnulacion: d.motivoAnulacion ?? null,
      nombreResponsable: d.responsable.nombre,
      tipDocResponsable: d.responsable.tipoDocumento,
      numDocResponsable: d.responsable.numDocumento,
      nombreSolicita: d.solicita.nombre,
      tipDocSolicita: d.solicita.tipoDocumento,
      numDocSolicita: d.solicita.numDocumento,
    },
  };
}
