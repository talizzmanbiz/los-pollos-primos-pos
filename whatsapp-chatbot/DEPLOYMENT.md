# Los Pollos Primos — WhatsApp Chatbot: Deployment Guide

Hay **dos workflows** en n8n:

| Workflow | ID | Ruta del webhook | Estado |
|---|---|---|---|
| **v2 — Agente IA** | `ESGEpo8Xky8m4uXu` | `pollos-primos-whatsapp` | 🟢 **ACTIVO — atiende a los clientes** desde el 2026-08-06. Claude Haiku 4.5 + 4 herramientas. |
| v1 — máquina de estados | `MmlbbbBghiKWttqP` | *(liberada)* | ⚪ Desactivado, se queda como **rollback**. Flujo de 7 pasos, determinista. |

**Rollback (1 minuto):** en v2 devolvé la ruta de los dos nodos webhook a `pollos-primos-whatsapp-v2`, y reactivá v1. En Meta no se toca nada.

## Migración de dominio (2026-08-30) — resuelta

La instancia pasó de `n8n.automateaiservices.com` (apagado) a
`n8n.vanguardaiautomations.com`. Las Data Tables y las credenciales migraron
bien; lo que se rompió fueron otras dos cosas, y vale anotarlas porque el
síntoma inicial engañaba.

**1. El task runner de n8n no estaba corriendo.**
Todas las ejecuciones morían con `Task request timed out after 60 seconds` en
el primer nodo Code. En las versiones nuevas de n8n los nodos Code corren en un
proceso aparte; sin él, `Extract Message`, `Merge Config`, `Prep Sends`,
`Verify Token v2` y las cuatro herramientas del agente se cuelgan 60s y fallan.
Es media aplicación. Se arregla en el servidor, no en el workflow.

Engañaba porque el `POST` seguía devolviendo `200 Workflow was started`: ese
webhook responde ANTES de ejecutar, así que un 200 ahí no prueba nada. La
prueba real es si el mensaje llega a `whatsapp_messages`.

**2. El webhook GET quedó sin registrar (404).**
`Webhook Verify (GET) v2` comparte ruta con el webhook POST y no declaraba
`httpMethod`. Al reimportar, n8n registró solo el POST y el GET respondía
`Cannot GET`. Se corrige declarando **`httpMethod: GET` explícito** en el nodo.

> Si algún día el handshake de Meta vuelve a dar 404 pero el POST funciona, es
> esto: dos nodos webhook en la misma ruta necesitan el método declarado a mano.

Verificado tras el arreglo: el handshake devuelve el `hub.challenge` en 0.4s,
un token incorrecto devuelve `forbidden`, y un mensaje de prueba recorre el
flujo completo hasta la respuesta del bot.

Nota: `pollos_primos_conversations` es de v1 (desactivado). v2 no la usa —
guarda el historial en Supabase.

## URLs

| Purpose | URL |
|---|---|
| Incoming messages (Meta → n8n) | `https://n8n.vanguardaiautomations.com/webhook/pollos-primos-whatsapp` (POST) — hoy la sirve **v2** |
| Meta verification handshake | same URL (GET) — verificado en v2: token correcto devuelve el `hub.challenge`, token malo devuelve `forbidden` |

Register **that single URL** as the Callback URL in Meta App Dashboard → WhatsApp → Configuration → Webhooks, subscribe to the `messages` field, and use the verify token below.

## Architecture

```
Meta POST ──> WhatsApp Webhook ──> Extract Message ──> Get Config ──> Merge Config
                                                                        │
                                   ┌────────────────────────────────────┘
                                   ▼
                               Get State (data table, keyed by phone)
                                   ▼
                               Brain (Code node — full 7-step state machine)
                                   ▼
                               Route Action (switch)
                     ┌─────────────┼──────────────────┐
              create_order    status_check          (send)
                     │             │                  │
       Create Order (Supabase)  Get Order Status      │
                     │             │                  │
               Order Result   Status Result           │
                     └─────────────┴──────────┬───────┘
                                          Finalize
                                       ┌──────┴──────┐
                                  Save State     Prep Sends ──> Send WhatsApp (Graph API)
```

