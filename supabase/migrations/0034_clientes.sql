-- ============================================================
-- Los Pollos Primos — 0034 Registro de clientes
--
-- Resuelve dos cosas que resultaron ser la misma:
--
--   · Crédito fiscal. El CCF exige del receptor NIT, NRC, actividad económica
--     y dirección fiscal completa. Nadie va a teclear eso con gente esperando
--     en el mostrador, y hoy ni siquiera se podía: emit-dte valida
--     `customer_activity_code`, una columna que nunca existió, así que TODA
--     venta con NIT fallaba.
--
--   · Clientes frecuentes. Se querían los datos guardados para que el cajero
--     solo teclee el teléfono y GHL lleve el historial por cliente.
--
-- Un cliente se captura una vez y se reconoce después por teléfono (mostrador)
-- o por NIT (contribuyente). Las llaves son columnas generadas y no lo que
-- tecleó el cajero: "7777-8888", "+503 7777 8888" y "77778888" son el mismo
-- cliente, y si la llave dependiera del formato se crearía un duplicado en
-- cada venta.
-- ============================================================

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),

  -- Contacto
  phone       text,
  name        text,
  email       text,

  -- Datos fiscales. Sólo hacen falta para emitir crédito fiscal; un
  -- consumidor final vive perfectamente con teléfono y nombre.
  nit             text,
  nrc             text,
  cod_actividad   text,   -- CAT-019
  desc_actividad  text,
  departamento    text,   -- CAT-012
  municipio       text,   -- CAT-013
  distrito        text,
  complemento     text,   -- dirección escrita

  -- Los números de El Salvador son de 8 dígitos; se guardan los últimos 8 para
  -- que el prefijo +503 no parta al mismo cliente en dos.
  phone_key text generated always as (
    nullif(right(regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'), 8), '')
  ) stored,
  nit_key text generated always as (
    nullif(regexp_replace(coalesce(nit, ''), '[^0-9]', '', 'g'), '')
  ) stored,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique normal y no parcial: en Postgres los NULL son distintos entre sí, así
-- que ya admite miles de clientes sin teléfono o sin NIT. Con `where ... is not
-- null` el índice deja de servirle a ON CONFLICT — PostgREST no puede repetir
-- esa condición y el upsert del panel de caja falla.
alter table customers drop constraint if exists customers_phone_key_uidx;
alter table customers drop constraint if exists customers_nit_key_uidx;
alter table customers add constraint customers_phone_key_uidx unique (phone_key);
alter table customers add constraint customers_nit_key_uidx   unique (nit_key);

comment on table customers is
  'Clientes reconocidos por telefono (mostrador) o NIT (credito fiscal). '
  'Se llena solo desde cada venta; no hay que mantenerlo a mano.';

-- Un CCF sin estos cuatro campos lo rechaza el MH. Tenerlo como check evita
-- guardar un cliente a medias que despues falla al facturar, cuando el cliente
-- ya se fue.
alter table customers drop constraint if exists customers_fiscal_completo;
alter table customers add constraint customers_fiscal_completo check (
  nit is null or (
    nullif(btrim(coalesce(nrc, '')), '')            is not null and
    nullif(btrim(coalesce(cod_actividad, '')), '')  is not null and
    nullif(btrim(coalesce(desc_actividad, '')), '') is not null and
    nullif(btrim(coalesce(departamento, '')), '')   is not null and
    nullif(btrim(coalesce(municipio, '')), '')      is not null and
    nullif(btrim(coalesce(distrito, '')), '')       is not null and
    nullif(btrim(coalesce(complemento, '')), '')    is not null
  )
);

alter table orders add column if not exists customer_id uuid references customers(id);
create index if not exists orders_customer_id_idx on orders (customer_id);

comment on column orders.customer_id is
  'Cliente del registro. Los campos customer_* de la orden siguen siendo la '
  'foto del momento de la venta: el recibo no debe cambiar si el cliente '
  'corrige su nombre despues.';

-- ---------- alta y actualización automática ----------

create or replace function app.registrar_cliente()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_tel  text := nullif(right(regexp_replace(coalesce(new.customer_phone, ''), '[^0-9]', '', 'g'), 8), '');
  v_nit  text := nullif(regexp_replace(coalesce(new.customer_nit, ''), '[^0-9]', '', 'g'), '');
  v_id   uuid;
begin
  if new.customer_id is not null then return new; end if;
  -- Sin telefono ni NIT no hay a quien reconocer despues: es una venta
  -- anonima de mostrador y esta bien que lo sea.
  if v_tel is null and v_nit is null then return new; end if;

  -- El NIT manda: identifica a un contribuyente concreto, mientras que un
  -- telefono puede ser el del que vino a recoger.
  if v_nit is not null then
    select id into v_id from customers where nit_key = v_nit;
  end if;
  if v_id is null and v_tel is not null then
    select id into v_id from customers where phone_key = v_tel;
  end if;

  if v_id is null then
    -- Deliberadamente NO se copia el NIT. Guardarlo obligaria al resto de los
    -- datos fiscales por el check, y este trigger no los tiene: reventaria la
    -- venta en la caja. Un cliente con credito fiscal lo registra el POS antes
    -- de crear la orden, y entonces ya viene con customer_id.
    insert into customers (phone, name, email)
    values (new.customer_phone, new.customer_name, new.customer_email)
    returning id into v_id;
  else
    -- Nunca se pisa un dato bueno con un nulo: el cajero que solo teclea el
    -- telefono no debe borrar el correo que se capturo la vez pasada.
    update customers set
      phone      = coalesce(nullif(btrim(new.customer_phone), ''), phone),
      name       = coalesce(nullif(btrim(new.customer_name),  ''), name),
      email      = coalesce(nullif(btrim(new.customer_email), ''), email),
      updated_at = now()
    where id = v_id;
  end if;

  new.customer_id := v_id;
  return new;
end $$;

drop trigger if exists orders_registrar_cliente on orders;
create trigger orders_registrar_cliente
  before insert on orders
  for each row execute function app.registrar_cliente();

-- ---------- acceso ----------

alter table customers enable row level security;

drop policy if exists customers_lectura on customers;
create policy customers_lectura on customers
  for select to authenticated using (true);

drop policy if exists customers_escritura on customers;
create policy customers_escritura on customers
  for insert to authenticated with check (
    app.is_superadmin() or app.has_role('admin', 'cajero')
  );

drop policy if exists customers_actualizacion on customers;
create policy customers_actualizacion on customers
  for update to authenticated using (
    app.is_superadmin() or app.has_role('admin', 'cajero')
  );
