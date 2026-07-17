-- ============================================================
-- Los Pollos Primos POS — 0007 superadmin POS writes
-- Superadmin (role 'superadmin') was excluded from POS write
-- policies because app.has_role('admin','cajero') matches the
-- role column exactly. Add the is_superadmin() escape hatch so
-- the owner account can ring sales, open cash sessions and
-- register movements at any location.
-- ============================================================

alter policy orders_insert_pos on orders
  with check (
    app.at_location(location_id)
    and (app.is_superadmin() or app.has_role('admin','cajero'))
    and source = 'pos'
  );

alter policy order_items_insert on order_items
  with check (
    exists (select 1 from orders o where o.id = order_id and app.at_location(o.location_id))
    and (app.is_superadmin() or app.has_role('admin','cajero'))
  );

alter policy cash_sessions_open on cash_sessions
  with check (
    app.at_location(location_id)
    and (app.is_superadmin() or app.has_role('admin','cajero'))
    and status = 'open' and opened_by = auth.uid()
  );

alter policy cash_movements_insert on cash_movements
  with check (
    (app.is_superadmin() or app.has_role('admin','cajero'))
    and exists (select 1 from cash_sessions s where s.id = session_id
                 and s.status = 'open' and app.at_location(s.location_id))
  );