A separate GET branch (`Webhook Verify (GET)` → `Get Verify Config` → `Verify Token` → `Respond Challenge`) handles Meta's subscription handshake.

### Conversation state
Stored in n8n **Data Table** `pollos_primos_conversations` (ID `UmqYrQQPqSKxZ2bJ`), one row per phone number, state as JSON in `state_json`. Steps: `NEW → MENU → (SOLO_SIZE) → EXTRAS → FULFILLMENT → (ADDRESS → ZONE | PICKUP_LOC) → CONFIRM → PAYMENT → CREATING → DONE`, plus `HANDOFF`. Duplicate webhook deliveries are deduped by WhatsApp message ID.

To reset a stuck customer: delete their row in Data Tables → `pollos_primos_conversations` (or the customer can text `cancelar` or `menú`).

## Configuration / secrets

**Important discovery:** this n8n instance **blocks `$env` access inside nodes** ("access to env vars denied"). So configuration lives in Data Table **`pollos_primos_config`** (ID `Mq8RA5GKDrkPMtCY`), editable in the n8n UI under *Data Tables*. If you later allow env access (`N8N_BLOCK_ENV_ACCESS_IN_NODE=false` in the n8n docker/systemd config), environment variables with the same names automatically **override** the table values — no workflow change needed.

| Key | Current value | Notes |
|---|---|---|
| `SUPABASE_URL` | `https://xuhrenrsrmktfewfejkm.supabase.co` | set ✅ |
| `SUPABASE_ANON_KEY` | real anon key | set ✅ (pulled from the Supabase project) |
| `WHATSAPP_WEBHOOK_SECRET` | `ppwa_7f3d9c2e8b514a6f90d1c4e7a2b8f635` | set ✅ in n8n AND Supabase (verified 2026-07-16 — auth passes, full E2E order PP-C-0014 created & cleaned up) |
| `WHATSAPP_PHONE_ID` | `1264258403429380` | set ✅ (2026-07-16) |
| `WHATSAPP_ACCESS_TOKEN` | set ✅ | WORKING as of 2026-07-17 — Meta block resolved; real message delivery confirmed (menu sent to staff phone). Business number: +503 7047 6975, verified, quality GREEN. |
| `WHATSAPP_VERIFY_TOKEN` | `pollos-primos-verify-2026` | enter this exact string as "Verify token" in Meta webhook config |
| `STAFF_WHATSAPP_NUMBER` | `50372830282` | set ✅ — receives handoff, new-order, cancellation and API-error alerts |
| `PAYMENT_GATEWAY_PLACEHOLDER` | *(unused)* | superseded — `create-order` returns a real Wompi `payment_url` which the bot sends directly; if Wompi creds aren't configured the function downgrades the order to cash and the bot tells the customer |
| `WHATSAPP_API_VERSION` | `v18.0` | Graph API version |

Note: the project brief listed `graph.instagram.com` as the API host — that's a typo; the WhatsApp Cloud API host is `graph.facebook.com`, which is what the workflow uses.

### Actual API contract (bot updated 2026-07-16 to match the deployed edge functions)
The original brief's contract was outdated. The bot now sends:

- **create-order**: `{ source: 'whatsapp', location_code: 'C'|'M', order_type: 'pickup'|'delivery', customer_name, customer_email?, customer_phone, delivery_address?, delivery_zone_id? (UUID), payment_method: 'cash'|'payment_link', items: [{ sku, quantity }] }` → response `{ order_number, subtotal, delivery_fee, total, estimated_minutes, payment_url, items }`.
- **ghl-contact** (nueva, 2026-08-01): POST con `x-webhook-secret`. `{action:'lookup', phone}` → `{found, first_name, contact_id}` para saludar por nombre; `{action:'upsert', phone, name, email, address}` → guarda el contacto en GoHighLevel. Usa los secretos `GHL_API_KEY` / `GHL_LOCATION_ID` que ya existían.

