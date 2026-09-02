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
//   POST { "invalidar": { dte_id, tipo_anulacion, motivo, responsable } }
//                                     anula un DTE ya sellado por el MH
//
//   MH_ANULAR_PATH     ruta del evento de invalidacion (def. /fesv/anulardte)
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
import {
  construirInvalidacion,
  type Responsable,
  type TipoAnulacion,
} from '../_shared/invalidacion.ts';
import {
  firmar, transmitirDte, transmitirInvalidacion, motivoRechazo, aceptado,
} from '../_shared/mh.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  // apikey y x-client-info los manda supabase-js por su cuenta en
  // functions.invoke(). Sin ellos el navegador aprueba el preflight y después
  // bloquea el POST — sin error visible en el POS: la venta se cerraba bien y
  // el DTE no se emitía nunca.
  'Access-Control-Allow-Headers':
    'authorization, content-type, apikey, x-client-info, x-webhook-secret',
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



// ---------- invalidación de un DTE ya sellado ----------

interface ParamsInvalidacion {
  dte_id: string;
  tipo_anulacion: TipoAnulacion;
  motivo?: string | null;
  codigo_generacion_reemplazo?: string | null;
  responsable: Responsable;
  solicita?: Responsable;
}

async function invalidarDte(db: SupabaseClient, p: ParamsInvalidacion) {
  const { data: fiscal } = await db.from('fiscal_settings').select('*').maybeSingle();
  if (!fiscal) throw new Error('fiscal_settings sin configurar');

  const { data: dte } = await db
    .from('dte_documents').select('*').eq('id', p.dte_id).single();
  if (!dte) throw new Error('DTE no encontrado');

  // Sólo se invalida lo que el MH selló: un documento en contingencia o
  // rechazado nunca existió ante Hacienda, así que no hay nada que anular.
  if (dte.estado !== 'procesado' || !dte.sello_recibido) {
    throw new Error(
      'Sólo se puede invalidar un DTE procesado y sellado por el MH ' +
      '(estado actual: ' + dte.estado + ')',
    );
  }

  // Idempotente: si ya se invalidó, se devuelve el evento existente en vez de
  // transmitir otro. El índice parcial de la tabla lo respalda.
  const { data: previa } = await db
    .from('dte_invalidaciones').select('*')
    .eq('dte_document_id', p.dte_id)
    .in('estado', ['pendiente', 'contingencia', 'procesado'])
    .maybeSingle();

  let fila = previa;
  if (!fila) {
    const { data: creada, error } = await db.from('dte_invalidaciones').insert({
      dte_document_id: p.dte_id,
      tipo_anulacion: p.tipo_anulacion,
      motivo: p.motivo ?? null,
      codigo_generacion_reemplazo: p.codigo_generacion_reemplazo ?? null,
    }).select().single();
    if (error) throw new Error(error.message);
    fila = creada;
  }
  if (fila.estado === 'procesado') return fila;

  const ahora = new Date();
  const evento = construirInvalidacion({
    ambiente: fiscal.ambiente,
    codigoGeneracion: fila.codigo_generacion,
    fecEmi: new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/El_Salvador', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(ahora),
    horEmi: new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/El_Salvador', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(ahora),
    emisor: fiscal,
    documento: {
      tipoDte: dte.tipo_dte,
      codigoGeneracion: dte.codigo_generacion,
      selloRecibido: dte.sello_recibido,
      numeroControl: dte.numero_control,
      fecEmi: dte.fecha_emision,
      tipoDocumento: dte.receptor_nit ? '36' : null,
      numDocumento: dte.receptor_nit,
      nombre: dte.receptor_nombre,
      correo: dte.receptor_correo,
    },
    tipoAnulacion: p.tipo_anulacion,
    motivoAnulacion: p.motivo ?? null,
    codigoGeneracionR: p.codigo_generacion_reemplazo ?? null,
    responsable: p.responsable,
    // Si nadie más lo pidió, quien lo ejecuta es también quien lo solicita.
    solicita: p.solicita ?? p.responsable,
  });

  const patch: Record<string, unknown> = {
    json_evento: evento,
    intentos: (fila.intentos ?? 0) + 1,
    updated_at: new Date().toISOString(),
  };

  try {
    const firmado = await firmar(evento, fiscal.nit);
    const rta = await transmitirInvalidacion(firmado, fiscal.ambiente);

    patch.json_respuesta = rta;
    // aceptado() y no una comparación a mano: los EVENTOS del MH vuelven
    // RECIBIDO y los DTE PROCESADO. Comparar sólo contra PROCESADO registraba
    // como rechazado un evento que Hacienda había aceptado y sellado.
    if (aceptado(rta)) {
      patch.estado = 'procesado';
      patch.sello_recibido = rta.selloRecibido;
      patch.ultimo_error = null;
      // El DTE original queda marcado: ya no es un documento vigente.
      // 'anulado' es el valor del enum dte_estado (no 'invalidado').
      await db.from('dte_documents')
        .update({ estado: 'anulado', updated_at: new Date().toISOString() })
        .eq('id', p.dte_id);
    } else {
      patch.estado = rta.estado === 'RECHAZADO' ? 'rechazado' : 'contingencia';
      patch.ultimo_error = motivoRechazo(rta);
    }
  } catch (e) {
    patch.estado = 'contingencia';
    patch.ultimo_error = e instanceof Error ? e.message : String(e);
  }

  const { data: actualizada } = await db
    .from('dte_invalidaciones').update(patch).eq('id', fila.id).select().single();
  return actualizada;
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
  // completa: siempre es un contribuyente, no un consumidor final. Eso no cabe
  // en una orden — se guarda una vez en el registro de clientes y se lee acá.
  let cliente: Record<string, string | null> | null = null;
  if (tipoDte === '03') {
    const soloDigitos = order.customer_nit.replace(/\D/g, '');
    const { data } = order.customer_id
      ? await db.from('customers').select('*').eq('id', order.customer_id).maybeSingle()
      : await db.from('customers').select('*').eq('nit_key', soloDigitos).maybeSingle();
    cliente = data;

    // El check de la tabla ya garantiza que un cliente con NIT trae todo, así
    // que basta con comprobar que exista y que el NIT sea el mismo.
    if (!cliente || !cliente.cod_actividad) {
      throw new Error(
        'Para emitir crédito fiscal el cliente tiene que estar registrado con NRC, ' +
        'actividad económica y dirección fiscal. Registralo desde la caja o cobrá ' +
        'como consumidor final (sin NIT).',
      );
    }
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
    // El CCF identifica al receptor por NIT y exige su ficha fiscal completa;
    // la factura lo identifica con tipo+número de documento y admite que no
    // haya nadie (consumidor final anónimo).
    receptor: cliente
      ? {
          nit: cliente.nit ?? order.customer_nit,
          nrc: cliente.nrc,
          nombre: cliente.name ?? order.customer_name ?? '',
          nombreComercial: cliente.name ?? null,
          codActividad: cliente.cod_actividad,
          descActividad: cliente.desc_actividad,
          correo: cliente.email ?? order.customer_email,
          telefono: cliente.phone ?? order.customer_phone,
          direccion: {
            departamento: cliente.departamento ?? '',
            municipio: cliente.municipio ?? '',
            distrito: cliente.distrito ?? '',
            complemento: cliente.complemento ?? '',
          },
        }
      : order.customer_name || order.customer_phone
      ? {
          tipoDocumento: '36',
          numDocumento: order.customer_nit ?? undefined,
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
    const rta = await transmitirDte(
      firmado, fiscal.ambiente, tipoDte, fila.codigo_generacion,
    );

    patch.json_respuesta = rta;
    if (aceptado(rta)) {
      patch.estado = 'procesado';
      patch.sello_recibido = rta.selloRecibido;
      patch.ultimo_error = null;
    } else {
      // Un RECHAZADO no se reintenta solo: el JSON está mal y hay que corregirlo.
      patch.estado = rta.estado === 'RECHAZADO' ? 'rechazado' : 'contingencia';
      patch.ultimo_error = motivoRechazo(rta);
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

  let body: {
    order_id?: string;
    procesar_pendientes?: number;
    invalidar?: ParamsInvalidacion;
  };
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

      // El corte evita que al pasar a produccion se emitan DTE reales por toda
      //    la historia del POS: ventas viejas que nunca se facturaron por este
      //    medio y que no corresponde documentar hoy con fecha de hoy.
      const { data: fiscalCola } = await db
        .from('fiscal_settings').select('nombre, nit, emision_desde').maybeSingle();

      let q = db.from('orders').select('id').eq('payment_status', 'paid');
      if (fiscalCola?.emision_desde) q = q.gte('created_at', fiscalCola.emision_desde);
      const { data: pagadas } = await q
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
      // 3) invalidaciones encoladas por cancel_order. Cancelar una venta cuyo
      //    DTE ya estaba sellado deja una fila 'pendiente' y no transmite en el
      //    momento: si el MH esta caido, el cajero no tiene por que esperar.
      //    Sin esta cola, el documento seguiria vigente ante Hacienda.
      const { data: invPendientes } = await db
        .from('dte_invalidaciones')
        .select('id, dte_document_id, tipo_anulacion, motivo, codigo_generacion_reemplazo')
        .in('estado', ['pendiente', 'contingencia'])
        .lt('intentos', 10)
        .order('created_at')
        .limit(limite);

      const invalidaciones = [];
      for (const inv of invPendientes ?? []) {
        try {
          // El responsable es el contribuyente: la invalidacion la ejecuta el
          // sistema en su nombre, no un cajero identificable desde el cron.
          const r = await invalidarDte(db, {
            dte_id: inv.dte_document_id,
            tipo_anulacion: inv.tipo_anulacion,
            motivo: inv.motivo,
            codigo_generacion_reemplazo: inv.codigo_generacion_reemplazo,
            responsable: {
              nombre: fiscalCola?.nombre ?? '',
              tipoDocumento: '36',
              numDocumento: fiscalCola?.nit ?? '',
            },
          });
          invalidaciones.push({ id: inv.id, estado: r?.estado });
        } catch (e) {
          invalidaciones.push({ id: inv.id, error: String(e) });
        }
      }

      return Response.json({
        procesados: resultados.length,
        resultados,
        invalidaciones,
      }, { headers: CORS });
    }

    // Invalidación de un DTE ya sellado. Va acá y no en su propia función para
    // reutilizar el firmador y el token del MH, que son los mismos.
    if (body.invalidar) {
      const inv = await invalidarDte(db, body.invalidar);
      return Response.json({
        estado: inv?.estado,
        codigo_generacion: inv?.codigo_generacion,
        sello_recibido: inv?.sello_recibido,
        error: inv?.ultimo_error,
      }, { headers: CORS });
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
