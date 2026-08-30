const TZ = 'America/El_Salvador';

export function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-SV', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-SV', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "2026-08-30" — una columna `date` de Postgres, sin hora ni zona. */
const SOLO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function fmtDate(iso: string): string {
  // Una fecha sin hora NO se puede pasar por new Date() + timeZone. JS la
  // interpreta como medianoche UTC, y al renderizarla en America/El_Salvador
  // (UTC-6) le resta 6 horas y devuelve el día anterior:
  //
  //   "2026-08-30" -> 29/08/2026
  //   "2026-01-01" -> 31/12/2025   ← se cambia de año
  //
  // purchase_date, transaction_date y journal_date son todas `date`, así que
  // esto afectaba a compras, gastos, ingresos y libro diario a la vez. Cuando
  // no hay hora no hay nada que convertir: se reordena el texto y ya.
  if (SOLO_FECHA.test(iso)) {
    const [anio, mes, dia] = iso.split('-');
    return `${dia}/${mes}/${anio}`;
  }
  return new Date(iso).toLocaleDateString('es-SV', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Margin % = (price - cost) / price — computed, never stored. */
export function marginPct(price: number, cost: number | null): number | null {
  if (cost == null || price <= 0) return null;
  return ((price - cost) / price) * 100;
}

export function minutesSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

/** Compact ticket age. A forgotten order renders as "5776 min", which eats half
 *  the card on a phone — roll over to hours/days so it stays ~4 characters. */
export function fmtAge(min: number): string {
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.floor(min / 60)} h`;
  return `${Math.floor(min / 1440)} d`;
}
