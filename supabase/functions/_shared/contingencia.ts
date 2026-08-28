// Evento de Contingencia del Ministerio de Hacienda.
//
// Esquema oficial: contingencia-schema-v4.json (identificacion.version = 4).
//
// Se transmite cuando el negocio siguió vendiendo sin poder llegar al MH —se
// cayó internet, se fue la luz, el MH estaba abajo— y declara el periodo de la
// falla junto con la lista de documentos que se emitieron durante ella.
//
// Es el otro lado del diseño que ya tiene emit-dte: cuando el firmador o el MH
// fallan, la venta NO se bloquea y el DTE queda en 'contingencia'. Este evento
// es lo que después le explica a Hacienda por qué esos documentos llegaron
// tarde.

/** CAT-005. El tipo 5 es el unico que exige describir el motivo. */
export const TIPO_CONTINGENCIA = {
  NO_DISPONIBLE_MH: 1,
  NO_DISPONIBLE_EMISOR: 2,
  FALLA_INTERNET: 3,
  FALLA_ENERGIA: 4,
  OTRO: 5,
} as const;

export type TipoContingencia =
  (typeof TIPO_CONTINGENCIA)[keyof typeof TIPO_CONTINGENCIA];

export interface EmisorContingencia {
  nit: string;
  nombre: string;
  tipo_establecimiento: string;
  cod_estable_mh: string | null;
  cod_punto_venta_mh: string | null;
  telefono: string | null;
  correo: string;
}

export interface Responsable {
  nombre: string;
  tipoDocumento: string;   // CAT-022: '13' DUI · '36' NIT
  numDocumento: string;
}

export interface DocumentoEnContingencia {
  tipoDte: string;
  codigoGeneracion: string;
}

export interface DatosContingencia {
  ambiente: string;
  codigoGeneracion: string;   // el del EVENTO
  fTransmision: string;
  hTransmision: string;
  emisor: EmisorContingencia;
  responsable: Responsable;
  documentos: DocumentoEnContingencia[];
  tipoContingencia: TipoContingencia;
  motivoContingencia?: string | null;
  fInicio: string;
  hInicio: string;
  fFin: string;
  hFin: string;
}

export function construirContingencia(d: DatosContingencia) {
  if (d.documentos.length === 0) {
    throw new Error('un evento de contingencia sin documentos no tiene nada que declarar');
  }
  if (d.documentos.length > 1000) {
    throw new Error('el MH admite hasta 1000 documentos por evento de contingencia');
  }
  // El tipo 5 es "otro", asi que sin descripcion el MH no sabe que paso.
  if (d.tipoContingencia === TIPO_CONTINGENCIA.OTRO && !d.motivoContingencia) {
    throw new Error('tipoContingencia 5 exige describir el motivo');
  }

  return {
    identificacion: {
      version: 4,
      ambiente: d.ambiente,
      codigoGeneracion: d.codigoGeneracion.toUpperCase(),
      fTransmision: d.fTransmision,
      hTransmision: d.hTransmision,
    },
    emisor: {
      nit: d.emisor.nit.replace(/-/g, ''),
      nombre: d.emisor.nombre,
      nombreResponsable: d.responsable.nombre,
      tipoDocResponsable: d.responsable.tipoDocumento,
      numeroDocResponsable: d.responsable.numDocumento,
      tipoEstablecimiento: d.emisor.tipo_establecimiento,
      codEstableMH: d.emisor.cod_estable_mh ?? null,
      codPuntoVentaMH: d.emisor.cod_punto_venta_mh ?? null,
      telefono: d.emisor.telefono ?? '',
      correo: d.emisor.correo,
    },
    detalleDTE: d.documentos.map((doc, i) => ({
      noItem: i + 1,
      tipoDoc: doc.tipoDte,
      codigoGeneracion: doc.codigoGeneracion.toUpperCase(),
    })),
    motivo: {
      fInicio: d.fInicio,
      fFin: d.fFin,
      hInicio: d.hInicio,
      hFin: d.hFin,
      tipoContingencia: d.tipoContingencia,
      motivoContingencia: d.motivoContingencia ?? null,
    },
  };
}
