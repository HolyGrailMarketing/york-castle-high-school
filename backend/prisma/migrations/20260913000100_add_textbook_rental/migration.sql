-- CreateEnum
CREATE TYPE "BookCondition" AS ENUM ('NEW', 'GOOD', 'FAIR', 'POOR', 'DAMAGED');

-- CreateEnum
CREATE TYPE "CopyStatus" AS ENUM ('AVAILABLE', 'ON_LOAN', 'REPAIR', 'LOST', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'RETURNED', 'LOST', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "LoanSource" AS ENUM ('ONLINE', 'OFFLINE_SYNC');

-- CreateEnum
CREATE TYPE "ChargeType" AS ENUM ('RENTAL', 'LOST', 'DAMAGE');

-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('OUTSTANDING', 'WAIVED');

-- CreateEnum
CREATE TYPE "StudentVerification" AS ENUM ('UNVERIFIED', 'VERIFIED', 'REJECTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyOverdueBooks" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "studentNumber" TEXT,
    "yearGroup" INTEGER,
    "formClass" TEXT,
    "claimedYearGroup" INTEGER,
    "claimedFormClass" TEXT,
    "guardianName" TEXT,
    "guardianPhone" TEXT,
    "guardianEmail" TEXT,
    "verification" "StudentVerification" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "registeredAtDesk" BOOLEAN NOT NULL DEFAULT false,
    "loanCap" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "publisher" TEXT,
    "edition" TEXT,
    "isbn" TEXT,
    "subject" TEXT NOT NULL,
    "yearGroups" INTEGER[],
    "replacementCost" DECIMAL(10,2) NOT NULL,
    "rentalFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookCopy" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "copyNumber" INTEGER NOT NULL,
    "condition" "BookCondition" NOT NULL DEFAULT 'GOOD',
    "status" "CopyStatus" NOT NULL DEFAULT 'AVAILABLE',
    "acquiredAt" TIMESTAMP(3),
    "batchId" TEXT,
    "withdrawnAt" TIMESTAMP(3),
    "withdrawnReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookCopy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookLoan" (
    "id" TEXT NOT NULL,
    "copyId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "term" INTEGER,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "issuedServerAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT NOT NULL,
    "issuedCondition" "BookCondition" NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "returnedServerAt" TIMESTAMP(3),
    "returnedById" TEXT,
    "returnedCondition" "BookCondition",
    "conditionNote" TEXT,
    "issueOpId" TEXT NOT NULL,
    "returnOpId" TEXT,
    "issueSource" "LoanSource" NOT NULL DEFAULT 'ONLINE',
    "returnSource" "LoanSource",
    "stationId" TEXT,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "reviewReason" TEXT,
    "dueSoonNotifiedAt" TIMESTAMP(3),
    "overdueNotifiedAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookCharge" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "loanId" TEXT,
    "copyId" TEXT,
    "type" "ChargeType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'JMD',
    "academicYear" TEXT NOT NULL,
    "term" INTEGER,
    "status" "ChargeStatus" NOT NULL DEFAULT 'OUTSTANDING',
    "reason" TEXT,
    "raisedById" TEXT,
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "waivedById" TEXT,
    "waivedAt" TIMESTAMP(3),
    "waiveReason" TEXT,
    "opId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicTerm" (
    "id" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "term" INTEGER NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarcodeCounter" (
    "id" TEXT NOT NULL DEFAULT 'copy',
    "prefix" TEXT NOT NULL DEFAULT 'YCHS-',
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BarcodeCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_studentNumber_key" ON "StudentProfile"("studentNumber");

-- CreateIndex
CREATE INDEX "StudentProfile_verification_idx" ON "StudentProfile"("verification");

-- CreateIndex
CREATE INDEX "StudentProfile_yearGroup_formClass_idx" ON "StudentProfile"("yearGroup", "formClass");

-- CreateIndex
CREATE INDEX "StudentProfile_formClass_idx" ON "StudentProfile"("formClass");

-- CreateIndex
CREATE UNIQUE INDEX "Book_isbn_key" ON "Book"("isbn");

-- CreateIndex
CREATE INDEX "Book_subject_idx" ON "Book"("subject");

-- CreateIndex
CREATE INDEX "Book_isActive_idx" ON "Book"("isActive");

-- CreateIndex
CREATE INDEX "Book_title_idx" ON "Book"("title");

-- CreateIndex
CREATE UNIQUE INDEX "BookCopy_barcode_key" ON "BookCopy"("barcode");

-- CreateIndex
CREATE INDEX "BookCopy_status_idx" ON "BookCopy"("status");

-- CreateIndex
CREATE INDEX "BookCopy_bookId_status_idx" ON "BookCopy"("bookId", "status");

-- CreateIndex
CREATE INDEX "BookCopy_batchId_idx" ON "BookCopy"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "BookCopy_bookId_copyNumber_key" ON "BookCopy"("bookId", "copyNumber");

-- CreateIndex
CREATE UNIQUE INDEX "BookLoan_issueOpId_key" ON "BookLoan"("issueOpId");

-- CreateIndex
CREATE UNIQUE INDEX "BookLoan_returnOpId_key" ON "BookLoan"("returnOpId");

-- CreateIndex
CREATE INDEX "BookLoan_studentId_status_idx" ON "BookLoan"("studentId", "status");

-- CreateIndex
CREATE INDEX "BookLoan_status_dueAt_idx" ON "BookLoan"("status", "dueAt");

-- CreateIndex
CREATE INDEX "BookLoan_copyId_status_idx" ON "BookLoan"("copyId", "status");

-- CreateIndex
CREATE INDEX "BookLoan_academicYear_term_idx" ON "BookLoan"("academicYear", "term");

-- CreateIndex
CREATE INDEX "BookLoan_needsReview_idx" ON "BookLoan"("needsReview");

-- CreateIndex
CREATE UNIQUE INDEX "BookCharge_opId_key" ON "BookCharge"("opId");

-- CreateIndex
CREATE INDEX "BookCharge_studentId_status_idx" ON "BookCharge"("studentId", "status");

-- CreateIndex
CREATE INDEX "BookCharge_status_academicYear_idx" ON "BookCharge"("status", "academicYear");

-- CreateIndex
CREATE UNIQUE INDEX "BookCharge_loanId_type_key" ON "BookCharge"("loanId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicTerm_academicYear_term_key" ON "AcademicTerm"("academicYear", "term");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookCopy" ADD CONSTRAINT "BookCopy_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookLoan" ADD CONSTRAINT "BookLoan_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "BookCopy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookLoan" ADD CONSTRAINT "BookLoan_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookLoan" ADD CONSTRAINT "BookLoan_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookLoan" ADD CONSTRAINT "BookLoan_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookCharge" ADD CONSTRAINT "BookCharge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookCharge" ADD CONSTRAINT "BookCharge_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "BookLoan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookCharge" ADD CONSTRAINT "BookCharge_copyId_fkey" FOREIGN KEY ("copyId") REFERENCES "BookCopy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookCharge" ADD CONSTRAINT "BookCharge_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-added indexes.
--
-- Prisma cannot express partial (filtered) indexes in schema.prisma, so these
-- are written here by hand, in the same spirit as the lower(email) unique index
-- in 20260820140000_sixth_form_unique_email.
--
-- Prisma 5 does not model filtered indexes at all, so it neither recreates nor
-- drops them: `prisma migrate diff` against this schema proposes no change to
-- either one (verified). They are invisible to the datamodel and live only
-- here, which means the schema alone does not tell you the rule they enforce -
-- the comment on model BookLoan in schema.prisma points back at this file.
-- Do not drop them.
-- ---------------------------------------------------------------------------

-- One live loan per physical copy.
--
-- This is the whole safety net for the offline counter. Two stations that
-- cannot see each other can both record issuing copy YCHS-000123; the second
-- one to sync hits this index and comes back as a P2002 that the sync
-- controller turns into a rejection a human resolves, instead of silently
-- creating a second active loan and losing track of the book.
CREATE UNIQUE INDEX "BookLoan_one_active_per_copy"
  ON "BookLoan" ("copyId")
  WHERE "status" = 'ACTIVE';

-- Exactly one academic term can be current.
--
-- Due dates and every overdue calculation read AcademicTerm.isCurrent. Two
-- current rows would mean the due date a student is given depends on which row
-- the query happened to return first.
CREATE UNIQUE INDEX "AcademicTerm_one_current"
  ON "AcademicTerm" ((true))
  WHERE "isCurrent";
