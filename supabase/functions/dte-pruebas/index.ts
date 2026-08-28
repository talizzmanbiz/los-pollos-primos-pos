// Batería de pruebas mínimas para el ambiente de certificación del MH.
//
// Hacienda exige transmitir decenas de documentos antes de autorizar a un
// emisor (90 facturas, 5 eventos de invalidación...). A mano es inviable.
//
// Genera documentos SINTÉTICOS: no toca `orders`, no mueve inventario, no
// registra ventas en caja ni en contabilidad. Esa es la razón de que exista
// separada de emit-dte en vez de pedirle 90 emisiones: emit-dte parte de
// ventas reales, y crear 90 ventas falsas ensuciaría el negocio entero.
//
// Los documentos sí quedan en `dte_documents` con `order_id` NULL, porque son
// correlativos realmente consumidos ante el MH y tienen que quedar registrados.
//
// Uso (requiere x-webhook-secret):
//   POST { "facturas": 25 }        transmite 25 facturas de prueba
//   POST { "invalidaciones": 3 }   invalida 3 documentos de prueba ya sellados
//
// El tope por llamada es 25: cada documento son dos viajes de red (firmador y
// MH) y la función tiene límite de tiempo. Para 90 se llama varias veces.
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { construirDte, type Emisor, type ItemVenta } from '../_shared/dte.ts';
import { construirInvalidacion, TIPO_ANULACION } from '../_shared/invalidacion.ts';
import {
  firmar, transmitirDte, transmitirInvalidacion, motivoRechazo,
} from '../_shared/mh.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const bad = (message: string, status = 400) =>
  Response.json({ error: message }, { status, headers: CORS });

const TOPE = 25;

// Catálogo real del negocio: el MH espera variedad en las pruebas, no 90 veces
// el mismo documento.
const MENU: { codigo: string; descripcion: string; precio: number }[] = [
  { codigo: 'COMBO1', descripcion: 'El Primo - Combo Medio', precio: 6.95 },
  { codigo: 'COMBO2', descripcion: 'El Primito - Combo Cuarto', precio: 3.95 },
  { codigo: 'MEDIO', descripcion: 'Medio pollo', precio: 6.00 },
  { codigo: 'CUARTO', descripcion: 'Cuarto de pollo', precio: 3.50 },
  { codigo: 'BEBIDA', descripcion: 'Bebida 500ml', precio: 1.25 },
  { codigo: 'EXTRA', descripcion: 'Porcion de tortillas', precio: 0.75 },
];

const PAGOS = ['01', '02', '03', '05']; // efectivo, débito, crédito, transferencia

const alAzar = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const entre = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

/** Documento de prueba con cantidad de ítems, productos y montos variados. */
function itemsDePrueba(): ItemVenta[] {
  const cuantos = entre(1, 4);
  const elegidos = [...MENU].sort(() => Math.random() - 0.5).slice(0, cuantos);
  return elegidos.map((p) => ({
    codigo: p.codigo,
    descripcion: p.descripcion,
    cantidad: entre(1, 3),
    precioUnitario: p.precio,
  }));
}

function fechaHoraSv() {
  const ahora = new Date();
  return {
    fecha: new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/El_Salvador', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(ahora),
    hora: new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/El_Salvador', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(ahora),
  };
}

// ---------- facturas ----------

async function emitirFacturaPrueba(db: SupabaseClient, fiscal: Emisor & { ambiente: string }) {
  const { data: numeroControl, error: errNum } = await db
    .rpc('siguiente_numero_control', { p_tipo: '01' });
  if (errNum) throw new Error('correlativo: ' + errNum.message);

  const { fecha, hora } = fechaHoraSv();

  // order_id NULL: es un documento de prueba, no corresponde a ninguna venta.
  const { data: fila, error: errIns } = await db.from('dte_documents').insert({
    order_id: null,
    tipo_dte: '01',
    numero_control: numeroControl,
    fecha_emision: fecha,
    hora_emision: hora,
    receptor_nombre: null,
    receptor_nit: null,
  }).select().single();
  if (errIns) throw new Error('insert: ' + errIns.message);

  const { documento, totales } = construirDte({
    tipoDte: '01',
    ambiente: fiscal.ambiente,
    numeroControl: fila.numero_control,
    codigoGeneracion: fila.codigo_generacion,
    fecEmi: fila.fecha_emision,
    horEmi: fila.hora_emision,
    emisor: fiscal,
    receptor: null,                 // consumidor final
    items: itemsDePrueba(),
    codigoPago: alAzar(PAGOS),
  });

  const patch: Record<string, unknown> = {
    ...totales,
    json_dte: documento,
    intentos: 1,
    updated_at: new Date().toISOString(),
  };

  const firmado = await firmar(documento, fiscal.nit);
  const rta = await transmitirDte(firmado, fiscal.ambiente, '01', fila.codigo_generacion);

  patch.json_respuesta = rta;
  if (rta.estado === 'PROCESADO' && rta.selloRecibido) {
    patch.estado = 'procesado';
    patch.sello_recibido = rta.selloRecibido;
  } else {
    patch.estado = rta.estado === 'RECHAZADO' ? 'rechazado' : 'contingencia';
    patch.ultimo_error = motivoRechazo(rta);
  }

  await db.from('dte_documents').update(patch).eq('id', fila.id);
  return {
    numero_control: fila.numero_control,
    estado: patch.estado as string,
    total: totales.total_pagar,
    error: patch.ultimo_error as string | undefined,
  };
}

