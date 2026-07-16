-- ============================================================
-- Los Pollos Primos POS — 0004 seed data
-- Locations, inventory items, catalog, combos, delivery zones.
-- (Superadmin auth user is created by the bootstrap edge
-- function, not by SQL — GoTrue owns auth.users.)
-- ============================================================

-- ---------- locations ----------
insert into locations (id, code, name, is_production, allows_delivery) values
  ('11111111-1111-1111-1111-111111111111', 'C', 'Sucursal Central', true, true),
  ('22222222-2222-2222-2222-222222222222', 'M', 'Mercado Chalchuapa', false, false);

insert into order_counters (location_id, last_number) values
  ('11111111-1111-1111-1111-111111111111', 0),
  ('22222222-2222-2222-2222-222222222222', 0);

-- ---------- inventory items ----------
-- 'pollo' is counted in whole-chicken equivalents (entero 1.0 / medio 0.5 / cuarto 0.25)
insert into inventory_items (id, code, name, unit) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'pollo',       'Pollo (equivalente entero)', 'pollo'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'chimichurri', 'Chimichurri',                'porción 30ml'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'tortilla',    'Tortilla',                   'unidad'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'cebolla',     'Cebolla',                    'unidad');

-- ---------- products: solo el pollo ----------
insert into products (id, sku, name, product_type, price, sort_order) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'POLLO-ENT', 'Pollo entero',    'chicken', 11.00, 10),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'POLLO-MED', 'Medio pollo',     'chicken',  6.00, 11),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'POLLO-CTO', 'Cuarto de pollo', 'chicken',  3.50, 12);

-- ---------- products: extras ----------
insert into products (id, sku, name, product_type, price, sort_order) values
  ('bbbbbbbb-0000-0000-0000-000000000011', 'CHIMI-30', 'Chimichurri (30ml)', 'extra', 0.75, 20),
  ('bbbbbbbb-0000-0000-0000-000000000012', 'TORT-2',   'Tortillas ×2',       'extra', 0.50, 21),
  ('bbbbbbbb-0000-0000-0000-000000000013', 'TORT-4',   'Tortillas ×4',       'extra', 0.75, 22),
  ('bbbbbbbb-0000-0000-0000-000000000014', 'TORT-8',   'Tortillas ×8',       'extra', 1.00, 23),
  ('bbbbbbbb-0000-0000-0000-000000000015', 'CEB-ENT',  'Cebolla entera',     'extra', 0.75, 24),
  ('bbbbbbbb-0000-0000-0000-000000000016', 'CEB-MED',  'Media cebolla',      'extra', 0.40, 25);

-- ---------- products: combos (brand name primary, internal label secondary) ----------
insert into products (id, sku, name, secondary_name, product_type, price, cost_price, sort_order) values
  ('bbbbbbbb-0000-0000-0000-000000000021', 'COMBO-ENT', 'El Primo Grande', 'Combo Entero', 'combo', 12.95, 4.18, 1),
  ('bbbbbbbb-0000-0000-0000-000000000022', 'COMBO-MED', 'El Primo',        'Combo Medio',  'combo',  6.95, 2.14, 2),
  ('bbbbbbbb-0000-0000-0000-000000000023', 'COMBO-CTO', 'El Primito',      'Combo Cuarto', 'combo',  3.95, 1.15, 3);

-- ---------- combo components (drive kitchen tickets + inventory decrement) ----------
-- El Primo Grande: pollo entero + chimichurri 30ml + 8 tortillas + cebolla entera
insert into combo_components (combo_product_id, component_product_id, quantity) values
  ('bbbbbbbb-0000-0000-0000-000000000021', 'bbbbbbbb-0000-0000-0000-000000000001', 1),
  ('bbbbbbbb-0000-0000-0000-000000000021', 'bbbbbbbb-0000-0000-0000-000000000011', 1),
  ('bbbbbbbb-0000-0000-0000-000000000021', 'bbbbbbbb-0000-0000-0000-000000000014', 1),
  ('bbbbbbbb-0000-0000-0000-000000000021', 'bbbbbbbb-0000-0000-0000-000000000015', 1);
-- El Primo: medio pollo + chimichurri 30ml + 4 tortillas + media cebolla
insert into combo_components (combo_product_id, component_product_id, quantity) values
  ('bbbbbbbb-0000-0000-0000-000000000022', 'bbbbbbbb-0000-0000-0000-000000000002', 1),
  ('bbbbbbbb-0000-0000-0000-000000000022', 'bbbbbbbb-0000-0000-0000-000000000011', 1),
  ('bbbbbbbb-0000-0000-0000-000000000022', 'bbbbbbbb-0000-0000-0000-000000000013', 1),
  ('bbbbbbbb-0000-0000-0000-000000000022', 'bbbbbbbb-0000-0000-0000-000000000016', 1);
-- El Primito: cuarto de pollo + chimichurri 30ml + 2 tortillas + media cebolla
insert into combo_components (combo_product_id, component_product_id, quantity) values
  ('bbbbbbbb-0000-0000-0000-000000000023', 'bbbbbbbb-0000-0000-0000-000000000003', 1),
  ('bbbbbbbb-0000-0000-0000-000000000023', 'bbbbbbbb-0000-0000-0000-000000000011', 1),
  ('bbbbbbbb-0000-0000-0000-000000000023', 'bbbbbbbb-0000-0000-0000-000000000012', 1),
  ('bbbbbbbb-0000-0000-0000-000000000023', 'bbbbbbbb-0000-0000-0000-000000000016', 1);

-- ---------- stock usage (how each non-combo product consumes inventory) ----------
insert into product_stock_usage (product_id, inventory_item_id, quantity) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 1.0),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 0.5),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 0.25),
  ('bbbbbbbb-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000002', 1),
  ('bbbbbbbb-0000-0000-0000-000000000012', 'aaaaaaaa-0000-0000-0000-000000000003', 2),
  ('bbbbbbbb-0000-0000-0000-000000000013', 'aaaaaaaa-0000-0000-0000-000000000003', 4),
  ('bbbbbbbb-0000-0000-0000-000000000014', 'aaaaaaaa-0000-0000-0000-000000000003', 8),
  ('bbbbbbbb-0000-0000-0000-000000000015', 'aaaaaaaa-0000-0000-0000-000000000004', 1),
  ('bbbbbbbb-0000-0000-0000-000000000016', 'aaaaaaaa-0000-0000-0000-000000000004', 0.5);

-- ---------- delivery zones (Central only) ----------
insert into delivery_zones (id, location_id, name, fee) values
  ('cccccccc-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Zona 1', 1.00),
  ('cccccccc-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Zona 2', 1.50);
