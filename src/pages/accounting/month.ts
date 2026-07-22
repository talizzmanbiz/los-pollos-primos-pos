// Month picker helpers for the accounting section.
// Dates are stored as plain `date` (America/El_Salvador day); we filter on
// [start, endExclusive) and match the IVA view's `year_month` (first of month).

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export interface MonthOpt {
  value: string; // 'YYYY-MM'
  label: string; // 'Julio 2026'
  start: string; // 'YYYY-MM-01'
  endExclusive: string; // first day of next month
}

export function monthOptions(count = 12): MonthOpt[] {
  const now = new Date();
  const opts: MonthOpt[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const next = new Date(y, m + 1, 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    opts.push({
      value: `${y}-${pad(m + 1)}`,
      label: `${MONTHS_ES[m]} ${y}`,
      start: `${y}-${pad(m + 1)}-01`,
      endExclusive: `${next.getFullYear()}-${pad(next.getMonth() + 1)}-01`,
    });
  }
  return opts;
}

export const EXPENSE_TYPE_LABELS: Record<string, string> = {
  ingredientes: 'Ingredientes',
  gas: 'Gas',
  luz: 'Energía eléctrica',
  agua: 'Agua',
  mod: 'Mano de obra',
  alquiler: 'Alquiler',
  empaques: 'Empaques',
  servicios: 'Servicios',
  otros: 'Otros',
};

export const DOC_TYPE_LABELS: Record<string, string> = {
  ccf: 'Comprobante de Crédito Fiscal',
  dte: 'DTE',
  factura: 'Factura',
  recibo: 'Recibo',
  ticket: 'Ticket',
  ninguno: 'Sin documento',
};
