// Concilia los cobros de Wompi contra las órdenes del POS.
//
// `wompi-webhook` sólo puede emparejar una transacción con su orden usando el
// `idExterno` (el `identificadorEnlaceComercio` que fijamos al crear el enlace
// por API). Los cobros hechos a mano desde el panel de Wompi, con el Wompi POS
// físico o con un QR generado a mano NO llevan ese campo, así que el webhook los
// descarta y la venta queda como pendiente para siempre. Eso ya pasó una vez
// (PP-C-0042, 9-ago: pagada en Wompi, pendiente en el POS durante dos días).
//
// Acá se cierra el hueco: se listan las transacciones aprobadas del período y
// se emparejan primero por `idExterno` y, si no lo traen, por monto + ventana de
// tiempo. Lo que no calza sin ambigüedad NO se toca — se devuelve para revisión
// humana. Marcar como pagada la orden equivocada es peor que dejarla pendiente.
//
//   POST /wompi-reconcile
//   header: x-webhook-secret: <WHATSAPP_WEBHOOK_SECRET>
//   body:   { "horas": 48 }            (por defecto 48)
//           { "aplicar": false }        para simular sin escribir
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { listWompiTransactions } from '../_shared/payments.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const bad = (message: string, status = 400) =>
  Response.json({ error: message }, { status, headers: CORS });

/** Una orden pagada por tarjeta se cobra minutos después de crearse, pero el
 *  cliente puede tardar. Hacia adelante el margen es corto: una transacción no
 *  puede pagar una orden que todavía no existía. */
const ANTES_MS = 24 * 60 * 60 * 1000;
const DESPUES_MS = 15 * 60 * 1000;

interface OrdenCandidata {
  id: string;
  order_number: string;
  total: number;
  created_at: string;
  payment_status: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return bad('Método no permitido', 405);

  const secret = Deno.env.get('WHATSAPP_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return bad('No autorizado', 401);
  }

  let body: { horas?: number; aplicar?: boolean };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const horas = Math.min(Math.max(body.horas ?? 48, 1), 24 * 30);
  const aplicar = body.aplicar !== false;

  const hasta = new Date();
  const desde = new Date(hasta.getTime() - horas * 3600_000);

  const transacciones = await listWompiTransactions(desde, hasta);
  if (!transacciones) return bad('No se pudo consultar Wompi', 502);

  const aprobadas = transacciones.filter((t) => t.esAprobada && t.esReal);

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Órdenes candidatas: no canceladas y sin pago registrado.
  const { data: pendientes } = await db
    .from('orders')
    .select('id, order_number, total, created_at, payment_status')
    .neq('status', 'cancelled')
    .neq('payment_status', 'paid')
    .gte('created_at', new Date(desde.getTime() - ANTES_MS).toISOString());

  // Referencias ya registradas: una transacción no se aplica dos veces.
  const { data: yaRegistradas } = await db
    .from('orders')
    .select('payment_reference')
    .not('payment_reference', 'is', null);
  const usadas = new Set((yaRegistradas ?? []).map((o) => o.payment_reference));

  const disponibles: OrdenCandidata[] = (pendientes ?? []).map((o) => ({
    ...o, total: Number(o.total),
  }));

  const conciliadas: unknown[] = [];
  const revisar: unknown[] = [];
  const yaEstaban: string[] = [];

  for (const t of aprobadas) {
    if (usadas.has(t.idTransaccion)) { yaEstaban.push(t.idTransaccion); continue; }

    const cuando = new Date(t.fechaTransaccion).getTime();
    const monto = Number(t.monto ?? t.montoOriginal);
    let orden: OrdenCandidata | undefined;
    let via = '';

    // 1) El camino limpio: el enlace se creó por API y trae el número de orden.
    const externo = (t.idExterno ?? '').trim().toUpperCase();
    if (externo) {
      orden = disponibles.find((o) => o.order_number === externo);
      via = 'idExterno';
    }

    // 2) Cobro hecho a mano: emparejar por monto exacto y cercanía en el tiempo.
    if (!orden) {
      const calzan = disponibles.filter((o) => {
        const creada = new Date(o.created_at).getTime();
        return Math.abs(o.total - monto) < 0.005
          && creada >= cuando - ANTES_MS
          && creada <= cuando + DESPUES_MS;
      });
      // Dos órdenes del mismo monto en la misma ventana: no hay forma de saber
      // cuál pagó. Va a revisión en vez de adivinar.
      if (calzan.length === 1) { orden = calzan[0]; via = 'monto+hora'; }
      else {
        revisar.push({
          id_transaccion: t.idTransaccion, monto, fecha: t.fechaTransaccion,
          autorizacion: t.codigoAutorizacion,
          motivo: calzan.length === 0
            ? 'ninguna orden pendiente calza por monto y hora'
            : `${calzan.length} órdenes calzan: ${calzan.map((o) => o.order_number).join(', ')}`,
        });
        continue;
      }
    }

    if (!orden) {
      revisar.push({
        id_transaccion: t.idTransaccion, monto, fecha: t.fechaTransaccion,
        motivo: `idExterno "${externo}" no corresponde a ninguna orden pendiente`,
      });
      continue;
    }

    if (aplicar) {
      const { error } = await db.from('orders').update({
        payment_status: 'paid',
        payment_method: 'payment_link',
        paid_at: new Date(cuando).toISOString(),
        payment_reference: t.idTransaccion,
      }).eq('id', orden.id).neq('payment_status', 'paid');
      if (error) {
        revisar.push({ id_transaccion: t.idTransaccion, motivo: error.message });
        continue;
      }
      usadas.add(t.idTransaccion);
      // Sacarla de disponibles: no puede casar con otra transacción.
      disponibles.splice(disponibles.indexOf(orden), 1);
    }

    conciliadas.push({
      order_number: orden.order_number, monto, via,
      id_transaccion: t.idTransaccion, fecha: t.fechaTransaccion,
    });
  }

  return Response.json({
    periodo: { desde: desde.toISOString(), hasta: hasta.toISOString() },
    aplicado: aplicar,
    transacciones_aprobadas: aprobadas.length,
    conciliadas,
    ya_registradas: yaEstaban.length,
    revisar,
  }, { headers: CORS });
});
