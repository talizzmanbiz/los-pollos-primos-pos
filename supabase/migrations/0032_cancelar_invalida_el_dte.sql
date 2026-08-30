-- ============================================================
-- Los Pollos Primos — 0032 Cancelar una orden invalida su DTE
--
-- Hueco fiscal: cocina podía cancelar un pedido cuyo DTE ya estaba sellado por
-- el MH, y el documento seguía vigente ante Hacienda. Quedaba una venta
-- documentada que no ocurrió — exactamente lo que la invalidación existe para
-- corregir.
--
-- No se transmite en el momento a propósito. Si el firmador o el MH están
-- caídos, el cajero se quedaría esperando por algo que no es su problema. Se
-- encola en estado 'pendiente' y `emit-dte` con {"procesar_pendientes": N} la
-- transmite después, igual que hace con los DTE en contingencia.
--
-- tipo_anulacion 2 = rescindir la operación: la venta no ocurrió. No es el 1
-- (error en la información), que exige informar el documento que reemplaza al
-- invalidado y aquí no hay ninguno.
-- ============================================================

create or replace function app.cancel_order(p_order uuid, p_reason text)
returns orders
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_o orders%rowtype;
  v_session uuid;
  v_dte dte_documents%rowtype;
begin
  select * into v_o from orders where id = p_order for update;
  if not found then raise exception 'Orden no encontrada'; end if;

  if not (app.is_superadmin()
          or (app.at_location(v_o.location_id)
              and app.has_role('admin','cajero','cocina'))) then
    raise exception 'No autorizado';
  end if;

  if v_o.status = 'cancelled' then return v_o; end if;

  if v_o.status = 'completed' then
    raise exception 'La orden ya se entrego; gestiona la devolucion desde Caja';
  end if;

  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'Se requiere un motivo de cancelacion';
  end if;

  update orders
     set status = 'cancelled', cancellation_reason = btrim(p_reason)
   where id = p_order
  returning * into v_o;

  -- Efectivo ya cobrado: se devuelve del cajon, asi que sale de la sesion.
  if v_o.payment_method = 'cash' and v_o.payment_status = 'paid' then
    select id into v_session from cash_sessions
     where location_id = v_o.location_id and status = 'open'
     order by opened_at desc limit 1;

    if v_session is not null then
      insert into cash_movements (session_id, amount, reason, ref_type, ref_id, created_by)
      values (v_session, -v_o.total,
              'cancelacion ' || v_o.order_number, 'order', v_o.id, auth.uid());

      update orders set payment_status = 'refunded' where id = p_order
      returning * into v_o;
    end if;
  end if;

  -- Si el MH ya sello un DTE por esta venta, hay que invalidarlo. Se encola;
  -- el indice parcial de dte_invalidaciones evita duplicar si ya habia una.
  select * into v_dte from dte_documents
   where order_id = p_order and estado = 'procesado' and sello_recibido is not null;

  if found then
    insert into dte_invalidaciones (dte_document_id, tipo_anulacion, motivo, created_by)
    values (v_dte.id, 2, 'Pedido cancelado: ' || btrim(p_reason), auth.uid())
    on conflict do nothing;
  end if;

  return v_o;
end $$;

comment on function app.cancel_order(uuid, text) is
  'Cancela una orden y revierte inventario (trigger), efectivo (sesion abierta) '
  'y el DTE (encola la invalidacion si el MH ya lo sello).';
