// Verificación de fmtDate contra el desfase de zona horaria.
//
// Las columnas `date` de Postgres (purchase_date, transaction_date,
// journal_date) llegan como "2026-08-30". Pasarlas por new Date() + timeZone
// las corre un día hacia atrás en El Salvador (UTC-6). Si alguien vuelve a
// meter esa conversión, esto falla.
//
//   node --experimental-strip-types src/lib/format.check.ts
import assert from 'node:assert/strict';
import { fmtDate, fmtDateTime } from './format.ts';

// ---- Fechas sin hora: se muestran tal cual, sin corrimiento ----
assert.equal(fmtDate('2026-08-30'), '30/08/2026');
assert.equal(fmtDate('2026-01-01'), '01/01/2026', 'el 1 de enero no puede caer en el año anterior');
assert.equal(fmtDate('2026-12-31'), '31/12/2026');
assert.equal(fmtDate('2026-02-29'), '29/02/2026', 'año bisiesto');

// ---- Timestamps: ahí SÍ se convierte a la hora de El Salvador ----
// 2026-08-30T02:00:00Z son las 20:00 del 29 en Chalchuapa (UTC-6): el día
// anterior es la respuesta correcta acá, y no debe "arreglarse".
assert.equal(fmtDate('2026-08-30T02:00:00Z'), '29/08/2026');
assert.equal(fmtDate('2026-08-30T18:00:00Z'), '30/08/2026');

// El mismo instante, con hora, en formato largo.
assert.match(fmtDateTime('2026-08-30T02:00:00Z'), /^29\/08\/2026/);

console.log('format.check.ts OK');
