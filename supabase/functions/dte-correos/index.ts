// Los DTE sellados que faltan mandarle al cliente por correo.
//
// Existe para que n8n NO tenga que cargar el service role key. Con esa llave se
// lee y escribe cualquier tabla de la base; darla para que el cron lea una
// columna es regalar la casa por abrir una puerta. Acá sólo se puede hacer dos
// cosas, y ambas con el secreto compartido.
//
//   POST { "pendientes": 50 }        → los sellados sin enviar, con su adjunto
//   POST { "enviados": ["id", ...] } → marca los que ya salieron
//
// Va aparte de emit-dte a propósito: emit-dte firma y transmite documentos
// fiscales, y no se toca por algo que sólo manda correos.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, content-type, apikey, x-client-info, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const bad = (message: string, status = 400) =>
  Response.json({ error: message }, { status, headers: CORS });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return bad('Método no permitido', 405);

  const secret = Deno.env.get('DTE_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return bad('No autorizado', 401);
  }

  let body: { pendientes?: number; enviados?: string[] };
  try {
    body = await req.json();
  } catch {
    return bad('JSON inválido');
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Marcar como enviados. Va primero porque es la rama corta.
  if (body.enviados) {
    if (!Array.isArray(body.enviados) || body.enviados.length === 0) {
      return bad('enviados debe ser una lista de ids');
    }
    const { error } = await db
      .from('dte_documents')
      .update({ email_enviado_at: new Date().toISOString() })
      .in('id', body.enviados.slice(0, 200));
    if (error) return bad(error.message, 500);
    return Response.json({ marcados: body.enviados.length }, { headers: CORS });
  }

  // Sólo los que ya tienen sello: mandarle al cliente un documento sin sello es
  // mandarle algo que ante Hacienda todavía no existe.
  const limite = Math.min(Math.max(body.pendientes ?? 50, 1), 200);
  const { data, error } = await db
    .from('dte_documents')
    // En una sola cadena literal: partida en dos, el cliente no puede inferir
    // las columnas y todo lo de abajo queda sin tipos.
    .select('id, numero_control, codigo_generacion, sello_recibido, fecha_emision, total_pagar, receptor_nombre, receptor_correo, json_dte')
    .eq('estado', 'procesado')
    .not('sello_recibido', 'is', null)
    .not('receptor_correo', 'is', null)
    .is('email_enviado_at', null)
    .order('created_at')
    .limit(limite);

  if (error) return bad(error.message, 500);

  // El adjunto se arma acá y no en n8n: el sello vive fuera del JSON firmado y
  // hay que pegarlo, y ese detalle no debe repetirse en cada consumidor.
  const documentos = (data ?? []).map((d) => ({
    id: d.id,
    numero_control: d.numero_control,
    codigo_generacion: d.codigo_generacion,
    sello_recibido: d.sello_recibido,
    fecha_emision: d.fecha_emision,
    total_pagar: d.total_pagar,
    receptor_nombre: d.receptor_nombre ?? 'Cliente',
    receptor_correo: d.receptor_correo,
    archivo: `${d.codigo_generacion}.json`,
    contenido: JSON.stringify(
      { ...(d.json_dte as Record<string, unknown>), selloRecibido: d.sello_recibido },
      null,
      2,
    ),
  }));

  return Response.json({ total: documentos.length, documentos }, { headers: CORS });
});
