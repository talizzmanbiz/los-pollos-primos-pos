// Emisión de Documentos Tributarios Electrónicos al Ministerio de Hacienda.
//
// Flujo por documento:
//   1. reserva el número de control (correlativo transaccional en Postgres)
//   2. arma el JSON del DTE con los datos de la orden
//   3. lo firma en el firmador del MH (svfe-api-firmador, self-hosted)
//   4. lo transmite a api.dtes.mh.gob.sv y guarda el sello recibido
//
// La venta NO depende de que esto funcione: si el MH o el firmador fallan, el
// documento queda 'contingencia' y se reintenta. Hacienda contempla la
// contingencia justamente para no bloquear la operación del negocio.
//
// Uso:
//   POST { "order_id": "..." }        emite el DTE de una orden
//   POST { "procesar_pendientes": N } reintenta la cola (para el cron de n8n)
//
// Secretos (Dashboard → Edge Functions → Secrets):
//   MH_API_URL         https://apitest.dtes.mh.gob.sv | https://api.dtes.mh.gob.sv
//   MH_USER            usuario del portal DTE (el NIT del emisor)
//   MH_PASSWORD        clave del API del portal DTE
//   FIRMADOR_URL       http://tu-vps:8113/firmardocumento/
//   FIRMADOR_PASSWORD  clave privada del certificado (.crt del MH)
//   DTE_WEBHOOK_SECRET secreto compartido con n8n para la cola
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { construirDte, type Emisor, type ItemVenta } from '../_shared/dte.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const bad = (message: string, status = 400) =>
  Response.json({ error: message }, { status, headers: CORS });

/** Efectivo/tarjeta según CAT-017 del MH. */
const CODIGO_PAGO: Record<string, string> = {
  cash: '01',
  efectivo: '01',
  card: '03',
  wompi: '03',
  payment_link: '03',
  transfer: '05',
};

// ---------- firmador ----------

async function firmar(dteJson: unknown, nit: string): Promise<string> {
  const url = Deno.env.get('FIRMADOR_URL');
  const password = Deno.env.get('FIRMADOR_PASSWORD');
  if (!url || !password) throw new Error('Firmador sin configurar (FIRMADOR_URL/FIRMADOR_PASSWORD)');

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nit: nit.replace(/-/g, ''),
      activo: true,
      passwordPri: password,
      dteJson,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.status !== 'OK' || typeof data?.body !== 'string') {
    throw new Error('Firmador rechazó el documento: ' + JSON.stringify(data?.body ?? data));
  }
  return data.body; // JWS compacto
}

// ---------- autenticación y transmisión al MH ----------

let tokenCache: { value: string; expiresAt: number } | null = null;

