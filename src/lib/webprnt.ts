// Star Micronics TSP143IIIW receipt printing via WebPRNT (HTTP POST to the
// printer's /StarWebPRNT/SendMessage endpoint). No SDK dependency — this is
// the same XML envelope the official StarWebPrintTrader builds.
//
// The printer address is a per-terminal setting stored in localStorage
// (settings button on the POS screen). Note: if the POS is served over HTTPS,
// the browser blocks plain-HTTP printer calls (mixed content) — run the
// terminal against the printer's HTTPS port or serve the POS over HTTP on the
// local network.

const PRINTER_KEY = 'pp-printer-url';

export function getPrinterUrl(): string {
  return localStorage.getItem(PRINTER_KEY) ?? '';
}

export function setPrinterUrl(url: string) {
  localStorage.setItem(PRINTER_KEY, url.trim());
}

function esc(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Minimal WebPRNT request builder (text, alignment, emphasis, feed, cut). */
export class ReceiptBuilder {
  private parts: string[] = [];

  align(position: 'left' | 'center' | 'right'): this {
    this.parts.push(`<alignment position="${position}"/>`);
    return this;
  }

  text(data: string, opts: { emphasis?: boolean; doubleSize?: boolean } = {}): this {
    let el = esc(data);
    if (opts.doubleSize) el = `<textdoublesize width="true" height="true">${el}</textdoublesize>`;
    if (opts.emphasis) el = `<textemphasis>${el}</textemphasis>`;
    this.parts.push(`<text>${el}</text>`);
    return this;
  }

  line(data = ''): this {
    return this.text(`${data}\n`);
  }

  /** Left/right column line for a 32-char (80mm, font A doublewidth-off) row. */
  row(left: string, right: string, width = 42): this {
    const space = Math.max(1, width - left.length - right.length);
    return this.line(left + ' '.repeat(space) + right);
  }

  divider(width = 42): this {
    return this.line('-'.repeat(width));
  }

  feed(lines = 1): this {
    this.parts.push(`<feedline line="${lines}"/>`);
    return this;
  }

  cut(): this {
    this.parts.push('<cutpaper feed="true"/>');
    return this;
  }

  build(): string {
    return (
      '<StarWebPrint xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
      'xmlns:xsd="http://www.w3.org/2001/XMLSchema" ' +
      'xmlns="http://www.star-m.jp/products/s_print/xhtml/StarWebPrint/1.0">' +
      `<Request>${esc(this.parts.join(''))}</Request>` +
      '</StarWebPrint>'
    );
  }
}

export async function sendToPrinter(xml: string): Promise<{ ok: boolean; error?: string }> {
  const base = getPrinterUrl();
  if (!base) return { ok: false, error: 'Impresora no configurada' };
  const url = base.replace(/\/$/, '') + '/StarWebPRNT/SendMessage';
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=UTF-8' },
      body: xml,
    });
    if (!res.ok) return { ok: false, error: `Impresora respondió ${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, error: 'No se pudo conectar con la impresora' };
  }
}

export interface ReceiptData {
  locationName: string;
  orderNumber: string;
  dateTime: string;
  items: { name: string; quantity: number; lineTotal: number }[];
  subtotal: number;
  deliveryFee?: number;
  total: number;
  cashReceived?: number;
  change?: number;
}

export function buildReceipt(data: ReceiptData): string {
  const money = (n: number) => `$${n.toFixed(2)}`;
  const b = new ReceiptBuilder();

  b.align('center')
    .text('LOS POLLOS PRIMOS\n', { emphasis: true, doubleSize: true })
    .line('Ahumado Tropical')
    .line(data.locationName)
    .line('Chalchuapa, Santa Ana')
    .feed(1)
    .text(`${data.orderNumber}\n`, { emphasis: true, doubleSize: true })
    .line(data.dateTime)
    .align('left')
    .divider();

  for (const item of data.items) {
    b.row(`${item.quantity} x ${item.name}`.slice(0, 30), money(item.lineTotal));
  }

  b.divider();
  b.row('Subtotal', money(data.subtotal));
  if (data.deliveryFee && data.deliveryFee > 0) {
    b.row('Delivery', money(data.deliveryFee));
  }
  b.text('', { emphasis: true });
  b.row('TOTAL', money(data.total));
  if (data.cashReceived != null) {
    b.row('Efectivo', money(data.cashReceived));
    b.row('Cambio', money(data.change ?? 0));
  }

  b.divider()
    .align('center')
    .line('¡Gracias, primo!')
    .line('los-pollosprimos.com')
    .feed(3)
    .cut();

  return b.build();
}
