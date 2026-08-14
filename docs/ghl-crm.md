# GoHighLevel — esquema único de contacto

GHL es el CRM central. Le escriben **tres fuentes** contra el mismo location
(`acZuh16vJpQ1Oolj4jjC`). Si cada una manda el teléfono en distinto formato o
inventa sus propios tags, GHL no reconoce que es el mismo cliente y crea
contactos duplicados. Por eso el armado del contacto vive en un solo archivo:
[`supabase/functions/_shared/ghl.ts`](../supabase/functions/_shared/ghl.ts).

## El esquema

| Campo | Regla |
|---|---|
| `firstName` | Requerido. Se parte del nombre completo por el primer espacio; sin nombre → `"Cliente"`. |
| `lastName` | El resto del nombre, si lo hay. |
| `phone` | **E.164 `+503XXXXXXXX`**. Es la llave de deduplicación. |
| `email` | Opcional. No se manda si viene vacío. |
| `source` | `WhatsApp Bot` \| `Sitio Web` \| `POS` (texto legible que se ve en GHL). |
| `tags` | `[los-pollos-primos, <canal>, <estado>]` |

**Tags de canal:** `whatsapp-customer`, `website-customer`, `pos-customer`
**Tags de estado:** `pedido-completado` (pagó o se le entregó), `intento-pedido` (dio sus datos pero no cerró)

El enum `order_source` de Postgres usa `online` para el sitio web; el esquema de
contacto usa `website`. `canalDesdeOrden()` es el único traductor.

## Cómo llega cada fuente

| Fuente | Camino | Estado |
|---|---|---|
| **WhatsApp** | Agente → tool `guardar_contacto` → `ghl-contact` (upsert) apenas da sus datos | `intento-pedido` |
| **WhatsApp** | Agente → tool `crear_orden` → `create-order` → trigger `orders_ghl_sync` → `sync-ghl` | `pedido-completado` |
| **Sitio web** | Formulario de contacto → `ghl-contact` (upsert, `source: website`) | `intento-pedido` |
| **Sitio web** | Checkout tienda → `create-order` → trigger → `sync-ghl` | `pedido-completado` |
| **POS** | Campos de cliente (opcionales) → insert en `orders` → trigger → `sync-ghl` | `pedido-completado` |

El trigger [`orders_ghl_sync`](../supabase/migrations/0011_ghl_sync_on_payment.sql)
dispara con `pg_net` en insert/update de `status` o `payment_status`. Nunca
sincroniza pedidos cancelados ni sin teléfono.

## Decisiones tomadas

- **El campo de contacto del POS es opcional.** Obligarlo frena la fila en hora
  pico y en la práctica el cajero teclea `0000-0000` para salir del paso — datos
  basura en el CRM. Si el cajero lo llena, el cliente entra; si no, la venta pasa igual.
- **El formulario del sitio no exige secreto** para dar de alta un lead: corre en
  el navegador y no puede guardar uno, igual que los pedidos `online` de
  `create-order`. A cambio tiene tres límites: solo puede hacer `upsert` (nunca
  `lookup`), el `Origin` tiene que ser un dominio nuestro, y el teléfono debe
  tener entre 8 y 13 dígitos. El chequeo de `Origin` frena al scraper que
  encuentra la URL, pero se falsifica fuera del navegador — si algún día entra
  spam de verdad, ahí toca rate-limit por IP con tabla, que hoy no se justifica.
- **Las credenciales de GHL viven solo en Supabase** (Edge Functions → Secrets),
  no en la Data Table de n8n. El workflow no llama a GHL directo: pasa por las
  Edge Functions. Una segunda copia del token sería otro lugar de donde se puede
  filtrar, sin ganar nada.

## Ojo con esto

**GHL _agrega_ tags en el upsert, no los reemplaza.** Un cliente que primero dejó
sus datos y después pagó queda con `intento-pedido` **y** `pedido-completado`.
Para segmentar "no compró" hay que filtrar por **ausencia de `pedido-completado`**,
no por presencia de `intento-pedido`.

## Secrets

En Supabase Dashboard → Edge Functions → Secrets:

| Secret | Para qué |
|---|---|
| `GHL_API_KEY` | Private Integration Token (Bearer) |
| `GHL_LOCATION_ID` | Sub-cuenta de GHL |
| `WHATSAPP_WEBHOOK_SECRET` | Protege `lookup` y las llamadas del bot |
| `GHL_CF_TOTAL_SPENT`, `GHL_CF_LAST_ORDER`, `GHL_CF_ORDER_COUNT`, `GHL_CF_FAVORITE_ITEM` | IDs de campos personalizados. Opcionales: si no están, se omiten. **Verificado: los cuatro están configurados y sincronizando.** |

Los campos en GHL se llaman "… (POS)" (`Total Gastado (POS)`, `Producto
Favorito (POS)`, etc.) por razones históricas, pero ahora se llenan con pedidos
de las tres fuentes. El nombre es cosmético; renombrarlos en GHL no rompe nada
porque el código los referencia por ID.

## Verificar que no se rompió la deduplicación

```bash
node --experimental-strip-types supabase/functions/_shared/ghl.check.ts
```

Comprueba que los seis formatos con que las tres fuentes capturan un teléfono
(`7000-1111`, `70001111`, `50370001111`, `+503 7000-1111`, `0050370001111`…)
normalizan al mismo string, y que el naming de tags no se desvió.
