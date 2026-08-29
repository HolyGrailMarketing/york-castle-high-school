-- One-time links letting named candidates past the closed application form.
--
-- Random tokens looked up here rather than signed ones: the scripts that issue
-- invites run on a staff machine and verification happens in production, and
-- the two do not share a signing secret. They do share this database.
CREATE TABLE "SixthFormInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "faculty" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "SixthFormInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SixthFormInvite_token_key" ON "SixthFormInvite"("token");
CREATE INDEX "SixthFormInvite_email_idx" ON "SixthFormInvite"("email");
CREATE INDEX "SixthFormInvite_expiresAt_idx" ON "SixthFormInvite"("expiresAt");
