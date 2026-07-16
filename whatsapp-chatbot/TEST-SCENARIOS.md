# Test Scenarios — Los Pollos Primos WhatsApp Chatbot

Scenarios 1, 4 and 5 were **executed live** against the deployed workflow on 2026-07-12 (webhook → Brain → Supabase → state table) with simulated Meta payloads. Every bot reply below for those scenarios is the actual output captured from the executions.

---

## Scenario 1 — Normal order (delivery + efectivo) ✅ EXECUTED

| Who | Message |
|---|---|
| Cliente | hola |
| Bot | ¡Ey! 👋 Bienvenido a Los Pollos Primos — Ahumado Tropical 🍗 … (menú 1-5) ¿Cuál es? |
| Cliente | 1 |
| Bot | Dale, 1x El Primo Grande 💪 ¿Querés algo más? (podés escribir 'no' o elegir extras: chimichurri, tortillas, cebolla) |
| Cliente | cebolla y chimichurri |
| Bot | Va: Chimichurri extra, Media cebolla ✅ ¿Algo más? (o escribí 'no' para seguir) |
| Cliente | no |
| Bot | Anotado: (carrito) ¿Cómo querés — recoger o delivery? 🛵 (delivery solo desde Central: Zona 1 $1.00 / Zona 2 $1.50) |
| Cliente | delivery |
| Bot | ¿Cuál es tu dirección exacta? (Zona 1: $1.00 / Zona 2: $1.50 — delivery solo desde Central) |
| Cliente | Barrio El Centro, 2a calle poniente #12, frente a la farmacia, zona 1 |
| Bot | Resumen: • 1x El Primo Grande — $12.95 • 1x Chimichurri extra — $1.00 • 1x Media cebolla — $0.75 ──── TOTAL: $14.70 (delivery Zona 1: +$1.00 = $15.70) ¿Está bien? (sí/no) |
| Cliente | sí |
| Bot | ¿Cómo querés pagar? 1️⃣ Efectivo al recibir/recoger 2️⃣ Pagar ahora con link |
| Cliente | efectivo |
| Bot | ¡Perfecto! Tu orden es PP-C-XXXX — total $XX.XX. Llega en ~30 min ✅ + mensaje de gracias/handoff |

Verified: zone auto-parsed from address text; order payload matched the `create-order` contract exactly (source, location_id `central`, items, delivery{type,address,zone}, payment_method).

## Scenario 2 — Cancel mid-order

| Who | Message |
|---|---|
| Cliente | 2 *(El Primo en carrito)* |
| Cliente | cancelar |
| Bot | Sin problema, che — borrón y cuenta nueva 🐔 + menú de nuevo |

After an order was created: "cancelar" → *Dale, cancelamos tu orden PP-C-XXXX. Sin problema, che. 👍* + staff alert `⚠️ CANCELACIÓN` for manual POS cancellation.

## Scenario 3 — Question (FAQ)

| Who | Message |
|---|---|
| Cliente | ¿Qué lleva el chimichurri? |
| Bot | Chimichurri Los Pollos Primos: ajo fresco, perejil, chile dulce, cebolla morada, aceite de oliva y vinagre de manzana. ¡Sabor único! 🌴 (+ "¿Seguimos con tu pedido? 😄" si hay pedido en curso) |

Out-of-scope question ("¿tienen estacionamiento?" at any step): *Ey, buena pregunta 🤔 Esa no me la sé. ¿Querés hablar con alguien del equipo? (escribí 'operador')* + re-prompt of current step. No auto-handoff.

## Scenario 4 — API error during order creation ✅ EXECUTED

With the placeholder webhook secret, Supabase returned **401 No autorizado**:

| Who | Message |
|---|---|
| Bot | Uy, hubo un problema creando tu orden 😅 Intentá de nuevo en un momento (respondé 1 para efectivo o 2 para link), o escribí 'operador' para hablar con el equipo. |
| Staff | ❌ ERROR creando orden de Carlos Test (50370001111): 401 … |

Verified: state rolled back to `PAYMENT` (customer can just answer "1" again), workflow finished green, staff alert generated.

## Scenario 5 — Human handoff ✅ EXECUTED

| Who | Message |
|---|---|
| Cliente | quiero hablar con un humano |
| Bot | Un momento che, te paso con el equipo 👍 |
| Staff | 🚨 HANDOFF — Carlos Test (50370001111) / Paso: PAYMENT / Carrito: 1x El Primo Grande… / Orden: ninguna / Último mensaje: "quiero hablar con un humano" |

Verified: state moved to `HANDOFF`; subsequent customer messages are forwarded to staff and the bot stays quiet until the customer texts `menú`.

Also covered by the Brain (unit-level behaviors):
- Gibberish at any step → tone-matched retry ("Che, no entendí eso 😅 …"); after 2 retries the 'operador' hint is appended. Never auto-handoff.
- "no entiendo" only triggers handoff after 2+ failed retries (per spec).
- Duplicate Meta webhook delivery (same `wamid`) → silently dropped.
- Delivery from Mercado is impossible by construction: delivery always books against Central; pickup offers both locations.

## Re-running the live tests

POST simulated Meta payloads to the webhook (each message needs a unique `messages[0].id`):

```bash
curl -X POST https://n8n.automateaiservices.com/webhook/pollos-primos-whatsapp \
  -H "Content-Type: application/json" \
  -d '{"object":"whatsapp_business_account","entry":[{"id":"0","changes":[{"field":"messages","value":{"messaging_product":"whatsapp","contacts":[{"profile":{"name":"Test"},"wa_id":"50370001111"}],"messages":[{"from":"50370001111","id":"wamid.UNIQUE_ID_HERE","timestamp":"0","type":"text","text":{"body":"hola"}}]}}]}]}'
```

Watch results in n8n → Executions, and reset the test customer by deleting their row in the `pollos_primos_conversations` data table. For a light load test, run the same payload with 5–10 different `wa_id`/`from` numbers in parallel.
