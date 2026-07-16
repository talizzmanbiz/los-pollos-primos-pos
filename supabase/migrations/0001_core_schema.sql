-- ============================================================
-- Los Pollos Primos POS — 0001 core schema
-- Locations, roles, catalog, inventory, orders, batches,
-- transfers, cash register.
-- Stock model: chicken tracked in whole-chicken equivalents
-- (entero = 1.0, medio = 0.5, cuarto = 0.25).
-- ============================================================

-- ---------- enums ----------
create type user_role as enum ('superadmin','admin','cajero','cocina','repartidor');
create type product_type as enum ('combo','chicken','extra','beverage');
create type order_source as enum ('pos','online','whatsapp');
create type order_type as enum ('walk_in','pickup','delivery');
create type order_status as enum ('received','in_progress','ready','out_for_delivery','completed','cancelled');
create type payment_method as enum ('cash','payment_link');
create type payment_status as enum ('pending','paid','refunded');
create type inventory_reason as enum ('sale','cancellation','production','purchase','transfer_out','transfer_in','adjustment','waste','initial');
create type transfer_status as enum ('in_transit','received','cancelled');
create type cash_session_status as enum ('open','closed');
create type batch_status as enum ('open','closed');
create type purchase_unit as enum ('unidades','libras');

-- private schema for helper/security-definer functions
create schema if not exists app;

-- ---------- locations ----------
create table locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z]{1,3}$'),
  name text not null,
  is_production boolean not null default false, -- kitchen/production hub (Central)
  allows_delivery boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- users / roles ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null,
  location_id uuid references locations(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  -- superadmin is cross-location; everyone else belongs to exactly one location
  constraint superadmin_no_location check (role <> 'superadmin' or location_id is null),
  constraint staff_needs_location check (role = 'superadmin' or location_id is not null)
);

-- ---------- inventory items (stock-keeping units) ----------
-- 'pollo' is measured in whole-chicken equivalents.
create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  unit text not null,
  created_at timestamptz not null default now()
);

-- ---------- product catalog ----------
create table products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,            -- brand name shown everywhere (POS, receipts, store, WhatsApp)
  secondary_name text,           -- internal/staff label (e.g. "Combo Entero")
  product_type product_type not null,
  price numeric(10,2) not null check (price >= 0),
  cost_price numeric(10,4),      -- margin % = (price - cost_price) / price, computed in reports
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- combos are fixed bundles: each sale decrements every component
create table combo_components (
  id uuid primary key default gen_random_uuid(),
  combo_product_id uuid not null references products(id) on delete cascade,
  component_product_id uuid not null references products(id),
  quantity numeric(8,3) not null check (quantity > 0),
  unique (combo_product_id, component_product_id),
  check (combo_product_id <> component_product_id)
);

-- how a (non-combo) product consumes stock when sold
create table product_stock_usage (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id),
  quantity numeric(10,3) not null check (quantity > 0),
  unique (product_id, inventory_item_id)
);

-- ---------- inventory ----------
create table inventory_levels (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id),
  inventory_item_id uuid not null references inventory_items(id),
  quantity numeric(12,3) not null default 0,
  updated_at timestamptz not null default now(),
  unique (location_id, inventory_item_id)
);

create table inventory_movements (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id),
  inventory_item_id uuid not null references inventory_items(id),
  delta numeric(12,3) not null,
  reason inventory_reason not null,
  ref_type text,                 -- 'order_item' | 'production_batch' | 'purchase_batch' | 'transfer' | ...
  ref_id uuid,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index inventory_movements_loc_item_idx on inventory_movements (location_id, inventory_item_id, created_at desc);
create index inventory_movements_ref_idx on inventory_movements (ref_type, ref_id);

-- ---------- delivery zones (Central only at launch) ----------
create table delivery_zones (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id),
  name text not null,
  fee numeric(10,2) not null check (fee >= 0),
  active boolean not null default true,
  unique (location_id, name)
);

-- ---------- chicken batch tracking ----------
create table purchase_batches (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id),
  supplier_name text not null,
  purchase_date date not null default (now() at time zone 'America/El_Salvador')::date,
  quantity_received numeric(10,3) not null check (quantity_received > 0),
  unit purchase_unit not null default 'unidades',
  unit_cost numeric(10,4) not null check (unit_cost >= 0),
  total_cost numeric(12,2) not null,
  quantity_remaining numeric(10,3) not null, -- consumed FIFO by production batches
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index purchase_batches_fifo_idx on purchase_batches (location_id, purchase_date, created_at);

