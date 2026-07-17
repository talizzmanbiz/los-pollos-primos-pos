// Wompi El Salvador payment-link integration.
//
// Wompi SV uses OAuth2 client-credentials: exchange the App ID + API Secret for
// a short-lived Bearer token, then create an "Enlace de Pago" whose `urlEnlace`
// is the customer-facing checkout URL. Docs: https://docs.wompi.sv
//
// Secrets (Dashboard → Edge Functions → Secrets):
//   WOMPI_MERCHANT_ID  App ID  (client_id) from the Wompi control panel
//   WOMPI_API_SECRET   API Secret (client_secret) from the Wompi control panel
//   STOREFRONT_URL     optional; where to send the customer after paying
//                      (default https://los-pollosprimos.com)
//
// When the credentials are unset createPaymentLink returns null and callers
// fall back to cash on pickup/delivery, so ventas are never blocked.

const WOMPI_ID_URL = Deno.env.get('WOMPI_ID_URL') ?? 'https://id.wompi.sv/connect/token';
const WOMPI_API_URL = Deno.env.get('WOMPI_API_URL') ?? 'https://api.wompi.sv';

export interface PaymentLinkRequest {
  orderId: string;
  orderNumber: string;
  total: number;
  customerName: string;
  customerPhone: string;
}

// Warm-invocation token cache (tokens live ~1h; refresh 60s early).
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(clientId: string, clientSecret: string): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;

  const form = new URLSearchParams({
    grant_type: 'client_credentials',
    audience: 'wompi_api',
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(WOMPI_ID_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });

  if (!res.ok) {
    console.error('wompi token error', res.status, await res.text());
    return null;
  }

  const data = await res.json();
  if (typeof data.access_token !== 'string') return null;
  const ttlMs = (Number(data.expires_in) || 3600) * 1000;
  cachedToken = { value: data.access_token, expiresAt: Date.now() + ttlMs - 60_000 };
  return cachedToken.value;
}

export async function createPaymentLink(req: PaymentLinkRequest): Promise<string | null> {
  const clientId = Deno.env.get('WOMPI_MERCHANT_ID');
  const clientSecret = Deno.env.get('WOMPI_API_SECRET');
  if (!clientId || !clientSecret) return null;

  const storefront = Deno.env.get('STOREFRONT_URL') ?? 'https://los-pollosprimos.com';
  const webhookUrl =
    Deno.env.get('WOMPI_WEBHOOK_URL') ??
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/wompi-webhook`;

  try {
    const token = await getAccessToken(clientId, clientSecret);
    if (!token) return null;

    const res = await fetch(`${WOMPI_API_URL}/EnlacePago`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identificadorEnlaceComercio: req.orderNumber,
        monto: req.total,
        nombreProducto: `Pedido ${req.orderNumber} — Los Pollos Primos`,
        // At least one method must be enabled. Card is the one requested;
        // flip these on once the corresponding methods are active on the
        // Wompi account. NOTE: Wompi's API spells the card flag
        // "PermitirTarjetaCreditoDebido" (not "…Debito") — the exact key
        // matters; a mismatch makes Wompi treat all methods as disabled.
        formaPago: {
          permitirTarjetaCreditoDebido: true,
          permitirPagoConPuntoAgricola: false,
          permitirPagoEnCuotasAgricola: false,
          permitirPagoEnBitcoin: false,
        },
        infoProducto: {
          descripcionProducto: `Pedido ${req.orderNumber} de Los Pollos Primos`,
        },
        configuracion: {
          urlRedirect: `${storefront}/tienda/estado`,
          urlRetorno: `${storefront}/tienda`,
          urlWebhook: webhookUrl,
          notificarTransaccionCliente: true,
          esMontoEditable: false,
          esCantidadEditable: false,
        },
      }),
    });

    if (!res.ok) {
      console.error('wompi enlace error', res.status, await res.text());
      return null;
    }

    const data = await res.json();
    return typeof data.urlEnlace === 'string' ? data.urlEnlace : null;
  } catch (err) {
    console.error('wompi unreachable', err);
    return null;
  }
}
