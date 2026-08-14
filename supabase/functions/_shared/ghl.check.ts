// Verificación del esquema de contacto de GoHighLevel. Lo que se comprueba es
// exactamente lo que produce contactos duplicados en el CRM: que las tres
// fuentes normalicen el teléfono al mismo string y usen el mismo naming de tags.
//
//   node --experimental-strip-types supabase/functions/_shared/ghl.check.ts
import assert from 'node:assert/strict';
import { armarContacto, canalDesdeOrden, origenPermitido, partirNombre, toE164 } from './ghl.ts';

// --- Teléfono: el mismo cliente capturado por las tres fuentes -------------
// El POS lo teclea con guión, el sitio con espacios, WhatsApp lo manda con país.
const MISMO = '+50370001111';
for (const entrada of [
  '7000-1111',        // POS: cajero teclea local
  '7000 1111',        // sitio: usuario con espacio
  '70001111',         // sitio: sin formato
  '50370001111',      // WhatsApp: como llega de Meta
  '+503 7000-1111',   // alguien pega el número completo
  '0050370001111',    // prefijo internacional marcado a mano
]) {
  assert.equal(toE164(entrada), MISMO, `toE164(${entrada}) debe dar ${MISMO}`);
}
assert.equal(toE164(''), '', 'sin teléfono no inventamos número');
assert.equal(toE164(null), '', 'null no revienta');

// --- Traducción order_source → canal --------------------------------------
assert.equal(canalDesdeOrden('online'), 'website', "'online' del enum es el sitio web");
assert.equal(canalDesdeOrden('whatsapp'), 'whatsapp');
assert.equal(canalDesdeOrden('pos'), 'pos');
assert.equal(canalDesdeOrden(null), 'website', 'valor desconocido no debe romper el sync');

// --- Nombre: firstName es requerido ---------------------------------------
assert.deepEqual(partirNombre('María'), { firstName: 'María' });
assert.deepEqual(partirNombre('María  López Cruz'), { firstName: 'María', lastName: 'López Cruz' });
assert.equal(partirNombre('').firstName, 'Cliente', 'venta de mostrador sin nombre igual necesita firstName');
assert.equal(partirNombre(null).firstName, 'Cliente');

// --- Tags: naming idéntico entre fuentes ----------------------------------
const base = { locationId: 'loc1', phone: '7000-1111' };

const wa = armarContacto({ ...base, canal: 'whatsapp', estado: 'intento-pedido', name: 'María López' });
assert.deepEqual(wa.tags, ['los-pollos-primos', 'whatsapp-customer', 'intento-pedido']);
assert.equal(wa.firstName, 'María');
assert.equal(wa.lastName, 'López');
assert.equal(wa.phone, MISMO);

const web = armarContacto({ ...base, canal: 'website', estado: 'pedido-completado', name: 'María López' });
assert.deepEqual(web.tags, ['los-pollos-primos', 'website-customer', 'pedido-completado']);

const pos = armarContacto({ ...base, canal: 'pos', estado: 'pedido-completado', name: 'María López' });
assert.deepEqual(pos.tags, ['los-pollos-primos', 'pos-customer', 'pedido-completado']);

// El punto de todo esto: las tres fuentes deduplican al mismo contacto.
assert.equal(wa.phone, web.phone);
assert.equal(web.phone, pos.phone);
assert.equal(wa.firstName, pos.firstName);

// --- Campos opcionales ----------------------------------------------------
const sinExtras = armarContacto({ ...base, canal: 'pos', estado: 'pedido-completado' });
assert.equal('email' in sinExtras, false, 'no mandamos email vacío');
assert.equal('address1' in sinExtras, false);
assert.equal('customFields' in sinExtras, false);

const conExtras = armarContacto({
  ...base,
  canal: 'whatsapp',
  estado: 'intento-pedido',
  name: 'Ana',
  email: '  ana@correo.com  ',
  address: 'Calle Real #5',
  customFields: [{ id: 'cf1', value: '25.00' }],
});
assert.equal(conExtras.email, 'ana@correo.com', 'el email se recorta');
assert.equal(conExtras.address1, 'Calle Real #5');
assert.equal(conExtras.city, 'Chalchuapa');
assert.deepEqual(conExtras.customFields, [{ id: 'cf1', value: '25.00' }]);

// --- Origin del alta de leads sin secreto ---------------------------------
for (const ok of [
  'https://los-pollosprimos.com',
  'https://www.los-pollosprimos.com',
  'https://pos.los-pollosprimos.com',
  'https://lpp-preview-abc.vercel.app',
  'http://localhost:5173',
]) {
  assert.equal(origenPermitido(ok), true, `${ok} debería pasar`);
}
for (const no of [
  null,
  undefined,
  '',
  'https://los-pollosprimos.com.attacker.io', // el caso que un includes() dejaría pasar
  'https://evil.io',
  'https://notlos-pollosprimos.com',
  'no-es-una-url',
]) {
  assert.equal(origenPermitido(no), false, `${no} NO debería pasar`);
}

console.log('ghl.check: OK');