// ---------- CCF ----------

/**
 * El CCF exige un receptor contribuyente completo: NIT, NRC, actividad
 * economica y direccion. Para las pruebas se usan los datos del propio emisor.
 *
 * Es deliberado: inventar un NIT daria un receptor que no existe, y usar el de
 * un proveedor real seria meter la identidad de un tercero en documentos de
 * prueba sin su permiso. Los datos propios son validos, reales y de quien
 * transmite.
 */
interface ReceptorPrueba {
  nit?: string; nrc?: string; nombre?: string;
  codActividad?: string; descActividad?: string;
}

async function emitirCcfPrueba(
  db: SupabaseClient,
  fiscal: Emisor & { ambiente: string },
  recep: ReceptorPrueba = {},
) {
  const { data: numeroControl, error: errNum } = await db
    .rpc('siguiente_numero_control', { p_tipo: '03' });
  if (errNum) throw new Error('correlativo: ' + errNum.message);

  const { fecha, hora } = fechaHoraSv();

  const { data: fila, error: errIns } = await db.from('dte_documents').insert({
    order_id: null,
    tipo_dte: '03',
    numero_control: numeroControl,
    fecha_emision: fecha,
    hora_emision: hora,
    receptor_nombre: recep.nombre ?? fiscal.nombre,
    receptor_nit: recep.nit ?? fiscal.nit,
  }).select().single();
  if (errIns) throw new Error('insert: ' + errIns.message);

  const { documento, totales } = construirDte({
    tipoDte: '03',
    ambiente: fiscal.ambiente,
    numeroControl: fila.numero_control,
    codigoGeneracion: fila.codigo_generacion,
    fecEmi: fila.fecha_emision,
    horEmi: fila.hora_emision,
    emisor: fiscal,
    receptor: {
      nit: recep.nit ?? fiscal.nit,
      nrc: recep.nrc ?? fiscal.nrc,
      nombre: recep.nombre ?? fiscal.nombre,
      codActividad: recep.codActividad ?? fiscal.cod_actividad,
      descActividad: recep.descActividad ?? fiscal.desc_actividad,
      correo: fiscal.correo,
      telefono: fiscal.telefono,
      direccion: {
        departamento: fiscal.departamento,
        municipio: fiscal.municipio,
        distrito: fiscal.distrito,
        complemento: fiscal.complemento,
      },
    },
    items: itemsDePrueba(),
    codigoPago: alAzar(PAGOS),
  });

  const patch: Record<string, unknown> = {
    ...totales,
    json_dte: documento,
    intentos: 1,
    updated_at: new Date().toISOString(),
  };

  const firmado = await firmar(documento, fiscal.nit);
  const rta = await transmitirDte(firmado, fiscal.ambiente, '03', fila.codigo_generacion);

  patch.json_respuesta = rta;
  if (rta.estado === 'PROCESADO' && rta.selloRecibido) {
    patch.estado = 'procesado';
    patch.sello_recibido = rta.selloRecibido;
  } else {
    patch.estado = rta.estado === 'RECHAZADO' ? 'rechazado' : 'contingencia';
    patch.ultimo_error = motivoRechazo(rta);
  }

  await db.from('dte_documents').update(patch).eq('id', fila.id);
  return {
    numero_control: fila.numero_control,
    estado: patch.estado as string,
    total: totales.total_pagar,
    error: patch.ultimo_error as string | undefined,
  };
}

// ---------- invalidaciones ----------

async function invalidarPrueba(
  db: SupabaseClient,
  fiscal: Emisor & { ambiente: string; cod_estable_mh: string; cod_punto_venta_mh: string },
  dte: Record<string, string>,
) {
  const { data: fila, error } = await db.from('dte_invalidaciones').insert({
    dte_document_id: dte.id,
    tipo_anulacion: TIPO_ANULACION.RESCINDIR_OPERACION,
    motivo: 'Documento de prueba del ambiente de certificacion',
  }).select().single();
  if (error) throw new Error('insert: ' + error.message);

  const { fecha, hora } = fechaHoraSv();
  // El responsable y el solicitante son el propio contribuyente: son pruebas,
  // no hay un cliente real pidiendo la anulación.
  const responsable = {
    nombre: fiscal.nombre,
    tipoDocumento: '36',
    numDocumento: fiscal.nit,
  };

  const evento = construirInvalidacion({
    ambiente: fiscal.ambiente,
    codigoGeneracion: fila.codigo_generacion,
    fecEmi: fecha,
    horEmi: hora,
    emisor: fiscal,
    documento: {
      tipoDte: dte.tipo_dte,
      codigoGeneracion: dte.codigo_generacion,
      selloRecibido: dte.sello_recibido,
      numeroControl: dte.numero_control,
      fecEmi: dte.fecha_emision,
    },
    tipoAnulacion: TIPO_ANULACION.RESCINDIR_OPERACION,
    motivoAnulacion: 'Documento de prueba del ambiente de certificacion',
    responsable,
    solicita: responsable,
  });

  const patch: Record<string, unknown> = {
    json_evento: evento,
    intentos: 1,
    updated_at: new Date().toISOString(),
  };

  const firmado = await firmar(evento, fiscal.nit);
  const rta = await transmitirInvalidacion(firmado, fiscal.ambiente);

  patch.json_respuesta = rta;
  if (rta.estado === 'PROCESADO' && rta.selloRecibido) {
    patch.estado = 'procesado';
    patch.sello_recibido = rta.selloRecibido;
    await db.from('dte_documents')
      .update({ estado: 'anulado', updated_at: new Date().toISOString() })
      .eq('id', dte.id);
  } else {
    patch.estado = rta.estado === 'RECHAZADO' ? 'rechazado' : 'contingencia';
    patch.ultimo_error = motivoRechazo(rta);
  }

  await db.from('dte_invalidaciones').update(patch).eq('id', fila.id);
  return {
    numero_control: dte.numero_control,
    estado: patch.estado as string,
    error: patch.ultimo_error as string | undefined,
  };
}

