-- Enable Row Level Security (RLS) on all public tables.
--
-- Context: This app accesses Postgres exclusively through Prisma in the Express
-- backend, connecting as the privileged `postgres` role, which BYPASSES RLS.
-- No frontend code uses the Supabase client or anon key (verified). Enabling RLS
-- therefore does not affect the application; it only closes the auto-exposed
-- PostgREST/GraphQL API so the anon/authenticated roles cannot read or write
-- these tables directly.
--
-- With RLS enabled and NO policies defined, the tables are fully locked to the
-- anon/authenticated API roles (deny-by-default) while the backend keeps full
-- access. This clears the 17 Security Advisor errors:
--   * 16x rls_disabled_in_public
--   * 1x  sensitive_columns_exposed (public."User".password)
--
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY is idempotent and safe to re-run.

ALTER TABLE public."Analytics"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Application"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuditLog"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."BlogPost"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ConsentRecord"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Course"               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."DataSubjectRequest"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Document"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Enrollment"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Event"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Request"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SixthFormApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SixthFormInterview"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Teacher"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."User"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_prisma_migrations"   ENABLE ROW LEVEL SECURITY;
