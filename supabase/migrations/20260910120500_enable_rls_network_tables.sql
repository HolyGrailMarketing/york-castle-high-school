-- Enable Row Level Security (RLS) on public."NetworkDevice" and
-- public."NetworkPort".
--
-- Follow-up to 20260723133201_enable_rls_all_public_tables.sql. That migration
-- enabled RLS table-by-table by name; there is no event trigger, so any table
-- Prisma creates afterwards ships with RLS DISABLED and raises a fresh
-- rls_disabled_in_public Security Advisor error. This clears it for the two
-- tables added by the Prisma migration 20260910120000_add_network_map.
--
-- No policies are defined, matching the established convention: the tables are
-- deny-by-default for the anon/authenticated API roles, while Prisma (connecting
-- as `postgres`) bypasses RLS and is unaffected. All access to these tables is
-- served by the Express backend, not by PostgREST - and in this case only to
-- signed-in ADMIN users, since the port map describes how to reach every switch
-- on the campus.
--
-- Table grants need no action here: the ALTER DEFAULT PRIVILEGES statements in
-- 20260723133854_revoke_data_api_grants_public.sql already prevent new tables
-- created by `postgres` from being granted to anon/authenticated.
--
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY is idempotent and safe to re-run.

ALTER TABLE public."NetworkDevice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."NetworkPort" ENABLE ROW LEVEL SECURITY;
