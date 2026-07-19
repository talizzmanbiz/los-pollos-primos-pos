-- Purchase lots now record BOTH the weight (libras) and the count (unidades),
-- so the real cost per chicken is knowable even when the supplier prices by
-- weight.
--
-- Why this also fixes a latent bug: close_production_batch() consumes
-- purchase_batches.quantity_remaining as WHOLE CHICKENS (it raises "faltan N
-- unidades" and feeds production_batch_stock / the `pollo` inventory item,
-- which are tracked in whole-chicken equivalents). Previously a lot recorded
-- with unit='libras' put POUNDS into quantity_remaining, so production would
-- have consumed pounds as if they were chickens. From here on
-- quantity_received/quantity_remaining are always UNIDADES, and `unit` only
-- says which unit the supplier priced by (so unit_cost is per that unit).

alter table purchase_batches
  add column quantity_units numeric(10,3) check (quantity_units > 0),
  add column quantity_lb    numeric(10,3) check (quantity_lb > 0);

comment on column purchase_batches.quantity_units is
  'Pollos enteros recibidos (unidades). Cantidad canónica: alimenta quantity_received/quantity_remaining y el consumo FIFO.';
comment on column purchase_batches.quantity_lb is
  'Libras recibidas (peso). Informativo/costeo; no se consume.';
comment on column purchase_batches.unit is
  'Unidad en la que el proveedor cotizó: unit_cost es por libra o por unidad.';

create or replace function app.purchase_batch_defaults() returns trigger
language plpgsql as $$
begin
  -- Canonical FIFO quantity is always UNIDADES (whole chickens).
  if new.quantity_units is null then
    new.quantity_units := new.quantity_received; -- legacy inserts
  end if;
  new.quantity_received := new.quantity_units;

  -- Cost is quoted per libra or per unidad; total follows the quoted unit.
  if new.total_cost is null then
    new.total_cost := round(
      case
        when new.unit = 'libras' and new.quantity_lb is not null
          then new.quantity_lb * new.unit_cost
        else new.quantity_units * new.unit_cost
      end, 2);
  end if;

  if new.quantity_remaining is null then
    new.quantity_remaining := new.quantity_received;
  end if;
  return new;
end $$;
