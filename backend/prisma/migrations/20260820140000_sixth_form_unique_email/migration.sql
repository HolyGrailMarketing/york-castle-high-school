-- One Sixth Form application per email address.
--
-- The application-level guard in createSixthFormApplication is the friendly
-- path (it returns a 409 telling the applicant to sign in); this index is the
-- backstop that makes a duplicate impossible regardless of how the row is
-- created. Matched on lower(email) because the guard compares addresses
-- case-insensitively, and rows are stored lower-cased to agree with it.
--
-- Requires scripts/dedupe-sixth-form.js to have been run first: this fails if
-- any address still carries more than one application.
CREATE UNIQUE INDEX "SixthFormApplication_email_lower_key"
  ON "SixthFormApplication" (lower(email));
