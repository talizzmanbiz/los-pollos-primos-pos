// Dependency-free "print / save as PDF" for the legal books. Opens a clean
// print window (triggered by a user click, so no popup-blocker issues) with a
// signature block, and calls print() — the browser's "Save as PDF" produces
// the file. Avoids pulling in jsPDF.

type Cell = string | number;

function esc(v: Cell): string {
  return String(v).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

export function printReport(o: {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: Cell[][];
  footer?: Cell[];
  numericFrom?: number; // column index from which cells are right-aligned
  note?: string;
}): void {
  const nf = o.numericFrom ?? o.headers.length;
  const cls = (i: number) => (i >= nf ? ' class="num"' : '');
  const th = o.headers.map((h, i) => `<th${cls(i)}>${esc(h)}</th>`).join('');
  const trs = o.rows
    .map((r) => '<tr>' + r.map((c, i) => `<td${cls(i)}>${esc(c)}</td>`).join('') + '</tr>')
    .join('');
  const tf = o.footer
    ? '<tfoot><tr>' + o.footer.map((c, i) => `<td${cls(i)}>${esc(c)}</td>`).join('') + '</tr></tfoot>'
    : '';

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>${esc(o.title)}</title>
<style>
  * { font-family: 'Times New Roman', Georgia, serif; box-sizing: border-box; }
  body { margin: 32px; color: #1a1a1a; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .sub { font-size: 12px; color: #555; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; }
  th { background: #eee; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  tfoot td { font-weight: bold; background: #f3f3f3; }
  .sign { margin-top: 56px; display: flex; justify-content: space-between; }
  .sign div { border-top: 1px solid #333; padding-top: 6px; width: 42%; text-align: center; font-size: 12px; }
  @media print { body { margin: 12mm; } }
</style></head><body>
  <h1>Los Pollos Primos</h1>
  <div class="sub">${esc(o.title)}${o.subtitle ? ' — ' + esc(o.subtitle) : ''}</div>
  <table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody>${tf}</table>
  ${o.note ? `<div class="sub" style="margin-top:12px">${esc(o.note)}</div>` : ''}
  <div class="sign"><div>Firma del contribuyente</div><div>Firma del contador</div></div>
  <script>window.onload=function(){window.print();}</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=980,height=760');
  if (!w) {
    alert('Habilitá las ventanas emergentes para poder imprimir / guardar el PDF.');
    return;
  }
  w.document.write(html);
  w.document.close();
}
