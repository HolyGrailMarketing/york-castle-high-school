-- Enable Row Level Security (RLS) on the textbook rental tables.
--
-- Follow-up to 20260723133201_enable_rls_all_public_tables.sql. That migration
-- enabled RLS table-by-table by name; there is no event trigger, so any table
-- Prisma creates afterwards ships with RLS DISABLED and raises a fresh
-- rls_disabled_in_public Security Advisor error. This clears it for the seven
-- tables added by the Prisma migration 20260913000100_add_textbook_rental.
--
-- No policies are defined, matching the established convention: the tables are
-- deny-by-default for the anon/authenticated API roles, while Prisma
-- (connecting as `postgres`) bypasses RLS and is unaffected. Everything a
-- student, parent or member of staff can see is served by the Express routes
-- under /api/students, /api/library and /api/loans, which scope by the
-- authenticated user, not by PostgREST.
--
-- This matters more here than it did for the booklist. These tables hold, for
-- every student in the school, their form class and what they owe the school
-- money for. None of it should ever be reachable from a browser with the anon
-- key.
--
-- Table grants need no action here: the ALTER DEFAULT PRIVILEGES statements in
-- 20260723133854_revoke_data_api_grants_public.sql already prevent new tables
-- created by `postgres` from being granted to anon/authenticated.
--
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY is idempotent and safe to re-run.

ALTER TABLE public."StudentProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Book"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BookCopy"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BookLoan"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BookCharge"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AcademicTerm"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BarcodeCounter" ENABLE ROW LEVEL SECURITY;