### Zonas de delivery (actualizadas 2026-08-01, migración `0020_delivery_zones_chalchuapa.sql`)
| Zona | UUID | Costo |
|---|---|---|
| Chalchuapa Centro | `cccccccc-0000-0000-0000-000000000001` | **$1.50** |
| Chalchuapa Alrededores (hasta Ciudad Real y El Refugio) | `cccccccc-0000-0000-0000-000000000002` | **$2.00** |

Delivery sale únicamente de Sucursal Central — el bot ya no pregunta de qué sucursal sale el envío. Mercado Chalchuapa es solo retiro.
- **order-status**: **POST** (not GET) with JSON body `{ phone, order_number }` → returns `status`, Spanish `status_label` (Recibido/En preparación/Listo/En camino/Entregado/Cancelado), `estimated_minutes`, items, timeline.

### Prices (real SKUs from the products table, mirrored in the Brain)
COMBO-ENT $12.95 · COMBO-MED $6.95 · COMBO-CTO $3.95 · POLLO-ENT $11.00 · POLLO-MED $6.00 · POLLO-CTO $3.50 · CHIMI-30 $0.75 · TORT-2 $0.50 · TORT-4 $0.75 · TORT-8 $1.00 · CEB-ENT $0.75 · CEB-MED $0.40. Display-only — the create-order response total is what's quoted to the customer. If POS prices change, update the Brain's `PRICES` map to match.

> ⚠️ `los-pollos-primos-whatsapp-chatbot.workflow.json` in this folder predates the 2026-07-16 SKU/contract update — the live n8n workflow (`MmlbbbBghiKWttqP`) is the source of truth.

---

# v2 — Agente IA (`ESGEpo8Xky8m4uXu`)

Respaldo en `los-pollos-primos-whatsapp-chatbot-v2-agente.workflow.json`.

## Arquitectura

```
Meta POST ──> WhatsApp Webhook v2 ──> Extract Message ──> Get Config ──> Merge Config
                                                                            │
                                                                            ▼
                                                              Buscar Contacto GHL  (lookup deterministico
                                                                            │       para saludar por nombre)
                                                                            ▼
                                                              Agente Pollos Primos ──> Prep Sends ──> Send WhatsApp
                                                                            │
                                       ┌──────────────┬─────────┴────────┬──────────────────┐
                              Claude Haiku 4.5   Memoria por      crear_orden        estado_orden
                              (ai_languageModel)  Cliente         guardar_contacto   avisar_al_equipo
                                                  (ai_memory)     ────── ai_tool ──────
```

Rama GET aparte (`Webhook Verify (GET) v2` → `Get Verify Config v2` → `Verify Token v2` → `Respond Challenge v2`) para el handshake de Meta. Verificada: token correcto devuelve el `hub.challenge`, token incorrecto devuelve `forbidden`.

Sin tabla de estado: el hilo de conversación vive en **Memoria por Cliente** (`memoryBufferWindow`, sessionKey = teléfono, ventana 12). Se pierde si n8n reinicia; los pedidos duran minutos, es aceptable.

## Las 4 herramientas

| Herramienta | Llama a | Devuelve |
|---|---|---|
| `crear_orden` | `create-order` | número de orden, total real, minutos, `payment_url` |
| `estado_orden` | `order-status` | estado en español + minutos + items |
| `guardar_contacto` | `ghl-contact` (`upsert`) | contacto en GoHighLevel |
| `avisar_al_equipo` | Graph API → `STAFF_WHATSAPP_NUMBER` | aviso de handoff al equipo |

### ⚠️ Trampa de n8n: el HTTP Request Tool no sirve en este instance

Los nodos `@n8n/n8n-nodes-langchain.toolHttpRequest` fallan siempre con:

