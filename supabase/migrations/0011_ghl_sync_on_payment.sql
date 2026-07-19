-- GHL contacts were only created when an order reached `completed`, so a
-- customer who paid online never landed in the CRM until staff closed the
-- order (and never at all if it was cancelled first). Sync as soon as the
-- customer commits — on payment — and again on completion to refresh the
-- spend/count/favorite stats. The GHL upsert is idempotent (keyed by phone),
-- so running twice is safe. Cancelled orders never sync.
create or replace function app.enqueue_ghl_sync() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if new.customer_phone is not null
     and new.status <> 'cancelled'
     and (
       -- created already paid/completed (e.g. POS sale)
       (tg_op = 'INSERT' and (new.status = 'completed' or new.payment_status = 'paid'))
       -- just handed over
       or (tg_op = 'UPDATE' and new.status = 'completed'
           and old.status is distinct from new.status)
       -- just paid (Wompi webhook)
       or (tg_op = 'UPDATE' and new.payment_status = 'paid'
           and old.payment_status is distinct from new.payment_status)
     ) then
    perform net.http_post(
      url := 'https://xuhrenrsrmktfewfejkm.supabase.co/functions/v1/sync-ghl',
      body := jsonb_build_object('order_id', new.id),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  end if;
  return new;
end $$;

-- also watch payment_status so the Wompi webhook's update fires the sync
drop trigger if exists orders_ghl_sync on orders;
create trigger orders_ghl_sync
  after insert or update of status, payment_status on orders
  for each row execute function app.enqueue_ghl_sync();
