// Superadmin/admin: creates a staff auth user + profile in one step.
// Returns the generated password once — the owner hands it to the employee,
// who should change it on first login. Nobody can create a superadmin here.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ROLES = ['admin', 'cajero', 'cocina', 'repartidor', 'contador', 'auditor'] as const;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') {
    return Response.json({ error: 'Método no permitido' }, { status: 405, headers: CORS });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // caller must be an active superadmin or admin
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: caller } = await admin.auth.getUser(jwt);
  if (!caller?.user) {
    return Response.json({ error: 'No autorizado' }, { status: 401, headers: CORS });
  }
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role, active')
    .eq('id', caller.user.id)
    .maybeSingle();
  const canCreate =
    callerProfile?.active &&
    (callerProfile.role === 'superadmin' || callerProfile.role === 'admin');
  if (!canCreate) {
    return Response.json(
      { error: 'Solo superadmin o admin pueden crear usuarios' },
      { status: 403, headers: CORS },
    );
  }

  let body: { email?: string; full_name?: string; role?: string; location_id?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400, headers: CORS });
  }

  const email = body.email?.trim().toLowerCase();
  const fullName = body.full_name?.trim();
  const role = body.role as (typeof ROLES)[number];
  if (!email || !fullName || !ROLES.includes(role) || !body.location_id) {
    return Response.json(
      { error: 'Faltan datos: email, full_name, role (admin|cajero|cocina|repartidor|contador|auditor), location_id' },
      { status: 400, headers: CORS },
    );
  }

  const password = crypto.randomUUID().replace(/-/g, '').slice(0, 16) + '!Pp1';
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created?.user) {
    return Response.json({ error: createError?.message ?? 'createUser falló' }, { status: 500, headers: CORS });
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: created.user.id,
    full_name: fullName,
    role,
    location_id: body.location_id,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return Response.json({ error: profileError.message }, { status: 500, headers: CORS });
  }

  return Response.json({ email, password, role, full_name: fullName }, { headers: CORS });
});