```
The node "@n8n/n8n-nodes-langchain.toolHttpRequest" has a "supplyData" method but no "execute" method.
```

Descartado: el modelo, los esquemas, las conexiones, la versión del nodo, la caché del workflow. Un `toolCode` trivial en cambio **sí ejecuta**, o sea que el fallo es específico del nodo HTTP en esta versión de n8n.

**La solución:** las 4 herramientas son **Code Tools** (`toolCode` v1.3) que hacen el HTTP en JS.

Y dentro de ese sandbox:

- ❌ **`fetch` NO existe** (`typeof fetch === 'undefined'`). Un `fetch()` falla en ~30 ms y el agente lo reporta como «se me traba el sistema».
- ✅ `this.helpers.httpRequest({ method, url, headers, body, json: true })` — **esto es lo que hay que usar**.
- ✅ `require` existe.
- ✅ `$('Merge Config').first().json.cfg` funciona — así llegan los secretos a las herramientas sin hardcodearlos.

Si alguna herramienta se cae, primero revisá que no se haya colado un `fetch`.

## Preguntas frecuentes que el bot contesta solo

Van **dentro del system prompt**, no en una herramienta: son datos fijos y cortos, y una llamada a herramienta costaría dos vueltas de modelo (más caro que los ~60 tokens que ocupan).

| Dato | Valor | Fuente |
|---|---|---|
| Horario | Martes a domingo, 10:00 a.m. – 2:00 p.m. Lunes cerrado | `src/pages/site/siteInfo.ts` |
| Dirección | 7a Av. Norte y 6a Calle Oriente #28, Barrio Las Ánimas — Plaza Las Palmeras, Local 5 | idem |
| Preparación | 30–45 minutos | idem |
| Pagos | Efectivo al recibir, o link de tarjeta | — |
| Delivery | Chalchuapa y aledaños hasta Ciudad Real / El Refugio | migración 0020 |

Solo se da la dirección de **Sucursal Central**; la del Mercado nunca. Si preguntan algo que no está en el prompt (promociones, facturación, empleo), lo dice con franqueza y ofrece pasarlo con el equipo.

> ⚠️ Estos datos están **duplicados** entre `siteInfo.ts` y el system prompt del agente. Si cambia el horario o la dirección, hay que tocar los dos.

## Tono y formato (actualizado 2026-08-06)

- **Trato de usted**, cortesía salvadoreña («Buenas tardes», «con mucho gusto», «permítame», «¿me confirma?», «a sus órdenes»). Prohibidos explícitamente el voseo y la jerga («qué onda», «cabal», «va pues», «puchica», «chivo», «dale», «che»).
- **Formato WhatsApp, no Markdown.** WhatsApp usa `*negrita*` con **un** asterisco; `**doble**` sale literal en pantalla. El prompt lo prohíbe junto con los `#` de título y las tablas. Viñetas con `•`, línea en blanco entre bloques, máximo 2 emojis.
- El prompt trae **plantillas fijas** para el resumen antes de crear la orden y para la confirmación, así todos los pedidos se ven igual.

## Horario de atención — se calcula en JS, no en el prompt

El agente **no tiene reloj**: sin esto cotizaba «25 minutos» a las 7 de la mañana, tres horas antes de abrir. La aritmética de fechas es justo donde un LLM se equivoca, así que el nodo **`Merge Config`** la resuelve en JavaScript y le pasa el resultado ya masticado:

```js
horario = {
  ahora:      'jueves 6:58 a.m.',
  estado:     'CERRADO',            // o 'ABIERTO (cerramos a las 2:00 p.m.)'
  inmediato:  false,                // ¿se puede preparar ya?
  base:       'hoy a las 10:00 a.m.' // desde cuándo se empieza a preparar
}
```

Reglas que aplica (`America/El_Salvador`, martes a domingo 10:00–14:00, lunes cerrado):

