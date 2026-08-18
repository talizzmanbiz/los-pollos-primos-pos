// Alta automática de compras a partir del DTE que los proveedores mandan a
// admin@los-pollosprimos.com.
//
// n8n escanea el buzón IMAP a diario, saca el adjunto .json del correo y lo
// manda acá tal cual. Acá se traduce al registro de compras del F-07.
//
// El `codigoGeneracion` del DTE es único ante Hacienda, así que sirve de llave
// de idempotencia: reprocesar el mismo correo diez veces no duplica la compra.
//
//   POST /import-purchase-dte
//   header: x-webhook-secret: <DTE_WEBHOOK_SECRET>
//   body:   { "dte": { …json del proveedor… } }   ó   { "dtes": [ … ] }
//
// Respuesta: { importados, duplicados, errores: [...] }
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const bad = (message: string, status = 400) =>
  Response.json({ error: message }, { status, headers: CORS });

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

interface DteProveedor {
  identificacion?: {
    fecEmi?: string;
    tipoDte?: string;
    numeroControl?: string;
    codigoGeneracion?: string;
  };
  emisor?: { nit?: string; nrc?: string; nombre?: string };
  resumen?: {
    totalGravada?: number;
    totalExenta?: number;
    totalNoSuj?: number;
    totalIva?: number;
    totalPagar?: number;
    montoTotalOperacion?: number;
    tributos?: { codigo?: string; valor?: number }[] | null;
  };
  selloRecibido?: string;
}

/** El IVA está en `resumen.tributos[20]` (CCF) o en `resumen.totalIva` (factura). */
function ivaDelDte(resumen: NonNullable<DteProveedor['resumen']>): number {
  const tributo = (resumen.tributos ?? []).find((t) => t?.codigo === '20');
  if (tributo?.valor != null) return r2(tributo.valor);
  return r2(resumen.totalIva ?? 0);
}

async function importar(db: SupabaseClient, dte: DteProveedor) {
  const id = dte.identificacion;
  const emisor = dte.emisor;
  const resumen = dte.resumen;
  if (!id?.codigoGeneracion || !id.fecEmi || !resumen) {
    throw new Error('El JSON no parece un DTE (falta identificación o resumen)');
  }

  const codigoGeneracion = id.codigoGeneracion.toUpperCase();
  const { data: yaExiste } = await db
    .from('accounting_transactions_expense')
    .select('id').eq('codigo_generacion', codigoGeneracion).maybeSingle();
  if (yaExiste) return 'duplicado' as const;

  const nit = emisor?.nit ?? emisor?.nrc ?? null;

  // Si el proveedor ya se conoce, hereda su clasificación de renta y su
  // categoría contable en vez de caer siempre en los valores por defecto.
  const { data: proveedor } = nit
    ? await db.from('accounting_suppliers').select('*').eq('nit', nit).maybeSingle()
    : { data: null };

  const gravado = r2(resumen.totalGravada ?? 0);
  const exento = r2((resumen.totalExenta ?? 0) + (resumen.totalNoSuj ?? 0));
  const iva = ivaDelDte(resumen);
  const total = r2(resumen.totalPagar ?? resumen.montoTotalOperacion ?? gravado + exento + iva);
  const tipoDte = id.tipoDte ?? '03';

  const { error } = await db.from('accounting_transactions_expense').insert({
    transaction_date: id.fecEmi.slice(0, 10),
    expense_type: proveedor?.expense_type ?? 'ingredientes',
    base_amount_usd: gravado,
    compras_exentas: exento,
    iva_rate: iva > 0 ? 0.13 : null,
    iva_amount_usd: iva,
    total_amount_usd: total,
    is_deductible: true,
    // Sólo el CCF (03) y la nota de crédito (05) dan crédito fiscal.
    iva_creditable: iva > 0 && (tipoDte === '03' || tipoDte === '05'),
    document_type: tipoDte === '03' ? 'ccf' : 'dte',
    clase_documento: '4',                      // documento tributario electrónico
    tipo_documento_mh: tipoDte,
    document_number: id.numeroControl ?? null,
    supplier_name: emisor?.nombre ?? null,
    supplier_nit: nit,
    renta_tipo_operacion: '1',
    renta_clasificacion: proveedor?.renta_clasificacion ?? '1',
    renta_sector: proveedor?.renta_sector ?? '2',
    renta_tipo_costo_gasto: proveedor?.renta_tipo_costo_gasto ?? '5',
    codigo_generacion: codigoGeneracion,
    sello_recibido: dte.selloRecibido ?? null,
    source: 'email',
    raw_dte: dte,
  });
  if (error) {
    // La carrera entre dos escaneos simultáneos la corta el índice único.
    if (error.code === '23505') return 'duplicado' as const;
    throw new Error(error.message);
  }

  // Alta silenciosa del proveedor para que el autocompletado lo tenga la
  // próxima vez y el contador sólo tenga que revisar los códigos una vez.
  if (nit && emisor?.nombre && !proveedor) {
    await db.from('accounting_suppliers')
      .insert({ nit, name: emisor.nombre }).select().maybeSingle();
  }
  return 'importado' as const;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return bad('Método no permitido', 405);

  const secret = Deno.env.get('DTE_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return bad('No autorizado', 401);
  }

  let body: { dte?: DteProveedor; dtes?: DteProveedor[] };
  try {
    body = await req.json();
  } catch {
    return bad('JSON inválido');
  }

  const lista = body.dtes ?? (body.dte ? [body.dte] : []);
  if (lista.length === 0) return bad('Sin documentos que importar');

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let importados = 0;
  let duplicados = 0;
  const errores: string[] = [];

  for (const dte of lista) {
    try {
      const r = await importar(db, dte);
      if (r === 'importado') importados++;
      else duplicados++;
    } catch (e) {
      // Un documento raro no debe tumbar el lote completo del día.
      const ref = dte?.identificacion?.numeroControl ?? 'sin número de control';
      errores.push(`${ref}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return Response.json({ importados, duplicados, errores }, { headers: CORS });
});