create table production_batches (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id),
  marination_start_at timestamptz,
  roast_start_at timestamptz,
  roast_end_at timestamptz,
  quantity_produced numeric(10,3) not null default 0 check (quantity_produced >= 0),
  quantity_wasted numeric(10,3) not null default 0 check (quantity_wasted >= 0),
  staff_id uuid references profiles(id),
  status batch_status not null default 'open',
  yield_percentage numeric(6,2) generated always as (
    case when (quantity_produced + quantity_wasted) > 0
      then round(quantity_produced / (quantity_produced + quantity_wasted) * 100, 2)
      else null end
  ) stored,
  notes text,
  created_at timestamptz not null default now()
);
create index production_batches_fifo_idx on production_batches (location_id, roast_end_at, created_at);

-- which purchase batches a production batch consumed (FIFO default, manual override allowed)
create table production_batch_inputs (
  id uuid primary key default gen_random_uuid(),
  production_batch_id uuid not null references production_batches(id) on delete cascade,
  purchase_batch_id uuid not null references purchase_batches(id),
  quantity_consumed numeric(10,3) not null check (quantity_consumed > 0),
  unique (production_batch_id, purchase_batch_id)
);

-- sellable stock of each production batch per location (transfers move it)
create table production_batch_stock (
  id uuid primary key default gen_random_uuid(),
  production_batch_id uuid not null references production_batches(id),
  location_id uuid not null references locations(id),
  quantity_remaining numeric(10,3) not null default 0 check (quantity_remaining >= 0),
  unique (production_batch_id, location_id)
);

-- ---------- orders ----------
create table order_counters (
  location_id uuid primary key references locations(id),
  last_number integer not null default 0
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,        -- PP-C-0001 / PP-M-0001, set by trigger
  location_id uuid not null references locations(id),
  source order_source not null,
  order_type order_type not null default 'walk_in',
  status order_status not null default 'received',
  customer_name text,
  customer_phone text,
  customer_email text,
  delivery_address text,
  delivery_zone_id uuid references delivery_zones(id),
  subtotal numeric(12,2) not null check (subtotal >= 0),
  delivery_fee numeric(10,2) not null default 0 check (delivery_fee >= 0),
  total numeric(12,2) not null,
  payment_method payment_method,
  payment_status payment_status not null default 'pending',
  paid_at timestamptz,
  estimated_minutes integer,
  notes text,
  cashier_id uuid references profiles(id),
  ghl_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint total_matches check (total = subtotal + delivery_fee),
  constraint delivery_needs_zone check (order_type <> 'delivery' or delivery_zone_id is not null),
  constraint delivery_needs_address check (order_type <> 'delivery' or delivery_address is not null)
);
create index orders_location_status_idx on orders (location_id, status, created_at desc);
create index orders_phone_idx on orders (customer_phone);
create index orders_ghl_pending_idx on orders (status) where status = 'completed' and ghl_synced_at is null;

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  line_total numeric(12,2) generated always as (round(quantity * unit_price, 2)) stored,
  production_batch_id uuid references production_batches(id), -- primary batch (FIFO), set by trigger for chicken items
  notes text,
  created_at timestamptz not null default now()
);
create index order_items_order_idx on order_items (order_id);
create index order_items_batch_idx on order_items (production_batch_id);

-- exact batch consumption per item (an item can span batches at FIFO boundaries)
create table order_item_batch_consumption (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references order_items(id) on delete cascade,
  production_batch_id uuid not null references production_batches(id),
  quantity numeric(10,3) not null check (quantity > 0),
  unique (order_item_id, production_batch_id)
);

-- status audit trail (feeds KDS timings + customer status page)
create table order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  status order_status not null,
  changed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index order_status_events_order_idx on order_status_events (order_id, created_at);

-- ---------- transfers (push model: Central -> Mercado) ----------
create table transfers (
  id uuid primary key default gen_random_uuid(),
  from_location_id uuid not null references locations(id),
  to_location_id uuid not null references locations(id),
  status transfer_status not null default 'in_transit',
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  received_by uuid references profiles(id),
  received_at timestamptz,
  check (from_location_id <> to_location_id)
);

create table transfer_items (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references transfers(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id),
  quantity numeric(10,3) not null check (quantity > 0),
  production_batch_id uuid references production_batches(id) -- set for 'pollo' lines to keep traceability at destination
);
create index transfer_items_transfer_idx on transfer_items (transfer_id);

-- ---------- cash register ----------
create table cash_sessions (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id),
  status cash_session_status not null default 'open',
  opened_by uuid not null references profiles(id),
  opened_at timestamptz not null default now(),
  opening_amount numeric(12,2) not null check (opening_amount >= 0),
  closed_by uuid references profiles(id),
  closed_at timestamptz,
  expected_amount numeric(12,2),
  counted_amount numeric(12,2),
  notes text
);
create index cash_sessions_location_idx on cash_sessions (location_id, opened_at desc);

create table cash_movements (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references cash_sessions(id) on delete cascade,
  amount numeric(12,2) not null check (amount <> 0), -- positive = in, negative = out
  reason text not null,
  ref_type text,                -- 'order' when tied to a cash sale
  ref_id uuid,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index cash_movements_session_idx on cash_movements (session_id, created_at);