- Antes de abrir en un día hábil → base = hoy a las 10:00 a.m.
- Después de cerrar, o lunes → base = el siguiente día que abre, a las 10:00 a.m.
- Abierto pero faltan menos de **45 min** para cerrar → no alcanza a salir, pasa al siguiente día.

El agente solo hace una suma: `base + estimated_minutes` de `crear_orden`, y **da la hora en reloj**, nunca «en X minutos». El prompt le ordena reutilizar el mismo día que trae `base` (hoy / mañana / el día), porque al recapitular tendía a cambiarlo.

> Si cambian los horarios hay que tocar `Merge Config` (`ABRE`, `CIERRA`, `abreEseDia`), el bloque DATOS FIJOS del prompt, y `siteInfo.ts`.

## Solo Sucursal Central

Todo pedido de WhatsApp sale de Central, sea retiro o domicilio. Está forzado en **dos** niveles:

1. El prompt prohíbe preguntar de cuál sucursal y ofrecer el Mercado.
2. `crear_orden` **hardcodea `location_code: 'C'`** y el campo ya no existe en el esquema de la herramienta — el modelo no tiene forma de mandar un pedido al Mercado aunque quisiera.

## Link de pago con tarjeta

Wompi funciona (`payment_url` sale como `https://s.wompi.sv/…` y redirige a `pagos.wompi.sv`). El fallo era del agente: la plantilla de confirmación no tenía renglón para el link, así que lo omitía — y después le decía al cliente «ya se lo envié», que era falso.

Tres capas de arreglo:

1. La plantilla de confirmación trae el renglón del link.
2. Regla dura: pegar `payment_url` completo en el **mismo** mensaje; si el cliente dice que no lo ve, volver a pegarlo en vez de escalar; si viene vacío, decirlo y ofrecer efectivo.
3. `crear_orden` inyecta un campo `INSTRUCCION` en la respuesta recordándoselo, para que la instrucción llegue junto al dato y no solo desde el prompt.

Además hay una regla general **«no invente envíos»**: lo único que le llega al cliente es el texto de ese mensaje; queda prohibido decir «ya se lo mandé», «le llega en unos segundos» o «revise arriba».

## Historial de conversaciones en el POS (`/conversaciones`)

Antes del 2026-08-06 los mensajes **no se guardaban en ninguna parte**: vivían en la memoria RAM de n8n (últimos 10 intercambios, se pierden al reiniciar) y en los logs de ejecución, que se purgan solos y no se pueden consultar por cliente.

Ahora hay un almacén propio:

```
Send WhatsApp ──> Registrar Chat ──> wa-log ──> whatsapp_conversations
                  (executeOnce)                 whatsapp_messages
                                                       │
                                          POS /conversaciones (Realtime)
```

- **Migración `0021_whatsapp_conversations.sql`** — `whatsapp_conversations` (una fila por teléfono, con vista previa y contador) + `whatsapp_messages` (cada mensaje, con el `wamid` de Meta para deduplicar).
- **Edge function `wa-log`** — POST protegido con `x-webhook-secret`. Recibe el turno completo (mensaje del cliente + respuesta del bot) en **una sola llamada**.
- **Nodo `Registrar Chat`** — va **después** de `Send WhatsApp`, con `executeOnce: true` y `onError: continueRegularOutput`. Así no agrega ni un milisegundo antes de responderle al cliente, y si el log falla, la conversación sigue igual: se pierde una línea del historial, nunca una venta.

**Acceso:** solo `admin` y `superadmin`. Las conversaciones traen datos personales (nombre, dirección, teléfono), así que RLS las cierra al resto de roles — verificado: un cajero ve 0 filas. El POS **solo lee**: no existen políticas de insert/update/delete para `authenticated`, así que el historial no se puede alterar desde el navegador.

### Detalles que costaron

