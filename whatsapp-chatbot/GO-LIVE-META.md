# Go-Live: Fixing "API access blocked" and connecting WhatsApp

Everything else is done and tested (order PP-C-0014 was created end-to-end and cleaned up).
The ONLY remaining blocker is Meta rejecting every API call with **"API access blocked" (OAuthException, code 200)**.
Follow these steps in order.

## Step 1 — Find out WHY the app is blocked (5 min)

1. Go to **https://developers.facebook.com/apps** and open the app that owns phone number ID `1264258403429380` (the app whose token starts with `EAAVMjBdyuk0...`).
2. Look at the top of the App Dashboard for any **red or yellow banner**. Common ones:
   - "Your app is restricted" / "App violates platform policies" → click it, read the reason, and use the **Request Review** button.
   - "Complete business verification to access …" → go to Step 2, this is your blocker.
   - "Data Use Checkup required" → complete the questionnaire (10 clicks, instant).
3. Also check **App settings → Basic**: if "App Mode" shows *Development*, that alone does NOT cause "API access blocked", but note it — you'll switch to *Live* in Step 5.

> "API access blocked" on EVERY endpoint (even `/me`) almost always = pending/failed **business verification** or an **app-level restriction**. It is never a token-format or permissions issue.

## Step 2 — Business verification (the usual culprit)

1. Go to **https://business.facebook.com** → select the business that owns the WhatsApp account (Los Pollos Primos / your agency business).
2. **Settings (gear) → Security Center → Business verification.**
3. Status must say **Verified**:
   - *Not started* → click **Start verification**. You'll need: legal business name, address, phone, and ONE document (business licence, tax registration/NIT, utility bill, or bank statement showing the business name+address). For El Salvador, the NIT/IVA registration or alcaldía business licence works.
   - *In review* → wait; typically 1–3 business days (can be minutes). The API unblocks automatically when it flips to Verified.
   - *Rejected* → resubmit with a document where the name/address EXACTLY match what you typed.
4. While there, check **Security Center → alerts** for any "restriction" on the business account itself and appeal it if present.

## Step 3 — Confirm WhatsApp product is healthy

1. In the App Dashboard → **WhatsApp → API Setup**: confirm phone number ID `1264258403429380` is listed and its status/quality is green (Connected).
2. **WhatsApp Manager** (business.facebook.com/wa/manage) → Phone numbers → check the number isn't flagged "Restricted".
3. If the number's certificate/display name is pending, finish that approval — it can hold the account in a limited state.

## Step 4 — Generate a PERMANENT token the right way

Do this AFTER the block clears (tokens minted while blocked stay useless):

1. **business.facebook.com → Settings → Users → System users** → **Add** → name it `n8n-bot`, role **Admin**.
2. Select the system user → **Add assets** → Apps → pick your app → toggle **Manage app** → Save.
3. Also **Add assets → WhatsApp accounts** → pick the Los Pollos Primos WABA → **Full control**.
4. Click **Generate new token** → choose the app → Token expiration: **Never** → permissions: check `whatsapp_business_messaging` and `whatsapp_business_management` → Generate.
5. Copy the token (starts with `EAA...`).

**Sanity-check it** (browser or terminal):
```
https://graph.facebook.com/v18.0/1264258403429380?access_token=PASTE_TOKEN
```
✅ Good = JSON with the phone number's info. ❌ Still blocked = back to Step 1/2.

## Step 5 — Plug it in

Two options:
- Paste the new token to Claude in the project chat → I update `pollos_primos_config` and re-run the live test, OR
- Yourself: n8n → **Data Tables → pollos_primos_config** → edit row `WHATSAPP_ACCESS_TOKEN` → paste value.

Then in the App Dashboard switch **App Mode → Live** (top toggle). In Development mode you can only message numbers listed under WhatsApp → API Setup → "To" recipients.

## Step 6 — Register the webhook in Meta (2 min, already tested on our side)

App Dashboard → **WhatsApp → Configuration → Webhook → Edit**:

| Field | Value |
|---|---|
| Callback URL | `https://n8n.automateaiservices.com/webhook/pollos-primos-whatsapp` |
| Verify token | `pollos-primos-verify-2026` |

Click **Verify and save** (our endpoint already passes the handshake), then under **Webhook fields** click **Manage** and **Subscribe** to `messages`.

## Step 7 — Final live test (from your phone)

1. From the staff phone (**7283 0282**) send **"hola"** to the business WhatsApp number.
2. You should get the menu. Order: `2` → `no` → `recoger en central` → `sí` → `efectivo`.
3. Expect: order number PP-C-XXXX + a staff alert arriving on 7283 0282.
4. Text `estado` → should reply "Tu orden PP-C-XXXX está: Recibido 📥…".
5. Text `cancelar` → cancellation confirmation + staff alert (cancel it in the POS manually).
6. Optional: repeat with `2` for payment to test the Wompi link (works only if WOMPI secrets are valid; otherwise the bot gracefully falls back to cash — that's by design).

## Quick reference

| Item | Value |
|---|---|
| n8n workflow | `MmlbbbBghiKWttqP` — Los Pollos Primos WhatsApp Chatbot (ACTIVE) |
| Webhook URL | `https://n8n.automateaiservices.com/webhook/pollos-primos-whatsapp` |
| Verify token | `pollos-primos-verify-2026` |
| Webhook secret | `ppwa_7f3d9c2e8b514a6f90d1c4e7a2b8f635` (matches Supabase ✅) |
| Phone Number ID | `1264258403429380` |
| Staff alerts to | `50372830282` |
| Config location | n8n → Data Tables → `pollos_primos_config` |
| Reset a customer | delete their row in Data Tables → `pollos_primos_conversations` |
