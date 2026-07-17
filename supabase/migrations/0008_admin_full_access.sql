-- ============================================================
-- Los Pollos Primos POS — 0008 admin full access
-- Owner decision: the 'admin' role has unrestricted access to
-- the whole app. Extend catalog/config writes (previously
-- superadmin-only) to admins, let admins read every profile and
-- manage staff. Admins still cannot modify or impersonate the
-- superadmin account.
-- ============================================================

alter policy products_superadmin_write on products
  using (app.is_superadmin() or app.has_role('admin'))
  with check (app.is_superadmin() or app.has_role('admin'));

alter policy inventory_items_superadmin_write on inventory_items
  using (app.is_superadmin() or app.has_role('admin'))
  with check (app.is_superadmin() or app.has_role('admin'));

alter policy combo_components_superadmin_write on combo_components
  using (app.is_superadmin() or app.has_role('admin'))
  with check (app.is_superadmin() or app.has_role('admin'));

alter policy product_stock_usage_superadmin_write on product_stock_usage
  using (app.is_superadmin() or app.has_role('admin'))
  with check (app.is_superadmin() or app.has_role('admin'));

alter policy delivery_zones_superadmin_write on delivery_zones
  using (app.is_superadmin() or app.has_role('admin'))
  with check (app.is_superadmin() or app.has_role('admin'));

-- admins see every profile (AdminPage staff list), any location
alter policy profiles_read on profiles
  using (
    id = auth.uid()
    or app.is_superadmin()
    or app.has_role('admin')
  );

-- admins can activate/deactivate staff, but never a superadmin row,
-- and never promote anyone to superadmin
create policy profiles_admin_manage on profiles
  for update to authenticated
  using (app.has_role('admin') and role <> 'superadmin')
  with check (role <> 'superadmin');