// ---------- handler ----------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return bad('Metodo no permitido', 405);

  // Sólo con el secreto compartido: esto consume correlativos fiscales reales
  // y no debe poder dispararlo cualquiera con el anon key.
  const secret = Deno.env.get('DTE_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return bad('No autorizado', 401);
  }

  let body: {
    facturas?: number; ccf?: number; invalidaciones?: number;
    receptor?: ReceptorPrueba;
  };
  try {
    body = await req.json();
  } catch {
    return bad('JSON invalido');
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: fiscal } = await db.from('fiscal_settings').select('*').maybeSingle();
  if (!fiscal) return bad('fiscal_settings sin configurar');

  // Cinturón de seguridad: esto NUNCA debe correr contra produccion. Consume
  // correlativos reales y emitiria facturas inexistentes con validez legal.
  if (fiscal.ambiente !== '00') {
    return bad(
      'La bateria de pruebas solo corre en ambiente 00. fiscal_settings esta en ' +
      fiscal.ambiente + ' (produccion).',
      409,
    );
  }

  try {
    if (body.invalidaciones) {
      const cuantas = Math.min(body.invalidaciones, TOPE);

      // Sólo documentos de PRUEBA (order_id null) ya sellados y sin invalidar.
      const { data: yaInvalidados } = await db
        .from('dte_invalidaciones').select('dte_document_id')
        .in('estado', ['pendiente', 'contingencia', 'procesado']);
      const excluir = new Set((yaInvalidados ?? []).map((i) => i.dte_document_id));

      const { data: candidatos } = await db
        .from('dte_documents').select('*')
        .is('order_id', null)
        .eq('estado', 'procesado')
        .not('sello_recibido', 'is', null)
        .order('created_at');

      const objetivo = (candidatos ?? []).filter((d) => !excluir.has(d.id)).slice(0, cuantas);
      if (objetivo.length === 0) {
        return bad('No hay documentos de prueba sellados disponibles para invalidar. Emiti facturas primero.');
      }

      const resultados = [];
      for (const dte of objetivo) {
        try {
          resultados.push(await invalidarPrueba(db, fiscal, dte));
        } catch (e) {
          resultados.push({ numero_control: dte.numero_control, estado: 'error', error: String(e) });
        }
      }
      return Response.json({
        pedidas: cuantas,
        procesadas: resultados.filter((r) => r.estado === 'procesado').length,
        resultados,
      }, { headers: CORS });
    }

    if (body.ccf) {
      const cuantos = Math.min(body.ccf, TOPE);
      const resultados = [];
      for (let i = 0; i < cuantos; i++) {
        try {
          resultados.push(await emitirCcfPrueba(db, fiscal, body.receptor ?? {}));
        } catch (e) {
          resultados.push({ numero_control: '-', estado: 'error', error: String(e) });
        }
      }
      const ok = resultados.filter((r) => r.estado === 'procesado').length;
      return Response.json({ pedidos: cuantos, procesados: ok, fallidos: cuantos - ok, resultados },
        { headers: CORS });
    }

    const cuantas = Math.min(body.facturas ?? 0, TOPE);
    if (cuantas < 1) return bad('Indica cuantas facturas, ccf o invalidaciones transmitir');

    const resultados = [];
    for (let i = 0; i < cuantas; i++) {
      try {
        resultados.push(await emitirFacturaPrueba(db, fiscal));
      } catch (e) {
        resultados.push({ numero_control: '-', estado: 'error', error: String(e) });
      }
    }

    const procesadas = resultados.filter((r) => r.estado === 'procesado').length;
    return Response.json({
      pedidas: cuantas,
      procesadas,
      fallidas: cuantas - procesadas,
      resultados,
    }, { headers: CORS });
  } catch (e) {
    console.error('dte-pruebas', e);
    return bad(e instanceof Error ? e.message : 'Error en la bateria de pruebas', 500);
  }
});