- **No se puede usar `upsert` con `onConflict: 'wa_message_id'`.** El índice único es *parcial* (`where wa_message_id is not null`, porque los mensajes salientes no tienen wamid) y Postgres no infiere índices parciales en `ON CONFLICT`. Se consulta primero y se descarta el turno completo si el entrante ya estaba — descartarlo entero es importante: la respuesta del bot no tiene wamid propio y si no quedaría duplicada.
- **La pantalla renderiza `*negrita*` de WhatsApp**, si no se verían los asteriscos crudos en vez de lo que realmente ve el cliente.

### Lo que NO hace

Es un visor de **solo lectura**: no se puede responder desde el POS. Responder implicaría además silenciar al bot para ese cliente mientras un humano atiende (el handoff pegajoso que v2 no tiene) y devolverle el control después.

También arranca **desde cero**: lo conversado antes del 2026-08-06 no se puede recuperar.

Marcar las conversaciones donde el bot llamó a `avisar_al_equipo` sería agregar una columna y una línea en esa herramienta.

## Costo de tokens

El nodo Anthropic de n8n (`lmChatAnthropic` v1.5) **no expone prompt caching** — no hay opción de `cache_control`, así que el system prompt y los esquemas de herramientas se pagan completos en cada mensaje. Por eso el ahorro tuvo que salir de acortarlos.

| | Original | Ronda FAQ | Ahora (horario + link) |
|---|---|---|---|
| System prompt | ~1,709 tok | ~1,560 tok | ~1,717 tok |
| Descripciones + esquemas de las 4 herramientas | ~1,262 tok | ~866 tok | ~866 tok |
| **Fijo por mensaje** | **~2,971 tok** | **~2,426 tok** | **~2,583 tok (−13% vs. original)** |
| Ventana de memoria | 12 intercambios | 10 | 10 |

El prompt volvió a subir al meter el bloque de horario, la regla del link y la de «no invente envíos»; se recuperó comprimiendo lo demás (se deduplicó el horario, se acortaron las referencias de zona y la lista de jerga prohibida). Sigue **por debajo del original** aunque hace bastante más.

Si algún día n8n expone caching, el fijo baja otro ~90% en los aciertos de caché — es la mejora grande que queda pendiente.

## Diferencias con v1 que hay que tener en mente

- **Sin deduplicación por `msgId`.** v1 la tenía. El webhook de v2 responde 200 al instante (`responseMode` por defecto), así que Meta no reintenta y el riesgo es bajo — pero si el cliente manda dos mensajes casi a la vez, las dos ejecuciones corren en paralelo sobre la misma memoria y en teoría podrían crear dos órdenes. v1 lo serializaba con la tabla de estado.
- **Sin `HANDOFF` pegajoso.** En v1, tras un handoff el bot se callaba para ese cliente hasta que escribiera `menú`. En v2 el agente avisa al equipo y sigue conversando.
- El total, el número de orden y los ítems siempre los da el servidor — el agente nunca los inventa (probado).

## Pruebas hechas (2026-08-06, todas contra el sistema real)

| Qué | Resultado |
|---|---|
| `estado_orden` con teléfono que **no** coincide | «no aparece en el sistema» ✅ (el endpoint valida teléfono + orden) |
| `estado_orden` con el par correcto (79422273 / PP-C-0029) | «Recibida, ~25 minutos», con los ítems reales ✅ |
| Pedido completo delivery | orden **PP-C-0033** creada de verdad: subtotal 16.45 + envío 2.00 = **18.45** ✅ |
| Detección de zona («Colonia Ciudad Real») | Chalchuapa Alrededores, $2.00 ✅ |
| No mencionar la sucursal en delivery | ✅ |
| Teléfono correcto en la orden (no inventado) | ✅ |
| `guardar_contacto` | contacto en GHL con nombre, teléfono, correo, dirección, ciudad y tags ✅ |
| Saludo por nombre en la 2ª conversación | el lookup devolvió `found: true` ✅ |
| `avisar_al_equipo` (reclamo) | aviso enviado al equipo ✅ |
| Tono chalchuapaneco | «¡Qué onda!», «va pues», «cabal», «puchica», voseo; cero «che»/«dale» ✅ |
| Handshake GET de Meta | challenge correcto / `forbidden` ✅ |

