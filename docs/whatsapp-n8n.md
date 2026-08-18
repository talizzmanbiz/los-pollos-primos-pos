# WhatsApp Chatbot — integración n8n ↔ Supabase

Instancia n8n: `n8n.automateaiservices.com` (self-hosted, Google Cloud), conectada a
WhatsApp Business API (integración directa con Meta). Este documento define el
contrato con Supabase; el workflow n8n se construye en el VPS usando estos endpoints.

## Endpoints Supabase (ya desplegados)

Base: `https://xuhrenrsrmktfewfejkm.supabase.co/functions/v1`

### 1. `GET /menu`
Menú vivo para armar los botones/listas del bot.

```json
{
  "combos":  [{ "sku": "COMBO-ENT", "name": "El Primo Grande", "price": 12.95 }, …],
  "pollo":   [{ "sku": "POLLO-ENT", "name": "Pollo entero", "price": 11 }, …],
  "extras":  [{ "sku": "CHIMI-30", "name": "Chimichurri (30ml)", "price": 0.75 }, …],
  "bebidas": [],
  "delivery_zones": [{ "id": "…", "name": "Zona 1", "fee": 1.0 }, …],
  "locations": [{ "code": "C", "name": "Sucursal Central", "allows_delivery": true }, …]
}
```

### 2. `POST /create-order`  (paso 6 del flujo)
Header obligatorio: `x-webhook-secret: <WHATSAPP_WEBHOOK_SECRET>`

```json
{
  "source": "whatsapp",
  "location_code": "C",
  "order_type": "pickup" | "delivery",
  "customer_name": "María López",
  "customer_phone": "50377778888",
  "delivery_address": "solo si delivery",
  "delivery_zone_id": "solo si delivery (id de /menu)",
  "payment_method": "cash" | "payment_link",
  "items": [{ "sku": "COMBO-MED", "quantity": 2 }],
  "notes": "opcional"
}
```

Respuesta: `{ order_number, subtotal, delivery_fee, total, estimated_minutes, payment_url }`.
- Los precios SIEMPRE se calculan en el servidor — el bot solo manda SKUs.
- Si el gateway de pago no está configurado, `payment_url` viene `null` y el
  pedido queda como efectivo (el bot debe avisar: "pagás al recibir/recoger").
- El pedido aparece de inmediato en la pantalla de Cocina/caja (source = whatsapp).

### 3. `POST /order-status`
`{ "phone": "77778888", "order_number": "PP-C-0042" }` → estado + timeline.
El teléfono se compara solo por dígitos (con o sin +503).

### 4. `POST /payment-link`  (cliente que cambia a tarjeta después de confirmar)
Header obligatorio: `x-webhook-secret: <WHATSAPP_WEBHOOK_SECRET>`

`{ "order_number": "PP-C-0042" }` → `{ order_number, total, payment_url, ya_existia }`

- Es la **única** forma válida de obtener un enlace de pago para una orden que ya
  existe. La herramienta del agente es `generar_link_pago`.
- Idempotente: si la orden ya tiene `payment_url`, devuelve el mismo. Crear un
  segundo enlace permitiría que el cliente pague dos veces.
- El enlace se crea por la API con `urlWebhook` apuntando a `wompi-webhook`, así
  que al pagarse la orden se marca `paid` sola. **Un enlace creado a mano en el
  panel de Wompi no avisa al POS** y la venta queda como pendiente.
- Rechaza órdenes canceladas, ya pagadas o de monto cero.
- Si Wompi falla devuelve **502**: el bot tiene que decirlo y ofrecer efectivo.

> **Por qué existe.** El 9-ago un cliente confirmó en efectivo y 30 segundos
> después pidió tarjeta. El agente no tenía herramienta para eso y se inventó
> una URL con pinta de enlace de Wompi (`s.wompi.sv/PP-C-0042`). Regla en el
> prompt: nunca escribir una URL que no venga textualmente de una herramienta.

### 5. `POST /wompi-reconcile`  (cron, no lo llama el bot)
Header obligatorio: `x-webhook-secret: <WHATSAPP_WEBHOOK_SECRET>`

`{ "horas": 48, "aplicar": true }` → `{ conciliadas, revisar, ya_registradas, … }`

Cruza los cobros aprobados de Wompi (`GET /TransaccionCompra`) contra las órdenes
pendientes. Empareja en dos pasos:

1. Por **`idExterno`**, que es el `identificadorEnlaceComercio` que ponemos al
   crear el enlace por API.
2. Si el cobro no lo trae —**panel de Wompi, Wompi POS físico, QR hecho a
   mano**— por **monto exacto + ventana de tiempo** (24 h antes, 15 min después
   de crearse la orden).

Si dos órdenes calzan igual de bien, **no toca ninguna** y las devuelve en
`revisar`. Marcar como pagada la orden equivocada es peor que dejarla pendiente.

- Idempotente: una transacción ya usada como `payment_reference` nunca se
  reaplica.
- `{"aplicar": false}` simula sin escribir — conviene para la primera corrida.
- Lo corre `docs/n8n/conciliacion-wompi.workflow.json` cada 15 minutos.

> **Por qué existe.** El pago de David (PP-C-0042) se cobró con un enlace creado
> a mano: `idExterno` vacío ⇒ `wompi-webhook` lo descartó con "sin identificador
> de enlace" y la venta quedó pendiente dos días. Cualquier cobro que no salga de
> la API tiene ese mismo punto ciego.

## Secreto del webhook

Configurar en Supabase (Dashboard → Edge Functions → Secrets, o CLI):

```
supabase secrets set WHATSAPP_WEBHOOK_SECRET=<valor-largo-aleatorio>
```

y el mismo valor como credencial/env en n8n. Sin ese header, `create-order`
rechaza cualquier pedido con `source: "whatsapp"`.

## Flujo conversacional confirmado (construir el workflow tal cual)

Tono: español salvadoreño informal, cálido, con voseo. «¡Va pues!», «¿Cuál
querés?» — nunca "usted" corporativo.

1. **Saludo + menú rápido** — al primer mensaje: saludo + lista rápida
   (combos, pollo entero / medio / cuarto + extras) desde `GET /menu`.
   > «¡Hola! 🍗 Bienvenido a Los Pollos Primos. ¿Qué se te antoja hoy?»
2. **Selección → cantidad** — cliente elige producto, bot confirma cantidad.
   > «¡Buenísimo! ¿Cuántos Primos querés?»
3. **¿Recoger o delivery?** — si delivery: pedir dirección y zona (Zona 1 $1.00 /
   Zona 2 $1.50, solo Central).
4. **Resumen + total** — lista de items con precios del `/menu` + total.
5. **Pago** — mandar enlace de pago (si `payment_url` disponible) o aceptar
   «pagar en efectivo al recibir/recoger» como respuesta alternativa.
6. **Confirmación** — `POST /create-order` → responder con número de pedido +
   tiempo estimado:
   > «¡Listo! Tu pedido es el **PP-C-0042** 🎉 Estará en unos 25 minutos. ¡Gracias, primo!»
7. **Handoff humano** — SOLO cuando el cliente lo pida explícitamente
   (frases tipo «quiero hablar con alguien», «operador», «humano», «una persona»).
   NUNCA auto-derivar por confusión o intent fallido: reintentar el flujo u
   ofrecer el menú de nuevo.

## Estados que el bot puede reportar (paso opcional de seguimiento)

`received → in_progress → ready / out_for_delivery → completed`
(etiquetas en español incluidas en la respuesta de `/order-status`).
