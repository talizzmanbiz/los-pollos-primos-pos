-- ============================================================
-- Los Pollos Primos POS — 0002 functions + triggers
-- ============================================================

-- ---------- auth helper functions (used by RLS) ----------
create or replace function app.role() returns user_role
language sql stable security definer set search_path = public, pg_temp as $$
  select role from profiles where id = auth.uid() and active
$$;

create or replace function app.location_id() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select location_id from profiles where id = auth.uid() and active
$$;

create or replace function app.is_superadmin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'superadmin' and active)
$$;

-- core security boundary: superadmin sees everything, staff only their location
create or replace function app.at_location(loc uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select app.is_superadmin()
      or exists (select 1 from profiles where id = auth.uid() and active and location_id = loc)
$$;

create or replace function app.has_role(variadic roles user_role[]) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from profiles where id = auth.uid() and active and role = any(roles))
$$;

-- ---------- generic updated_at ----------
create or replace function app.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger orders_touch before update on orders
  for each row execute function app.touch_updated_at();

-- ---------- inventory primitive ----------
-- Single entry point for every stock change: upserts the level and logs a movement.
create or replace function app.apply_stock_delta(
  p_location uuid, p_item uuid, p_delta numeric,
  p_reason inventory_reason, p_ref_type text, p_ref_id uuid,
  p_actor uuid default null, p_notes text default null
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into inventory_levels (location_id, inventory_item_id, quantity)
  values (p_location, p_item, p_delta)
  on conflict (location_id, inventory_item_id)
  do update set quantity = inventory_levels.quantity + excluded.quantity, updated_at = now();

  insert into inventory_movements (location_id, inventory_item_id, delta, reason, ref_type, ref_id, created_by, notes)
  values (p_location, p_item, p_delta, p_reason, p_ref_type, p_ref_id, p_actor, p_notes);
end $$;

-- ---------- order numbers: PP-C-0001 / PP-M-0001, continuous per location ----------
create or replace function app.next_order_number(p_location uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_n integer;
  v_code text;
begin
  loop
    update order_counters set last_number = last_number + 1
      where location_id = p_location returning last_number into v_n;
    exit when found;
    insert into order_counters (location_id, last_number) values (p_location, 0)
      on conflict (location_id) do nothing;
  end loop;
  select code into v_code from locations where id = p_location;
  return 'PP-' || v_code || '-' || lpad(v_n::text, 4, '0');
end $$;

create or replace function app.orders_before_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_zone delivery_zones%rowtype;
  v_allows boolean;
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := app.next_order_number(new.location_id);
  end if;

  if new.order_type = 'delivery' then
    select allows_delivery into v_allows from locations where id = new.location_id;
    if not coalesce(v_allows, false) then
      raise exception 'Delivery no disponible en esta sucursal';
    end if;
    select * into v_zone from delivery_zones where id = new.delivery_zone_id;
    if v_zone.location_id is distinct from new.location_id or not v_zone.active then
      raise exception 'Zona de delivery inválida para esta sucursal';
    end if;
    if new.delivery_fee <> v_zone.fee then
      raise exception 'Tarifa de delivery incorrecta (esperada %.2f)', v_zone.fee;
    end if;
  end if;

  return new;
end $$;

create trigger orders_before_insert before insert on orders
  for each row execute function app.orders_before_insert();

-- ---------- order status audit trail ----------
create or replace function app.log_order_status() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into order_status_events (order_id, status, changed_by)
    values (new.id, new.status, auth.uid());
  end if;
  return new;
end $$;

create trigger orders_status_log after insert or update of status on orders
  for each row execute function app.log_order_status();

-- ---------- sale: stock decrement + FIFO production batch assignment ----------
-- Runs for every order item from every source (POS, online, WhatsApp).
-- Combos expand into their components; each component consumes stock per
-- product_stock_usage. Chicken quantities pull from the oldest production
-- batch with stock at the order's location (FIFO), recording exact
-- consumption per batch and stamping the primary batch on the item.
create or replace function app.consume_stock_for_item() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_order orders%rowtype;
  v_comp record;
  v_usage record;
  v_pollo_item uuid;
  v_chicken_qty numeric := 0;
  v_batch record;
  v_take numeric;
  v_first_batch uuid;
begin
  select * into v_order from orders where id = new.order_id;
  select id into v_pollo_item from inventory_items where code = 'pollo';

  for v_comp in
    select cc.component_product_id as product_id, cc.quantity * new.quantity as qty
      from combo_components cc where cc.combo_product_id = new.product_id
    union all
    select new.product_id, new.quantity::numeric
      where not exists (select 1 from combo_components where combo_product_id = new.product_id)
  loop
    for v_usage in
      select inventory_item_id, quantity from product_stock_usage where product_id = v_comp.product_id
    loop
      perform app.apply_stock_delta(
        v_order.location_id, v_usage.inventory_item_id,
        -(v_usage.quantity * v_comp.qty), 'sale', 'order_item', new.id, v_order.cashier_id);
      if v_usage.inventory_item_id = v_pollo_item then
        v_chicken_qty := v_chicken_qty + v_usage.quantity * v_comp.qty;
      end if;
    end loop;
  end loop;

  if v_chicken_qty > 0 then
    for v_batch in
      select pbs.id, pbs.production_batch_id, pbs.quantity_remaining
        from production_batch_stock pbs
        join production_batches pb on pb.id = pbs.production_batch_id
       where pbs.location_id = v_order.location_id and pbs.quantity_remaining > 0
       order by pb.roast_end_at asc nulls last, pb.created_at asc
       for update of pbs
    loop
      v_take := least(v_batch.quantity_remaining, v_chicken_qty);
      update production_batch_stock set quantity_remaining = quantity_remaining - v_take
       where id = v_batch.id;
      insert into order_item_batch_consumption (order_item_id, production_batch_id, quantity)
      values (new.id, v_batch.production_batch_id, v_take);
      if v_first_batch is null then
        v_first_batch := v_batch.production_batch_id;
      end if;
      v_chicken_qty := v_chicken_qty - v_take;
      exit when v_chicken_qty <= 0;
    end loop;
    -- if batches ran dry the sale still goes through; inventory level goes
    -- negative and the discrepancy surfaces in reports
    if new.production_batch_id is null and v_first_batch is not null then
      update order_items set production_batch_id = v_first_batch where id = new.id;
    end if;
  end if;

  return new;
end $$;

create trigger order_items_consume_stock after insert on order_items
  for each row execute function app.consume_stock_for_item();

-- ---------- cancellation: restock everything ----------
create or replace function app.restock_cancelled_order() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_mov record;
  v_cons record;
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    -- reverse every sale movement of this order's items
    for v_mov in
      select m.* from inventory_movements m
      join order_items oi on oi.id = m.ref_id
      where m.ref_type = 'order_item' and oi.order_id = new.id and m.reason = 'sale'
    loop
      perform app.apply_stock_delta(
        v_mov.location_id, v_mov.inventory_item_id, -v_mov.delta,
        'cancellation', 'order_item', v_mov.ref_id, auth.uid());
    end loop;
    -- return chicken to its production batches
    for v_cons in
      select c.* from order_item_batch_consumption c
      join order_items oi on oi.id = c.order_item_id
      where oi.order_id = new.id
    loop
      update production_batch_stock
         set quantity_remaining = quantity_remaining + v_cons.quantity
       where production_batch_id = v_cons.production_batch_id and location_id = new.location_id;
      delete from order_item_batch_consumption where id = v_cons.id;
    end loop;
  end if;
  return new;
end $$;

create trigger orders_restock_on_cancel after update of status on orders
  for each row execute function app.restock_cancelled_order();

-- ---------- purchase batches: fill computed fields ----------
create or replace function app.purchase_batch_defaults() returns trigger
language plpgsql as $$
begin
  if new.total_cost is null then
    new.total_cost := round(new.quantity_received * new.unit_cost, 2);
  end if;
  if new.quantity_remaining is null then
    new.quantity_remaining := new.quantity_received;
  end if;
  return new;
end $$;

create trigger purchase_batches_defaults before insert on purchase_batches
  for each row execute function app.purchase_batch_defaults();

-- ---------- close a production batch ----------
-- Consumes raw stock from purchase batches (FIFO by purchase_date unless
-- p_inputs provides a manual override: [{"purchase_batch_id": "...", "quantity": n}]),
-- registers sellable batch stock at the batch's location, and adds cooked
-- chicken to inventory.
create or replace function app.close_production_batch(
  p_batch uuid,
  p_quantity_produced numeric,
  p_quantity_wasted numeric default 0,
  p_raw_consumed numeric default null,
  p_inputs jsonb default null
) returns production_batches
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_batch production_batches%rowtype;
  v_pollo_item uuid;
  v_needed numeric;
  v_pb record;
  v_take numeric;
  v_input record;
begin
  select * into v_batch from production_batches where id = p_batch for update;
  if not found then raise exception 'Lote de producción no encontrado'; end if;
  if v_batch.status = 'closed' then raise exception 'El lote ya está cerrado'; end if;
  if not (app.is_superadmin() or (app.at_location(v_batch.location_id) and app.has_role('admin','cocina'))) then
    raise exception 'No autorizado';
  end if;

  select id into v_pollo_item from inventory_items where code = 'pollo';
  v_needed := coalesce(p_raw_consumed, p_quantity_produced + p_quantity_wasted);

  if p_inputs is not null then
    for v_input in
      select (e->>'purchase_batch_id')::uuid as pb_id, (e->>'quantity')::numeric as qty
      from jsonb_array_elements(p_inputs) e
    loop
      update purchase_batches set quantity_remaining = quantity_remaining - v_input.qty
       where id = v_input.pb_id and quantity_remaining >= v_input.qty;
      if not found then raise exception 'Lote de compra sin stock suficiente: %', v_input.pb_id; end if;
      insert into production_batch_inputs (production_batch_id, purchase_batch_id, quantity_consumed)
      values (p_batch, v_input.pb_id, v_input.qty);
    end loop;
  else
    for v_pb in
      select id, quantity_remaining from purchase_batches
       where location_id = v_batch.location_id and quantity_remaining > 0
       order by purchase_date asc, created_at asc
       for update
    loop
      exit when v_needed <= 0;
      v_take := least(v_pb.quantity_remaining, v_needed);
      update purchase_batches set quantity_remaining = quantity_remaining - v_take where id = v_pb.id;
      insert into production_batch_inputs (production_batch_id, purchase_batch_id, quantity_consumed)
      values (p_batch, v_pb.id, v_take);
      v_needed := v_needed - v_take;
    end loop;
    if v_needed > 0 then
      raise exception 'Stock de lotes de compra insuficiente (faltan % unidades)', v_needed;
    end if;
  end if;

  update production_batches
     set quantity_produced = p_quantity_produced,
         quantity_wasted = p_quantity_wasted,
         status = 'closed',
         roast_end_at = coalesce(roast_end_at, now())
   where id = p_batch
   returning * into v_batch;

  insert into production_batch_stock (production_batch_id, location_id, quantity_remaining)
  values (p_batch, v_batch.location_id, p_quantity_produced)
  on conflict (production_batch_id, location_id)
  do update set quantity_remaining = production_batch_stock.quantity_remaining + excluded.quantity_remaining;

  perform app.apply_stock_delta(
    v_batch.location_id, v_pollo_item, p_quantity_produced,
    'production', 'production_batch', p_batch, auth.uid());
  if p_quantity_wasted > 0 then
    insert into inventory_movements (location_id, inventory_item_id, delta, reason, ref_type, ref_id, created_by, notes)
    values (v_batch.location_id, v_pollo_item, 0, 'waste', 'production_batch', p_batch, auth.uid(),
            format('Merma de producción: %s unidades', p_quantity_wasted));
  end if;

  return v_batch;
end $$;

-- ---------- transfers: create (decrements origin) + receive (credits destination) ----------
-- p_items: [{"inventory_item_id": "...", "quantity": n}]
-- Chicken lines are auto-split across production batches FIFO so the
-- destination keeps full traceability.
create or replace function app.create_transfer(
  p_from uuid, p_to uuid, p_items jsonb, p_notes text default null
) returns transfers
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_transfer transfers%rowtype;
  v_item record;
  v_pollo_item uuid;
  v_qty numeric;
  v_batch record;
  v_take numeric;
  v_is_production boolean;
begin
  select is_production into v_is_production from locations where id = p_from;
  if not (app.is_superadmin() or (app.at_location(p_from) and app.has_role('admin'))) then
    raise exception 'No autorizado';
  end if;
  if not coalesce(v_is_production, false) then
    raise exception 'Las transferencias solo salen de la sucursal de producción';
  end if;

  select id into v_pollo_item from inventory_items where code = 'pollo';

  insert into transfers (from_location_id, to_location_id, notes, created_by)
  values (p_from, p_to, p_notes, auth.uid())
  returning * into v_transfer;

  for v_item in
    select (e->>'inventory_item_id')::uuid as item_id, (e->>'quantity')::numeric as qty
    from jsonb_array_elements(p_items) e
  loop
    if v_item.qty <= 0 then raise exception 'Cantidad inválida'; end if;

    if v_item.item_id = v_pollo_item then
      v_qty := v_item.qty;
      for v_batch in
        select pbs.id, pbs.production_batch_id, pbs.quantity_remaining
          from production_batch_stock pbs
          join production_batches pb on pb.id = pbs.production_batch_id
         where pbs.location_id = p_from and pbs.quantity_remaining > 0
         order by pb.roast_end_at asc nulls last, pb.created_at asc
         for update of pbs
      loop
        exit when v_qty <= 0;
        v_take := least(v_batch.quantity_remaining, v_qty);
        update production_batch_stock set quantity_remaining = quantity_remaining - v_take
         where id = v_batch.id;
        insert into transfer_items (transfer_id, inventory_item_id, quantity, production_batch_id)
        values (v_transfer.id, v_item.item_id, v_take, v_batch.production_batch_id);
        v_qty := v_qty - v_take;
      end loop;
      if v_qty > 0 then
        raise exception 'Stock de pollo insuficiente para transferir (faltan %)', v_qty;
      end if;
    else
      insert into transfer_items (transfer_id, inventory_item_id, quantity)
      values (v_transfer.id, v_item.item_id, v_item.qty);
    end if;

    perform app.apply_stock_delta(
      p_from, v_item.item_id, -v_item.qty, 'transfer_out', 'transfer', v_transfer.id, auth.uid());
  end loop;

  return v_transfer;
end $$;

create or replace function app.receive_transfer(p_transfer uuid) returns transfers
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_transfer transfers%rowtype;
  v_item record;
begin
  select * into v_transfer from transfers where id = p_transfer for update;
  if not found then raise exception 'Transferencia no encontrada'; end if;
  if v_transfer.status <> 'in_transit' then raise exception 'La transferencia no está en tránsito'; end if;
  if not (app.is_superadmin() or (app.at_location(v_transfer.to_location_id) and app.has_role('admin','cajero'))) then
    raise exception 'No autorizado';
  end if;

  for v_item in select * from transfer_items where transfer_id = p_transfer loop
    perform app.apply_stock_delta(
      v_transfer.to_location_id, v_item.inventory_item_id, v_item.quantity,
      'transfer_in', 'transfer', p_transfer, auth.uid());
    if v_item.production_batch_id is not null then
      insert into production_batch_stock (production_batch_id, location_id, quantity_remaining)
      values (v_item.production_batch_id, v_transfer.to_location_id, v_item.quantity)
      on conflict (production_batch_id, location_id)
      do update set quantity_remaining = production_batch_stock.quantity_remaining + excluded.quantity_remaining;
    end if;
  end loop;

  update transfers set status = 'received', received_by = auth.uid(), received_at = now()
   where id = p_transfer returning * into v_transfer;
  return v_transfer;
end $$;

-- ---------- manual inventory adjustment (admin) ----------
create or replace function app.adjust_inventory(
  p_location uuid, p_item uuid, p_new_quantity numeric, p_notes text
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_current numeric;
begin
  if not (app.is_superadmin() or (app.at_location(p_location) and app.has_role('admin'))) then
    raise exception 'No autorizado';
  end if;
  select quantity into v_current from inventory_levels
   where location_id = p_location and inventory_item_id = p_item for update;
  v_current := coalesce(v_current, 0);
  perform app.apply_stock_delta(
    p_location, p_item, p_new_quantity - v_current, 'adjustment', null, null, auth.uid(), p_notes);
end $$;

-- ---------- cash: auto-register cash sales into the open session ----------
create or replace function app.register_cash_sale() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_session uuid;
begin
  if new.payment_method = 'cash' and new.payment_status = 'paid'
     and (tg_op = 'INSERT' or old.payment_status <> 'paid') then
    select id into v_session from cash_sessions
     where location_id = new.location_id and status = 'open'
     order by opened_at desc limit 1;
    if v_session is not null then
      insert into cash_movements (session_id, amount, reason, ref_type, ref_id, created_by)
      values (v_session, new.total, 'venta ' || new.order_number, 'order', new.id, new.cashier_id);
    end if;
  end if;
  return new;
end $$;

create trigger orders_cash_sale after insert or update of payment_status on orders
  for each row execute function app.register_cash_sale();

-- ---------- cash session close ----------
create or replace function app.close_cash_session(
  p_session uuid, p_counted numeric, p_notes text default null
) returns cash_sessions
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_session cash_sessions%rowtype;
  v_expected numeric;
begin
  select * into v_session from cash_sessions where id = p_session for update;
  if not found then raise exception 'Sesión no encontrada'; end if;
  if v_session.status = 'closed' then raise exception 'La sesión ya está cerrada'; end if;
  if not (app.is_superadmin() or (app.at_location(v_session.location_id) and app.has_role('admin','cajero'))) then
    raise exception 'No autorizado';
  end if;

  select v_session.opening_amount + coalesce(sum(amount), 0) into v_expected
    from cash_movements where session_id = p_session;

  update cash_sessions
     set status = 'closed', closed_by = auth.uid(), closed_at = now(),
         expected_amount = v_expected, counted_amount = p_counted,
         notes = coalesce(p_notes, notes)
   where id = p_session returning * into v_session;
  return v_session;
end $$;

-- ---------- grants ----------
grant usage on schema app to authenticated;
revoke all on all functions in schema app from public;
grant execute on function
  app.role(), app.location_id(), app.is_superadmin(), app.at_location(uuid),
  app.has_role(user_role[]),
  app.close_production_batch(uuid, numeric, numeric, numeric, jsonb),
  app.create_transfer(uuid, uuid, jsonb, text),
  app.receive_transfer(uuid),
  app.adjust_inventory(uuid, uuid, numeric, text),
  app.close_cash_session(uuid, numeric, text)
to authenticated;
