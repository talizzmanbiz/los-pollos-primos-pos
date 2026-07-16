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
