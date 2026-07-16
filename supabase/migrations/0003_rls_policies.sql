-- ============================================================
-- Los Pollos Primos POS — 0003 Row Level Security
-- Boundary: location_id. Superadmin crosses locations; everyone
-- else only sees their own. Public (anon) can read the catalog
-- for the online storefront; guest orders are created via edge
-- functions (service role), never through anon policies.
-- ============================================================

alter table locations enable row level security;
alter table profiles enable row level security;
alter table inventory_items enable row level security;
alter table products enable row level security;
alter table combo_components enable row level security;
alter table product_stock_usage enable row level security;
alter table inventory_levels enable row level security;
alter table inventory_movements enable row level security;
alter table delivery_zones enable row level security;
alter table purchase_batches enable row level security;
alter table production_batches enable row level security;
alter table production_batch_inputs enable row level security;
alter table production_batch_stock enable row level security;
alter table order_counters enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_item_batch_consumption enable row level security;
alter table order_status_events enable row level security;
alter table transfers enable row level security;
alter table transfer_items enable row level security;
alter table cash_sessions enable row level security;
alter table cash_movements enable row level security;

-- ---------- locations ----------
create policy locations_public_read on locations
  for select to anon, authenticated using (active or app.is_superadmin());
create policy locations_superadmin_write on locations
  for all to authenticated using (app.is_superadmin()) with check (app.is_superadmin());

-- ---------- profiles ----------
create policy profiles_read on profiles
  for select to authenticated using (
    id = auth.uid()
    or app.is_superadmin()
    or (app.role() = 'admin' and location_id = app.location_id())
  );
create policy profiles_superadmin_write on profiles
  for all to authenticated using (app.is_superadmin()) with check (app.is_superadmin());

-- ---------- catalog (public read for storefront/WhatsApp menu) ----------
create policy inventory_items_read on inventory_items
  for select to anon, authenticated using (true);
create policy inventory_items_superadmin_write on inventory_items
  for all to authenticated using (app.is_superadmin()) with check (app.is_superadmin());

create policy products_public_read on products
  for select to anon, authenticated using (active or app.is_superadmin() or app.has_role('admin'));
create policy products_superadmin_write on products
  for all to authenticated using (app.is_superadmin()) with check (app.is_superadmin());

create policy combo_components_read on combo_components
  for select to anon, authenticated using (true);
create policy combo_components_superadmin_write on combo_components
  for all to authenticated using (app.is_superadmin()) with check (app.is_superadmin());

create policy product_stock_usage_read on product_stock_usage
  for select to authenticated using (true);
create policy product_stock_usage_superadmin_write on product_stock_usage
  for all to authenticated using (app.is_superadmin()) with check (app.is_superadmin());

create policy delivery_zones_public_read on delivery_zones
  for select to anon, authenticated using (active or app.is_superadmin());
create policy delivery_zones_superadmin_write on delivery_zones
  for all to authenticated using (app.is_superadmin()) with check (app.is_superadmin());

-- ---------- inventory (writes only via app.* security-definer functions) ----------
create policy inventory_levels_read on inventory_levels
  for select to authenticated using (app.at_location(location_id));

create policy inventory_movements_read on inventory_movements
  for select to authenticated using (app.at_location(location_id));

-- ---------- batches ----------
create policy purchase_batches_read on purchase_batches
  for select to authenticated using (app.at_location(location_id));
create policy purchase_batches_insert on purchase_batches
  for insert to authenticated
  with check (app.at_location(location_id) and (app.is_superadmin() or app.has_role('admin','cocina')));
create policy purchase_batches_update on purchase_batches
  for update to authenticated
  using (app.at_location(location_id) and (app.is_superadmin() or app.has_role('admin')));

create policy production_batches_read on production_batches
  for select to authenticated using (app.at_location(location_id));
create policy production_batches_insert on production_batches
  for insert to authenticated
  with check (app.at_location(location_id) and (app.is_superadmin() or app.has_role('admin','cocina')) and status = 'open');
create policy production_batches_update_open on production_batches
  for update to authenticated
  using (status = 'open' and app.at_location(location_id) and (app.is_superadmin() or app.has_role('admin','cocina')));

create policy production_batch_inputs_read on production_batch_inputs
  for select to authenticated using (
    exists (select 1 from production_batches pb
             where pb.id = production_batch_id and app.at_location(pb.location_id))
  );

create policy production_batch_stock_read on production_batch_stock
  for select to authenticated using (app.at_location(location_id));

-- order_counters: RLS enabled with no policies — only app.next_order_number touches it

-- ---------- orders ----------
create policy orders_read on orders
  for select to authenticated using (app.at_location(location_id));
create policy orders_insert_pos on orders
  for insert to authenticated
  with check (app.at_location(location_id) and app.has_role('admin','cajero') and source = 'pos');
create policy orders_update_staff on orders
  for update to authenticated
  using (app.at_location(location_id) and (app.is_superadmin() or app.has_role('admin','cajero','cocina','repartidor')));

create policy order_items_read on order_items
  for select to authenticated using (
    exists (select 1 from orders o where o.id = order_id and app.at_location(o.location_id))
  );
create policy order_items_insert on order_items
  for insert to authenticated
  with check (
    exists (select 1 from orders o where o.id = order_id and app.at_location(o.location_id))
    and app.has_role('admin','cajero')
  );

create policy order_item_batch_consumption_read on order_item_batch_consumption
  for select to authenticated using (
    exists (select 1 from order_items oi join orders o on o.id = oi.order_id
             where oi.id = order_item_id and app.at_location(o.location_id))
  );

create policy order_status_events_read on order_status_events
  for select to authenticated using (
    exists (select 1 from orders o where o.id = order_id and app.at_location(o.location_id))
  );

-- ---------- transfers (created/received via app.* functions) ----------
create policy transfers_read on transfers
  for select to authenticated
  using (app.at_location(from_location_id) or app.at_location(to_location_id));
create policy transfers_superadmin_update on transfers
  for update to authenticated using (app.is_superadmin());

create policy transfer_items_read on transfer_items
  for select to authenticated using (
    exists (select 1 from transfers t where t.id = transfer_id
             and (app.at_location(t.from_location_id) or app.at_location(t.to_location_id)))
  );

-- ---------- cash register ----------
create policy cash_sessions_read on cash_sessions
  for select to authenticated using (app.at_location(location_id));
create policy cash_sessions_open on cash_sessions
  for insert to authenticated
  with check (app.at_location(location_id) and app.has_role('admin','cajero')
              and status = 'open' and opened_by = auth.uid());

create policy cash_movements_read on cash_movements
  for select to authenticated using (
    exists (select 1 from cash_sessions s where s.id = session_id and app.at_location(s.location_id))
  );
create policy cash_movements_insert on cash_movements
  for insert to authenticated
  with check (
    app.has_role('admin','cajero')
    and exists (select 1 from cash_sessions s where s.id = session_id
                 and s.status = 'open' and app.at_location(s.location_id))
  );