La orden de prueba PP-C-0033 se borró y se le devolvió el stock al inventario.

## Cutover a producción — HECHO el 2026-08-06

1. ✅ v1 (`MmlbbbBghiKWttqP`) desactivado.
2. ✅ Los dos nodos webhook de v2 (`WhatsApp Webhook v2` y `Webhook Verify (GET) v2`) movidos a la ruta `pollos-primos-whatsapp`.
3. ✅ En Meta no se tocó nada — la Callback URL y el verify token siguen igual.
4. ✅ Verificado después del cambio: el handshake GET devuelve el challenge, un POST de mensaje entra y el agente responde con el menú; la ruta vieja `-v2` ya da 404.

> El respaldo `los-pollos-primos-whatsapp-chatbot-v2-agente.workflow.json` quedó con la ruta `pollos-primos-whatsapp-v2` en los dos nodos webhook. Si lo reimportás para restaurar producción, cambiá esa ruta a `pollos-primos-whatsapp`.

### Rollback
Devolverle a v2 la ruta `-v2` en los dos webhooks y reactivar v1.

## Go-live checklist (updated 2026-07-16)

1. ~~Phone Number ID + access token into config~~ ✅ done.
2. **Unblock the Meta app** — every Graph API call with the current token returns "API access blocked" (OAuthException 200). Check Meta App Dashboard for alerts: usually this means pending **business verification** (Business Settings → Security Center), the app being disabled/restricted, or an unaccepted platform policy update. Once cleared, if you generate a new token, paste it into `pollos_primos_config` → `WHATSAPP_ACCESS_TOKEN`.
3. **Set the webhook secret in Supabase**: Dashboard → Project Settings → Edge Functions → Secrets → add `WHATSAPP_WEBHOOK_SECRET` = `ppwa_7f3d9c2e8b514a6f90d1c4e7a2b8f635` (already set on the n8n side). Until then create-order returns 401.
3. Set `STAFF_WHATSAPP_NUMBER` so handoffs, new orders, cancellations, and API errors reach staff. (Note: Meta only allows free-form messages to numbers that have messaged the business within 24h, OR you must use a template. Easiest: have the staff phone send one message to the business number, then it stays warm through daily traffic.)
4. In Meta webhook config: Callback URL = the webhook URL above, Verify token = `pollos-primos-verify-2026`, subscribe to `messages`. Meta will do the GET handshake (already verified working).
5. Send a real WhatsApp message to the business number and run through a full order.
6. Optional hardening: forward the raw Meta payload signature (`X-Hub-Signature-256`) validation is not implemented — the webhook path being unguessable plus Meta's app secret is the current posture. Can be added in `Extract Message` if desired.

## Operational notes

- **Every branch ends in Save State + Prep Sends/Send WhatsApp**; HTTP nodes use `onError: continueRegularOutput`, so a Supabase or Graph API failure never crashes the run — the customer gets a friendly retry message and staff get an error alert.
- **Order status**: after an order exists, the customer can text "estado", "dónde está", "cuánto falta" → hits `order-status` edge function.
- **Cancel**: before order creation → cart reset; after creation → customer is told it's cancelled and staff get a `⚠️ CANCELACIÓN` alert to cancel manually in the POS (no cancel endpoint exists yet).
- **Handoff** (`operador`, `humano`, `hablar con alguien`, `reclamo`, `problema`, or `no entiendo` after 2 failed retries): customer is told "te paso con el equipo", staff get full context (cart, step, last message), and the bot goes silent for that customer, forwarding their messages to staff. The customer texts `menú` to return to the bot.
- **Concurrency**: state is last-write-wins per phone; two near-simultaneous messages from the same customer may race, which at rotisseria volume is a non-issue. Load-testing 5–10 *different* customers concurrently is safe since each phone has its own row.
- Executions log: n8n UI → Executions (error executions are saved — `saveDataErrorExecution: all`).
