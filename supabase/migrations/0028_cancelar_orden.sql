-- ============================================================
-- Los Pollos Primos — 0028 Cancelación de órdenes desde cocina
--
-- Cocina necesita cancelar un pedido que ya no se va a preparar (se acabó el
-- producto, el cliente se fue, se digitó mal). Cancelar toca cuatro cosas:
--
--   1. inventario  → ya lo resuelve el trigger orders_restock_on_cancel
--   2. efectivo    → si se cobró en efectivo hay que sacarlo de la sesión o el
--                    arqueo del turno no cuadra
--   3. tarjeta     → Wompi NO expone reembolso por API (su documentación sólo
--                    cubre EnlacePago, TransaccionCompra, 3DS y webhooks). La
--                    anulación se hace desde el panel de Wompi, a mano.
--   4. contabilidad→ accounting_sync_from_pos ya excluye las canceladas
--
-- Por (3) la orden con tarjeta queda cancelada pero con payment_status='paid'
-- hasta que alguien haga el reembolso en Wompi y lo confirme. Ese conjunto
-- —cancelada + pagada— ES la cola de reembolsos pendientes; no hace falta un
-- estado nuevo ni una tabla aparte.
--
-- Separación de poderes a propósito: cocina puede cancelar, pero NO puede
-- declarar que el dinero volvió. Marcar el reembolso es de cajero/admin.
-- ============================================================

alter table orders add column if not exists cancellation_reason text;

-- ---------- cancelar ----------
create or replace function app.cancel_order(p_order uuid, p_reason text)
returns orders
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_o orders%rowtype;
  v_session uuid;
begin
  select * into v_o from orders where id = p_order for update;
  if not found then raise exception 'Orden no encontrada'; end if;

  if not (app.is_superadmin()
          or (app.at_location(v_o.location_id)
              and app.has_role('admin','cajero','cocina'))) then
    raise exception 'No autorizado';
  end if;

  -- Idempotente: dos cocineros tocando el mismo ticket no duplican el reverso.
  if v_o.status = 'cancelled' then return v_o; end if;

  -- Un pedido entregado ya salió por la puerta. Devolverlo es una operación de
  -- caja con producto en mano, no un botón de cocina.
  if v_o.status = 'completed' then
    raise exception 'La orden ya se entregó; gestioná la devolución desde Caja';
  end if;

  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'Se requiere un motivo de cancelación';
  end if;

  -- El restock de insumos y de lotes de producción lo dispara
  -- orders_restock_on_cancel al ver el cambio de estado.
  update orders
     set status = 'cancelled', cancellation_reason = btrim(p_reason)
   where id = p_order
  returning * into v_o;

  -- Efectivo ya cobrado: se devuelve del cajón, así que sale de la sesión.
  -- Si no hay sesión abierta no se inventa el movimiento: la orden queda
  -- 'paid' y aparece en la cola de reembolsos para que alguien la resuelva.
  if v_o.payment_method = 'cash' and v_o.payment_status = 'paid' then
    select id into v_session from cash_sessions
     where location_id = v_o.location_id and status = 'open'
     order by opened_at desc limit 1;

    if v_session is not null then
      insert into cash_movements (session_id, amount, reason, ref_type, ref_id, created_by)
      values (v_session, -v_o.total,
              'cancelación ' || v_o.order_number, 'order', v_o.id, auth.uid());

      update orders set payment_status = 'refunded' where id = p_order
      returning * into v_o;
    end if;
  end if;

  return v_o;
end $$;

-- ---------- confirmar que el dinero volvió ----------
-- Se llama DESPUÉS de anular en el panel de Wompi. No mueve plata: sólo deja
-- constancia de que ya se devolvió, para que salga de la cola de pendientes.
create or replace function app.mark_order_refunded(p_order uuid)
returns orders
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_o orders%rowtype;
begin
  select * into v_o from orders where id = p_order for update;
  if not found then raise exception 'Orden no encontrada'; end if;

  -- Cocina queda fuera: confirmar un reembolso es responsabilidad de caja.
  if not (app.is_superadmin()
          or (app.at_location(v_o.location_id) and app.has_role('admin','cajero'))) then
    raise exception 'No autorizado';
  end if;

  if v_o.status <> 'cancelled' then
    raise exception 'Sólo se reembolsan órdenes canceladas';
  end if;

  update orders set payment_status = 'refunded' where id = p_order
  returning * into v_o;
  return v_o;
end $$;

-- ---------- wrappers públicos para PostgREST ----------
create or replace function public.cancel_order(p_order uuid, p_reason text)
returns orders
language sql
set search_path to 'public', 'app', 'pg_temp'
as $$ select app.cancel_order(p_order, p_reason) $$;

revoke all on function public.cancel_order(uuid, text) from public;
grant execute on function public.cancel_order(uuid, text) to authenticated;

create or replace function public.mark_order_refunded(p_order uuid)
returns orders
language sql
set search_path to 'public', 'app', 'pg_temp'
as $$ select app.mark_order_refunded(p_order) $$;

revoke all on function public.mark_order_refunded(uuid) from public;
grant execute on function public.mark_order_refunded(uuid) to authenticated;
