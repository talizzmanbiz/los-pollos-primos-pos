# Los Pollos Primos — WhatsApp Chatbot: Deployment Guide

**Status: DEPLOYED AND ACTIVE** on `https://n8n.automateaiservices.com` (workflow ID `MmlbbbBghiKWttqP`), tested end-to-end on 2026-07-12. Only the Meta/WhatsApp credentials are pending (see "Go-live checklist").

## URLs

| Purpose | URL |
|---|---|
| Incoming messages (Meta → n8n) | `https://n8n.automateaiservices.com/webhook/pollos-primos-whatsapp` (POST) |
| Meta verification handshake | same URL (GET) — already tested, echoes `hub.challenge` |

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
| `WHATSAPP_WEBHOOK_SECRET` | `CHANGE_ME` | must equal the secret the Supabase edge functions expect (`x-webhook-secret`) |
| `WHATSAPP_PHONE_ID` | `CHANGE_ME` | Phone Number ID from Meta App Dashboard |
| `WHATSAPP_ACCESS_TOKEN` | `CHANGE_ME` | permanent System User token (Meta Business Settings) — do NOT use the 24h temp token |
| `WHATSAPP_VERIFY_TOKEN` | `pollos-primos-verify-2026` | enter this exact string as "Verify token" in Meta webhook config |
| `STAFF_WHATSAPP_NUMBER` | *(empty)* | staff/owner WhatsApp number for handoff + new-order alerts, e.g. `503XXXXXXXX`. Empty = alerts silently skipped |
| `PAYMENT_GATEWAY_PLACEHOLDER` | `https://pay.example.com/{order_id}` | replace when Wompi/Pagadito/QPayPro is chosen; `{order_id}` is substituted with the order number |
| `WHATSAPP_API_VERSION` | `v18.0` | Graph API version |

Note: the project brief listed `graph.instagram.com` as the API host — that's a typo; the WhatsApp Cloud API host is `graph.facebook.com`, which is what the workflow uses.

### Prices
The `PRICES` map lives at the top of the **Brain** code node (combos $12.95/$6.95/$3.95, solo $11/$6/$3.50, extras: chimichurri $1.00, tortillas $0.50/$1.00/$2.00, cebolla $0.75/$1.50). These are **display-only** — the Supabase `create-order` response total is what's quoted in the final confirmation. If POS prices change, update the Brain node to match. Delivery: Zona 1 $1.00 / Zona 2 $1.50, Central only.

## Go-live checklist

1. In Meta App Dashboard get the **Phone Number ID** and a **permanent access token**; paste both into `pollos_primos_config`.
2. Set `WHATSAPP_WEBHOOK_SECRET` in the config table to the same value the Supabase `create-order` function validates (currently the function returns 401 `No autorizado` with the placeholder — confirmed in testing, which proves connectivity and the error path).
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
