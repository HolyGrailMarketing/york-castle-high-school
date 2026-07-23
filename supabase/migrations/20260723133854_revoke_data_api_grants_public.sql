-- Revoke Data API (anon/authenticated) grants on the public schema.
--
-- Context: The app uses Prisma as the `postgres` role only; it never uses the
-- Supabase Data API (PostgREST/GraphQL) or the anon/authenticated roles.
-- By default Supabase grants those roles full privileges on public tables, which
-- keeps every table reflected in the pg_graphql introspection schema even though
-- RLS blocks the underlying data. That triggers 32 Security Advisor warnings:
--   * 16x pg_graphql_anon_table_exposed
--   * 16x pg_graphql_authenticated_table_exposed
--
-- Revoking the grants removes the tables from the GraphQL schema for those roles.
-- `service_role` (backend-only, bypasses RLS) is intentionally left untouched.
-- The ALTER DEFAULT PRIVILEGES lines stop future Prisma-created tables (owned by
-- `postgres`) from re-acquiring these grants, so the warnings won't return.

-- Remove existing grants on current objects.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;

-- Stop future objects created by `postgres` from being auto-granted.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