async function tokenMh(apiUrl: string): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.value;

  const user = Deno.env.get('MH_USER');
  const pwd = Deno.env.get('MH_PASSWORD');
  if (!user || !pwd) throw new Error('Credenciales del MH sin configurar (MH_USER/MH_PASSWORD)');

  const res = await fetch(`${apiUrl}/seguridad/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ user, pwd }).toString(),
  });
  const data = await res.json().catch(() => null);
  const token: string | undefined = data?.body?.token;
  if (!res.ok || !token) throw new Error('El MH no devolvió token: ' + JSON.stringify(data));

  // El token del MH dura 24h; se refresca una hora antes por seguridad.
  tokenCache = { value: token, expiresAt: Date.now() + 23 * 3600_000 };
  return token;
}

interface RespuestaMh {
  estado?: string;              // PROCESADO | RECHAZADO
  selloRecibido?: string | null;
  descripcionMsg?: string;
  observaciones?: string[];
}

async function transmitir(
  apiUrl: string,
  documentoFirmado: string,
  ambiente: string,
  tipoDte: string,
  codigoGeneracion: string,
): Promise<RespuestaMh> {
  const token = await tokenMh(apiUrl);
  const res = await fetch(`${apiUrl}/fesv/recepciondte`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      'User-Agent': 'LosPollosPrimos-POS/1.0',
    },
    body: JSON.stringify({
      ambiente,
      idEnvio: Date.now() % 2_147_483_647,
      version: tipoDte === '01' ? 1 : 3,
      tipoDte,
      documento: documentoFirmado,
      codigoGeneracion: codigoGeneracion.toUpperCase(),
    }),
  });
  const data = await res.json().catch(() => ({}));
  // Un 4xx del MH sigue trayendo el motivo del rechazo: se guarda tal cual.
  return data as RespuestaMh;
}

// ---------- emisión de una orden ----------

async function emitirOrden(db: SupabaseClient, orderId: string) {
  const { data: existente } = await db
    .from('dte_documents').select('*').eq('order_id', orderId).maybeSingle();
  if (existente?.estado === 'procesado') return existente; // idempotente

  const { data: fiscal } = await db.from('fiscal_settings').select('*').maybeSingle();
  if (!fiscal) throw new Error('fiscal_settings sin configurar');

  const { data: order } = await db
    .from('orders')
    .select('*, order_items(quantity, unit_price, products(sku, name))')
    .eq('id', orderId)
    .single();
  if (!order) throw new Error('Orden no encontrada');

  // Un cliente con NIT recibe CCF; el resto, factura de consumidor final.
  const tipoDte: '01' | '03' = order.customer_nit ? '03' : '01';

  // fe-ccf-v4 exige del receptor NIT, NRC, actividad económica y dirección
  // completa: siempre es un contribuyente, no un consumidor final. La orden del
  // POS no captura nada de eso, así que se corta acá con un mensaje claro en
  // vez de transmitir un documento que el MH va a rechazar por campos vacíos.
  if (tipoDte === '03' && !order.customer_activity_code) {
    throw new Error(
      'Para emitir CCF hace falta la actividad económica y la dirección fiscal del ' +
      'cliente. Registralos en la orden o cobrá como consumidor final (sin NIT).',
    );
  }

  const items: ItemVenta[] = (order.order_items ?? []).map((it: {
    quantity: number; unit_price: number; products: { sku: string; name: string } | null;
  }) => ({
    codigo: it.products?.sku ?? 'GEN',
    descripcion: it.products?.name ?? 'Producto',
    cantidad: it.quantity,
    precioUnitario: Number(it.unit_price),
  }));
  if (Number(order.delivery_fee) > 0) {
    items.push({
      codigo: 'DELIVERY',
      descripcion: 'Servicio de entrega a domicilio',
      cantidad: 1,
      precioUnitario: Number(order.delivery_fee),
    });
  }
  if (items.length === 0) throw new Error('La orden no tiene ítems');

  // El correlativo se reserva una sola vez y se reutiliza en los reintentos:
  // pedir otro dejaría huecos en la numeración, que el MH observa.
  let fila = existente;
  if (!fila) {
    const { data: numeroControl, error: errNum } = await db
      .rpc('siguiente_numero_control', { p_tipo: tipoDte });
    if (errNum) throw new Error('No se pudo reservar el número de control: ' + errNum.message);

    const ahora = new Date();
    const svDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/El_Salvador', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(ahora);
    const svTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/El_Salvador', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(ahora);

    const { data: creada, error: errIns } = await db.from('dte_documents').insert({
      order_id: orderId,
      tipo_dte: tipoDte,
      numero_control: numeroControl,
      fecha_emision: svDate,
      hora_emision: svTime,
      receptor_nombre: order.customer_name,
      receptor_nit: order.customer_nit ?? null,
      receptor_correo: order.customer_email,
    }).select().single();
    if (errIns) throw new Error(errIns.message);
    fila = creada;
  }

  const { documento, totales } = construirDte({
    tipoDte,
    ambiente: fiscal.ambiente,
    numeroControl: fila.numero_control,
    codigoGeneracion: fila.codigo_generacion,
    fecEmi: fila.fecha_emision,
    horEmi: fila.hora_emision,
    emisor: fiscal as Emisor,
    receptor: order.customer_nit
      ? {
          tipoDocumento: '36',
          numDocumento: order.customer_nit,
          nombre: order.customer_name ?? undefined,
          correo: order.customer_email,
          telefono: order.customer_phone,
        }
      : null,
    items,
    codigoPago: CODIGO_PAGO[order.payment_method ?? 'cash'] ?? '01',
  });

  const patch: Record<string, unknown> = {
    ...totales,
    json_dte: documento,
    intentos: (fila.intentos ?? 0) + 1,
    updated_at: new Date().toISOString(),
  };

  try {
    const firmado = await firmar(documento, fiscal.nit);
    const apiUrl = Deno.env.get('MH_API_URL') ?? 'https://apitest.dtes.mh.gob.sv';
    const rta = await transmitir(
      apiUrl, firmado, fiscal.ambiente, tipoDte, fila.codigo_generacion,
    );

    patch.json_respuesta = rta;
    if (rta.estado === 'PROCESADO' && rta.selloRecibido) {
      patch.estado = 'procesado';
      patch.sello_recibido = rta.selloRecibido;
      patch.ultimo_error = null;
    } else {
      // Un RECHAZADO no se reintenta solo: el JSON está mal y hay que corregirlo.
      patch.estado = rta.estado === 'RECHAZADO' ? 'rechazado' : 'contingencia';
      patch.ultimo_error = [rta.descripcionMsg, ...(rta.observaciones ?? [])]
        .filter(Boolean).join(' · ') || 'Respuesta desconocida del MH';
    }
  } catch (e) {
    // Firmador caído o red: es transitorio, se reintenta.
    patch.estado = 'contingencia';
    patch.ultimo_error = e instanceof Error ? e.message : String(e);
  }

  const { data: actualizada } = await db
    .from('dte_documents').update(patch).eq('id', fila.id).select().single();
  return actualizada;
}

// ---------- handler ----------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return bad('Método no permitido', 405);

  let body: { order_id?: string; procesar_pendientes?: number };
  try {
    body = await req.json();
  } catch {
    return bad('JSON inválido');
  }

  // La cola la dispara n8n con el secreto compartido; la emisión puntual viene
  // del POS con el JWT del cajero, que Supabase ya validó antes de llegar acá.
  const secret = Deno.env.get('DTE_WEBHOOK_SECRET');
  const conSecreto = !!secret && req.headers.get('x-webhook-secret') === secret;
  if (body.procesar_pendientes && !conSecreto) return bad('No autorizado', 401);
  if (!conSecreto && !req.headers.get('authorization')) return bad('No autorizado', 401);

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    if (body.procesar_pendientes) {
      const limite = Math.min(body.procesar_pendientes, 100);

      // 1) documentos que quedaron a medias (firmador caído, MH sin responder)
      const { data: enCola } = await db
        .from('dte_documents')
        .select('order_id')
        .in('estado', ['pendiente', 'contingencia'])
        .lt('intentos', 10)
        .not('order_id', 'is', null)
        .order('created_at')
        .limit(limite);

      // 2) ventas pagadas que nunca llegaron a generar un DTE — el caso que de
      //    verdad importa: si la caja estuvo sin internet, la venta existe pero
      //    el documento no, y ante Hacienda eso es una venta sin documentar.
      const { data: conDte } = await db
        .from('dte_documents').select('order_id').not('order_id', 'is', null);
      const yaEmitidas = new Set((conDte ?? []).map((d) => d.order_id));

      const { data: pagadas } = await db
        .from('orders')
        .select('id')
        .eq('payment_status', 'paid')
        .order('created_at', { ascending: false })
        .limit(500);

      const ids = [
        ...new Set([
          ...(enCola ?? []).map((p) => p.order_id as string),
          ...(pagadas ?? []).map((o) => o.id).filter((id) => !yaEmitidas.has(id)),
        ]),
      ].slice(0, limite);

      const resultados = [];
      for (const id of ids) {
        try {
          const r = await emitirOrden(db, id);
          resultados.push({ order_id: id, estado: r?.estado });
        } catch (e) {
          resultados.push({ order_id: id, error: String(e) });
        }
      }
      return Response.json({ procesados: resultados.length, resultados }, { headers: CORS });
    }

    if (!body.order_id) return bad('Falta order_id');
    const dte = await emitirOrden(db, body.order_id);
    return Response.json({
      estado: dte?.estado,
      numero_control: dte?.numero_control,
      codigo_generacion: dte?.codigo_generacion,
      sello_recibido: dte?.sello_recibido,
      error: dte?.ultimo_error,
    }, { headers: CORS });
  } catch (e) {
    console.error('emit-dte', e);
    return bad(e instanceof Error ? e.message : 'Error al emitir el DTE', 500);
  }
});
