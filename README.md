# Los Pollos Primos POS — Ahumado Tropical

POS multi-sucursal + tienda online + chatbot de WhatsApp para la pollería
"Los Pollos Primos" (Chalchuapa, Santa Ana, El Salvador).

- **Frontend:** React + Vite + TypeScript + Tailwind CSS 4 (PWA para terminales POS)
- **Backend:** Supabase (proyecto `xuhrenrsrmktfewfejkm`) — Postgres + RLS + Edge Functions + Realtime
- **Sucursales:** Sucursal Central (`C`, producción + delivery) y Mercado Chalchuapa (`M`, solo ventas)
- **Números de pedido:** `PP-C-XXXX` / `PP-M-XXXX`, secuenciales por sucursal, continuos, compartidos por POS / tienda / WhatsApp

## Correr en desarrollo

```bash
npm install
npm run dev          # http://localhost:5173
```

`.env` (ya configurado; ver `.env.example`):

```
VITE_SUPABASE_URL=https://xuhrenrsrmktfewfejkm.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_…
```

## Rutas

| Ruta | Quién | Qué |
|---|---|---|
| `/tienda`, `/tienda/checkout`, `/tienda/estado` | Público (los-pollosprimos.com) | Catálogo, checkout de invitado, estado del pedido |
| `/login` | Personal | Inicio de sesión |
| `/pos` | admin, cajero | Venta en mostrador (efectivo, captura opcional de cliente, impresión) |
| `/kitchen` | admin, cocina (solo Central) | Pantalla de cocina en tiempo real (todas las fuentes) |
| `/delivery` | admin, cajero, repartidor | Pedidos listos / en camino |
| `/cash` | admin, cajero | Apertura/cierre de caja, arqueo |
| `/batches` | admin, cocina (solo Central) | Lotes de compra y producción + trazabilidad |
| `/inventory` | admin, cajero | Existencias, ajustes, recepción de transferencias |
| `/transfers` | admin Central / superadmin | Envíos push Central → Mercado |
| `/reports` | admin / superadmin | Ventas, márgenes, costo/rendimiento de lotes |
| `/admin` | superadmin | Personal y catálogo |

## Modelo de inventario

Stock de pollo en **equivalentes de pollo entero** (entero 1.0 / medio 0.5 / cuarto 0.25).
Los combos se expanden vía `combo_components` y descuentan cada componente
(pollo, chimichurri, tortillas, cebolla). La asignación de lote de producción a
cada venta es FIFO automática (`order_item_batch_consumption` guarda el detalle
exacto, incluso cuando una venta cruza dos lotes). Cancelar un pedido repone
stock y lotes. Toda la lógica vive en triggers/funciones Postgres, así los tres
canales (POS, tienda, WhatsApp) se comportan idéntico.

## Edge Functions desplegadas

| Función | Auth | Uso |
|---|---|---|
| `menu` | pública | Catálogo para el bot de WhatsApp / n8n |
| `create-order` | pública (online) · `x-webhook-secret` (whatsapp) | Crea pedidos de tienda y WhatsApp con precios del servidor |
| `order-status` | pública | Estado por teléfono + número de pedido |
| `wompi-webhook` | pública, firma HMAC | Wompi notifica el pago; marca el pedido `paid` (valida `wompi_hash`) |
| `sync-ghl` | interna (trigger pg_net) | Upsert del contacto en GoHighLevel al completar pedido |
| `create-staff` | JWT (solo superadmin) | Alta de personal desde /admin |
| `bootstrap-superadmin` | pública, autodesactivada | Ya usada; rechaza si ya existe superadmin |

## Secretos pendientes de configurar (Dashboard → Edge Functions → Secrets)

- `WHATSAPP_WEBHOOK_SECRET` — mismo valor en n8n (ver `docs/whatsapp-n8n.md`)
- `WOMPI_MERCHANT_ID` + `WOMPI_API_SECRET` — App ID y API Secret de Wompi El
  Salvador (panel Wompi). Sin ellos los enlaces de pago degradan a efectivo
  automáticamente. Opcional: `STOREFRONT_URL` (default `https://los-pollosprimos.com`)
  para el redirect post-pago; `WOMPI_ID_URL` / `WOMPI_API_URL` para apuntar a
  sandbox.
- `GHL_API_KEY` + `GHL_LOCATION_ID` (+ `GHL_CF_TOTAL_SPENT`, `GHL_CF_LAST_ORDER`,
  `GHL_CF_ORDER_COUNT`, `GHL_CF_FAVORITE_ITEM` opcionales) — sin ellos el sync se
  salta silenciosamente sin afectar ventas

## Impresión de recibos

Star TSP143IIIW por WebPRNT: configurar la IP de la impresora desde el botón 🖨️
en el POS (se guarda por terminal). Si el POS se sirve por HTTPS el navegador
bloquea llamadas HTTP a la impresora (mixed content) — en producción servir el
POS por HTTP en la red local o usar el puerto HTTPS de la impresora.

## Offline (solo POS)

PWA + IndexedDB: el catálogo queda cacheado y las ventas en efectivo hechas sin
conexión se encolan y se re-envían solas al reconectar (el número PP se asigna
en el servidor al sincronizar). La tienda pública queda excluida del offline.

## Migraciones

`supabase/migrations/` refleja el esquema aplicado (0001 core, 0002 funciones y
triggers, 0003 RLS, 0004 seed). Regenerar tipos tras cambios de esquema:
MCP `generate_typescript_types` → `src/types/database.ts`.
