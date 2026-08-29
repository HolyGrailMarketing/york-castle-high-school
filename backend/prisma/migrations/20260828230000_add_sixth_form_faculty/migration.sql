-- The faculty a Sixth Form student has been placed in (Business, Humanities,
-- Science, Technical). Distinct from subjectChoices, which records what the
-- applicant asked for; placement is the school's decision and can differ.
--
-- Nullable: applications that were not accepted have no faculty, and the
-- column is backfilled from the final candidate lists for those that were.
ALTER TABLE "SixthFormApplication" ADD COLUMN "faculty" TEXT;

-- Staff filter and count by faculty once places are assigned.
CREATE INDEX "SixthFormApplication_faculty_idx" ON "SixthFormApplication"("faculty");
