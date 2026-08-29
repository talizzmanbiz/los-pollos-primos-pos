// Comunicación con el Ministerio de Hacienda: firma y transmisión.
//
// Vive acá y no dentro de una función porque el contrato con el MH es uno solo
// y lo usan varias: la emisión desde el POS y la batería de pruebas. Tenerlo
// duplicado fue exactamente cómo se coló el bug de las versiones — el sobre
// decía 1/3 mientras el documento firmado decía 2/4.

/** Versión del esquema por tipo de documento. NO es la misma para todos. */
export const VERSION_ESQUEMA: Record<string, number> = {
  '01': 2,   // fe-f-v2    Factura
  '03': 4,   // fe-ccf-v4  Comprobante de Crédito Fiscal
};

export interface RespuestaMh {
  /** Status HTTP crudo. El MH devuelve 200 incluso al rechazar, asi que un
   *  404 o 500 aca casi siempre significa ruta equivocada. */
  _http?: number;
  estado?: string;              // PROCESADO | RECHAZADO
  selloRecibido?: string | null;
  descripcionMsg?: string;
  observaciones?: string[];
}

/**
 * Junta el motivo del rechazo en una línea legible para guardar y mostrar.
 *
 * Si la respuesta no trae ninguno de los campos esperados, se devuelve el JSON
 * crudo en vez de un "respuesta desconocida" que no ayuda a nadie: cuando el MH
 * contesta con otra forma —un 404 por ruta equivocada, un error de gateway— lo
 * único que sirve para diagnosticar es lo que mandó de verdad.
 */
export function motivoRechazo(rta: RespuestaMh): string {
  const conocido = [rta.descripcionMsg, ...(rta.observaciones ?? [])]
    .filter(Boolean).join(' - ');
  if (conocido) return conocido;
  return 'Respuesta no reconocida del MH: ' + JSON.stringify(rta).slice(0, 400);
}

export function apiUrlMh(): string {
  return Deno.env.get('MH_API_URL') ?? 'https://apitest.dtes.mh.gob.sv';
}

// ---------- firmador ----------

/**
 * Firma un documento en el firmador self-hosted del MH.
 * El firmador busca el certificado POR NIT, así que el nit tiene que ser el
 * mismo con el que se generó el .crt (el de 14 dígitos).
 */
export async function firmar(json: unknown, nit: string): Promise<string> {
  const url = Deno.env.get('FIRMADOR_URL');
  const password = Deno.env.get('FIRMADOR_PASSWORD');
  if (!url || !password) {
    throw new Error('Firmador sin configurar (FIRMADOR_URL/FIRMADOR_PASSWORD)');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nit: nit.replace(/-/g, ''),
      activo: true,
      passwordPri: password,
      dteJson: json,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.status !== 'OK' || typeof data?.body !== 'string') {
    throw new Error('Firmador rechazo el documento: ' + JSON.stringify(data?.body ?? data));
  }
  return data.body; // JWS compacto
}

// ---------- autenticación ----------

let tokenCache: { value: string; expiresAt: number } | null = null;

export async function tokenMh(apiUrl: string): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.value;

  const user = Deno.env.get('MH_USER');
  const pwd = Deno.env.get('MH_PASSWORD');
  if (!user || !pwd) throw new Error('Credenciales del MH sin configurar (MH_USER/MH_PASSWORD)');

  const res = await fetch(apiUrl + '/seguridad/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ user, pwd }).toString(),
  });
  const data = await res.json().catch(() => null);
  const token: string | undefined = data?.body?.token;
  if (!res.ok || !token) throw new Error('El MH no devolvio token: ' + JSON.stringify(data));

  // El token del MH dura 24h; se refresca una hora antes por seguridad.
  tokenCache = { value: token, expiresAt: Date.now() + 23 * 3600_000 };
  return token;
}

function cabeceras(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: token.startsWith('Bearer ') ? token : 'Bearer ' + token,
    'User-Agent': 'LosPollosPrimos-POS/1.0',
  };
}

// ---------- transmisión ----------

/** Transmite un DTE firmado a /fesv/recepciondte. */
export async function transmitirDte(
  documentoFirmado: string,
  ambiente: string,
  tipoDte: string,
  codigoGeneracion: string,
): Promise<RespuestaMh> {
  const apiUrl = apiUrlMh();
  const token = await tokenMh(apiUrl);
  const res = await fetch(apiUrl + '/fesv/recepciondte', {
    method: 'POST',
    headers: cabeceras(token),
    body: JSON.stringify({
      ambiente,
      idEnvio: Date.now() % 2_147_483_647,
      // Tiene que coincidir con identificacion.version del documento firmado.
      // Si el sobre dice una version y el JSON otra, el MH rechaza sin aclarar
      // cual de las dos esta mal.
      version: VERSION_ESQUEMA[tipoDte] ?? 2,
      tipoDte,
      documento: documentoFirmado,
      codigoGeneracion: codigoGeneracion.toUpperCase(),
    }),
  });
  // Un 4xx del MH sigue trayendo el motivo del rechazo: se devuelve tal cual.
  const cuerpo = (await res.json().catch(() => ({}))) as RespuestaMh;
  return { ...cuerpo, _http: res.status };
}

/**
 * Transmite un evento de contingencia: declara que el negocio siguió vendiendo
 * sin poder llegar al MH, y qué documentos se emitieron en esa ventana.
 * Va a su propio endpoint y con su propia versión de esquema (v4).
 */
export async function transmitirContingencia(
  eventoFirmado: string,
  ambiente: string,
): Promise<RespuestaMh> {
  const apiUrl = apiUrlMh();
  const token = await tokenMh(apiUrl);
  const ruta = Deno.env.get('MH_CONTINGENCIA_PATH') ?? '/fesv/contingencia';
  const res = await fetch(apiUrl + ruta, {
    method: 'POST',
    headers: cabeceras(token),
    body: JSON.stringify({
      ambiente,
      idEnvio: Date.now() % 2_147_483_647,
      version: 4,
      documento: eventoFirmado,
    }),
  });
  const cuerpo = (await res.json().catch(() => ({}))) as RespuestaMh;
  return { ...cuerpo, _http: res.status };
}

/**
 * Transmite un evento de invalidación. Va a otro endpoint que los DTE y su
 * esquema es el v3, independiente de la versión del documento invalidado.
 */
export async function transmitirInvalidacion(
  eventoFirmado: string,
  ambiente: string,
): Promise<RespuestaMh> {
  const apiUrl = apiUrlMh();
  const token = await tokenMh(apiUrl);
  const ruta = Deno.env.get('MH_ANULAR_PATH') ?? '/fesv/anulardte';
  const res = await fetch(apiUrl + ruta, {
    method: 'POST',
    headers: cabeceras(token),
    body: JSON.stringify({
      ambiente,
      idEnvio: Date.now() % 2_147_483_647,
      version: 3,
      documento: eventoFirmado,
    }),
  });
  const cuerpo = (await res.json().catch(() => ({}))) as RespuestaMh;
  return { ...cuerpo, _http: res.status };
}
