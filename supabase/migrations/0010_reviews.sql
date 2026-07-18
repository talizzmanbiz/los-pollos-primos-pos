-- Customer reviews for the storefront. Reviews are moderated: they are
-- submitted unapproved and only become publicly visible once an admin approves
-- them (prevents spam/abuse on a public page).
create table reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete set null,
  customer_name text,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1000),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);
create index reviews_approved_idx on reviews (approved, created_at desc);

alter table reviews enable row level security;

-- public: read only approved reviews
create policy reviews_public_read on reviews
  for select to anon, authenticated using (approved);

-- public: may submit a review, but never pre-approved (can't self-publish)
create policy reviews_public_insert on reviews
  for insert to anon, authenticated with check (approved = false);

-- admin / superadmin: moderate (see all, approve, delete)
create policy reviews_admin_read on reviews
  for select to authenticated using (app.is_superadmin() or app.has_role('admin'));
create policy reviews_admin_update on reviews
  for update to authenticated using (app.is_superadmin() or app.has_role('admin'))
  with check (app.is_superadmin() or app.has_role('admin'));
create policy reviews_admin_delete on reviews
  for delete to authenticated using (app.is_superadmin() or app.has_role('admin'));

grant select, insert on reviews to anon;
grant select, insert, update, delete on reviews to authenticated;
