-- Enable Row Level Security (RLS) on the seven public."Timetable*" tables.
--
-- Follow-up to 20260723133201_enable_rls_all_public_tables.sql. That migration
-- enabled RLS table-by-table by name; there is no event trigger, so any table
-- Prisma creates afterwards ships with RLS DISABLED and raises a fresh
-- rls_disabled_in_public Security Advisor error. This clears it for the seven
-- tables added by the Prisma migration 20260829120000_add_timetable.
--
-- Unlike the BooklistEntry, SixthFormNotification and Network follow-ups, this
-- one is late: the timetable tables were created in production on 2026-08-29
-- and have been running with RLS disabled since. The Security Advisor stayed
-- clean anyway because 20260723133854_revoke_data_api_grants_public.sql leaves
-- anon and authenticated with no grants on them at all, so PostgREST cannot
-- reach the tables regardless. Enabling RLS restores the defence-in-depth the
-- convention is there to provide.
--
-- No policies are defined, matching the established convention: the tables are
-- deny-by-default for the anon/authenticated API roles, while Prisma (connecting
-- as `postgres`) bypasses RLS and is unaffected. The published timetable is
-- served by the Express routes under /api/timetable, not by PostgREST.
--
-- Table grants need no action here: the ALTER DEFAULT PRIVILEGES statements in
-- 20260723133854_revoke_data_api_grants_public.sql already prevent new tables
-- created by `postgres` from being granted to anon/authenticated.
--
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY is idempotent and safe to re-run.

ALTER TABLE public."TimetableVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TimetablePeriod" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TimetableGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TimetableTeacher" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TimetableRoom" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TimetableActivity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TimetablePlacement" ENABLE ROW LEVEL SECURITY;
