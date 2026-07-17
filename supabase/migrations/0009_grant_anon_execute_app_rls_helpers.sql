-- The public storefront reads products / locations / delivery_zones with the
-- anon role. Those tables' RLS "public_read" policies call app.is_superadmin()
-- and app.has_role(), but migration 0002 granted schema usage + function execute
-- only to `authenticated`. So anon SELECT errored with 42501 "permission denied
-- for function is_superadmin" and the online menu never loaded for the public.
-- Grant anon execute on just those two helpers (both return false when
-- auth.uid() is null, i.e. for anonymous visitors).
grant usage on schema app to anon;
grant execute on function app.is_superadmin(), app.has_role(user_role[]) to anon;
