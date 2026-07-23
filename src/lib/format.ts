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

export function fmtDate(iso: string): string {
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
