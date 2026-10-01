-- Enrolling a sixth form applicant as a student.
--
-- Approving an application used to write status, notes, reviewedAt and
-- reviewedBy and stop there. No StudentProfile was created, so an approved
-- sixth former was invisible to the student register, the verification queue
-- and the library desk, and the office had to register every one of them by
-- hand.
--
-- These three columns record that the applicant has become a student.
-- Deliberately NOT a new ApplicationStatus value: every status filter, every
-- count and NOTIFICATION_TYPES.requiresStatus read `status`, and APPROVED is
-- still true after they enrol. Enrolment is a second fact about the row, not a
-- replacement for the decision.
--
-- enrolledUserId is what makes the bulk run repeatable: an application that
-- already carries one is skipped rather than given a second account, so
-- pressing the button again after a timeout is safe.

ALTER TABLE "SixthFormApplication" ADD COLUMN "enrolledAt" TIMESTAMP(3);
ALTER TABLE "SixthFormApplication" ADD COLUMN "enrolledById" TEXT;
ALTER TABLE "SixthFormApplication" ADD COLUMN "enrolledUserId" TEXT;
CREATE INDEX "SixthFormApplication_enrolledAt_idx" ON "SixthFormApplication"("enrolledAt");
