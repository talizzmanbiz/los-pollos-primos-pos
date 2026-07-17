/**
 * Central business info for the public consumer site (los-pollosprimos.com).
 *
 * The POS lives on the `pos.` subdomain and is unaffected by this file.
 *
 * ⚠️ FILL THE `TODO` FIELDS BELOW. Anything left as an empty string is
 * intentionally *hidden* on the live site (pages skip empty contact rows),
 * so the site never shows placeholder/fake data to customers or to Meta.
 */

export const site = {
  name: 'Los Pollos Primos',
  brand: 'Ahumado Tropical',
  domain: 'los-pollosprimos.com',
  url: 'https://los-pollosprimos.com',

  // What makes us different (used on Home + Nosotros).
  tagline: 'Pollo rostizado, ahumado tropical.',
  differentiator:
    'Nuestro pollo se marina en jugo de piña natural y paprika ahumada, ' +
    'y se rostiza lento hasta quedar jugoso por dentro y dorado por fuera. ' +
    'Ese es el sabor Ahumado Tropical que solo encontrás en Los Pollos Primos.',

  city: 'Chalchuapa, Santa Ana, El Salvador',

  // ── Contact — REAL DATA REQUIRED for Meta compliance ─────────────────
  // Public WhatsApp Business number in international format, digits only
  // (e.g. '50371234567'). Leave '' to hide the WhatsApp button.
  // Public WhatsApp = the chatbot line where customers place orders (not the
  // internal staff number 7283 0282).
  whatsappNumber: '50370476975',
  whatsappDisplay: '+503 7047 6975',
  email: 'admin@los-pollosprimos.com',
  // Street / reference address of Sucursal Central for the "dirección física".
  addressLine:
    '7a Av. Norte y 6a Calle Oriente #28, Barrio Las Ánimas, Chalchuapa, Santa Ana — Plaza Las Palmeras, Local 5',
  mapsUrl: '', // opcional: enlace de Google Maps de Sucursal Central

  // Social (optional — leave '' to hide).
  instagram: '', // TODO opcional, ej. 'https://instagram.com/lospollosprimos'
  facebook: '', // TODO opcional

  // ── Operations (known) ───────────────────────────────────────────────
  hours: [
    { days: 'Martes a Domingo', time: '10:00 a.m. – 2:00 p.m.' },
    { days: 'Lunes', time: 'Cerrado' },
  ],
  hoursShort: 'Mar–Dom · 10 a.m. – 2 p.m. · Lunes cerrado',
  prepTime: '30–45 minutos',
  delivery: {
    note: 'Delivery solo desde Sucursal Central',
    zones: [
      { name: 'Zona 1', fee: '$1.00' },
      { name: 'Zona 2', fee: '$1.50' },
    ],
  },
} as const;

/** wa.me link to open a WhatsApp chat, optionally with a prefilled message. */
export function whatsappLink(message?: string): string {
  if (!site.whatsappNumber) return '';
  const base = `https://wa.me/${site.whatsappNumber}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/**
 * True when we're being served on the internal POS host (`pos.…`).
 * On the apex/www host (and on localhost for previewing) this is false,
 * so `/` renders the public marketing site.
 */
export function isPosHost(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.startsWith('pos.');
}
