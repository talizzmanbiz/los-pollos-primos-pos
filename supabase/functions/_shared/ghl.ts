// Esquema único de contacto para GoHighLevel.
//
// Las tres fuentes (bot de WhatsApp, sitio web y POS) escriben en el MISMO
// location de GHL. Si el teléfono no llega siempre en el mismo formato, o si
// cada fuente inventa sus propios tags, GHL no reconoce que es el mismo cliente
// y termina con contactos duplicados. Por eso el armado del contacto vive acá y
// no en cada función: hay un solo lugar donde puede desincronizarse.
//
//   firstName  requerido      (GHL compone `name` con firstName + lastName)
//   phone      E.164          +503XXXXXXXX — la llave de deduplicación
//   email      opcional
//   source     whatsapp | website | pos
//   tags       [base, canal, estado]
//
// El enum `order_source` de Postgres usa 'online' para el sitio web; el esquema
// de contacto usa 'website'. `canalDesdeOrden()` es el único traductor.

export const GHL_BASE = 'https://services.leadconnectorhq.com';
export const GHL_VERSION = '2021-07-28';

/** Tag que llevan TODOS los contactos, sin importar la fuente. */
export const TAG_BASE = 'los-pollos-primos';

export type Canal = 'whatsapp' | 'website' | 'pos';
/** 'pedido-completado' = pagó o se le entregó. 'intento-pedido' = dio sus datos pero no cerró. */
export type Estado = 'pedido-completado' | 'intento-pedido';

const TAG_CANAL: Record<Canal, string> = {
  whatsapp: 'whatsapp-customer',
  website: 'website-customer',
  pos: 'pos-customer',
};

const SOURCE_LEGIBLE: Record<Canal, string> = {
  whatsapp: 'WhatsApp Bot',
  website: 'Sitio Web',
  pos: 'POS',
};

/** order_source (Postgres) → canal del esquema de contacto. */
export function canalDesdeOrden(source: string | null | undefined): Canal {
  if (source === 'whatsapp') return 'whatsapp';
  if (source === 'pos') return 'pos';
  return 'website'; // 'online' y cualquier valor nuevo caen acá
}

/**
 * Teléfono salvadoreño a E.164. Es la llave con la que GHL deduplica, así que
 * las tres fuentes tienen que pasar por acá aunque cada una lo capture distinto:
 * el POS lo teclea un cajero ("7000-1111"), el sitio lo valida como tel y
 * WhatsApp lo manda ya con país ("50370001111").
 */
export function toE164(raw: string | null | undefined): string {
  let digits = String(raw ?? '').replace(/\D/g, '');
  // Prefijo internacional marcado a mano: 00503... → 503...
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (!digits) return '';
  return digits.startsWith('503') ? `+${digits}` : `+503${digits}`;
}

/**
 * GHL quiere firstName/lastName por separado. El POS y el bot capturan el
 * nombre en un solo campo, así que partimos por el primer espacio.
 */
export function partirNombre(full: string | null | undefined): {
  firstName: string;
  lastName?: string;
} {
  const limpio = String(full ?? '').trim().replace(/\s+/g, ' ');
  if (!limpio) return { firstName: 'Cliente' }; // firstName es requerido
  const [first, ...resto] = limpio.split(' ');
  return resto.length > 0 ? { firstName: first, lastName: resto.join(' ') } : { firstName: first };
}

export interface DatosContacto {
  locationId: string;
  canal: Canal;
  estado: Estado;
  phone: string;
  name?: string | null;
  email?: string | null;
  address?: string | null;
  /** [{ id, value }] — IDs de campos personalizados de GHL, opcionales. */
  customFields?: { id: string; value: string }[];
}

/**
 * Arma el body de POST /contacts/upsert. Único formato que las tres fuentes
 * mandan a GHL.
 *
 * ponytail: GHL AGREGA tags en el upsert, no los reemplaza. Un cliente que
 * primero dejó sus datos y después pagó queda con 'intento-pedido' Y
 * 'pedido-completado'. Para segmentar "no compró" hay que filtrar por
 * pedido-completado ausente, no por intento-pedido presente. Si algún día
 * estorba, se limpia con DELETE /contacts/{id}/tags antes del upsert.
 */
export function armarContacto(d: DatosContacto): Record<string, unknown> {
  const { firstName, lastName } = partirNombre(d.name);

  const body: Record<string, unknown> = {
    locationId: d.locationId,
    firstName,
    phone: toE164(d.phone),
    source: SOURCE_LEGIBLE[d.canal],
    tags: [TAG_BASE, TAG_CANAL[d.canal], d.estado],
  };
  if (lastName) body.lastName = lastName;
  if (d.email?.trim()) body.email = d.email.trim();
  if (d.address?.trim()) {
    body.address1 = d.address.trim();
    body.city = 'Chalchuapa';
    body.state = 'Santa Ana';
    body.country = 'SV';
  }
  if (d.customFields?.length) body.customFields = d.customFields;

  return body;
}

/**
 * ¿El Origin es de un sitio nuestro? Solo aplica al alta de leads desde el
 * navegador, que es la única llamada sin secreto.
 *
 * Se compara contra el hostname parseado y no con includes(): un
 * 'los-pollosprimos.com.attacker.io' pasaría un includes() sin despeinarse.
 */
export function origenPermitido(origin: string | null | undefined): boolean {
  if (!origin) return false;
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return false;
  }
  if (host === 'localhost' || host === '127.0.0.1') return true;
  return host === 'los-pollosprimos.com' ||
    host.endsWith('.los-pollosprimos.com') ||
    host.endsWith('.vercel.app');
}

export function headersGhl(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    Version: GHL_VERSION,
    'Content-Type': 'application/json',
  };
}
