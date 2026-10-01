-- Enable Row Level Security (RLS) on the school fee tables.
--
-- Follow-up to 20260723133201_enable_rls_all_public_tables.sql. That migration
-- enabled RLS table-by-table by name; there is no event trigger, so any table
-- Prisma creates afterwards ships with RLS DISABLED and raises a fresh
-- rls_disabled_in_public Security Advisor error. This clears it for the six
-- tables added by the Prisma migration 20260930130000_add_school_fees.
--
-- No policies are defined, matching the established convention: the tables are
-- deny-by-default for the anon/authenticated API roles, while Prisma
-- (connecting as `postgres`) bypasses RLS and is unaffected. A student sees
-- their own fees through GET /api/fees/my, which scopes by the authenticated
-- user id and never takes an id from the URL; the office sees the rest through
-- the role-guarded routes under /api/fees.
--
-- This is the most sensitive data the school keeps after the application
-- records. These tables say, for every named student, what their family has
-- been asked to pay and whether they have paid it. A child whose fees are
-- outstanding is a child whose circumstances are visible in this table, so
-- reachable from a browser with the anon key would be a safeguarding problem
-- and not only a privacy one.
--
-- Table grants need no action here: the ALTER DEFAULT PRIVILEGES statements in
-- 20260723133854_revoke_data_api_grants_public.sql already prevent new tables
-- created by `postgres` from being granted to anon/authenticated.
--
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY is idempotent and safe to re-run.

ALTER TABLE public."FeeSchedule"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."FeeScheduleItem"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."FeeAssessment"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."FeeVoucher"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."FeePayment"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."FeeSerialCounter" ENABLE ROW LEVEL SECURITY;
