-- School fees: schedules, assessments, vouchers and payments.
--
-- The school does not collect this money. Payment is made at Bank of Nova
-- Scotia, Browns Town, account 39-13: the office issues a three-part paying-in
-- voucher, the student pays at the bank, the bank stamps all three copies, and
-- the student brings the stamped SCHOOL'S COPY back as proof. These tables
-- exist so the office can say what was charged, hand over the slip, and record
-- the stamped copy when it returns.
--
-- Deliberately separate from BookCharge. That table has no PAID because the
-- bursary takes the money and keeps its own books, so this system could only
-- guess. Here the school physically receives and files the evidence, so a
-- payment is a fact this system owns. BookCharge is untouched by this
-- migration.

-- CreateEnum
CREATE TYPE "FeeKind" AS ENUM ('INCIDENTAL', 'SCHOOL_FEE');

-- CreateEnum
CREATE TYPE "FeeAssessmentStatus" AS ENUM ('OUTSTANDING', 'SETTLED', 'WAIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FeePaymentMethod" AS ENUM ('CASH', 'CERTIFIED_CHEQUE');

-- CreateTable
CREATE TABLE "FeeSchedule" (
    "id" TEXT NOT NULL,
    "kind" "FeeKind" NOT NULL,
    "academicYear" TEXT NOT NULL,
    "yearGroup" INTEGER,
    "term" INTEGER,
    "label" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'JMD',
    "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeScheduleItem" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FeeScheduleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeAssessment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "kind" "FeeKind" NOT NULL,
    "academicYear" TEXT NOT NULL,
    "term" INTEGER,
    "yearGroup" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'JMD',
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "lines" JSONB NOT NULL,
    "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "waivedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "FeeAssessmentStatus" NOT NULL DEFAULT 'OUTSTANDING',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,
    "waivedAt" TIMESTAMP(3),
    "waivedById" TEXT,
    "waiveReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeVoucher" (
    "id" TEXT NOT NULL,
    "serial" INTEGER NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "amountShown" DECIMAL(10,2),
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,
    "printedCount" INTEGER NOT NULL DEFAULT 0,
    "lastPrintedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,

    CONSTRAINT "FeeVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeePayment" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "voucherId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'JMD',
    "method" "FeePaymentMethod" NOT NULL,
    "paidOn" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT,
    "bankReference" TEXT,
    "paidInBy" TEXT,
    "slipSeen" BOOLEAN NOT NULL DEFAULT true,
    "reversedAt" TIMESTAMP(3),
    "reversedById" TEXT,
    "reverseReason" TEXT,
    "opId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeePayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeSerialCounter" (
    "id" TEXT NOT NULL DEFAULT 'voucher',
    "prefix" TEXT NOT NULL DEFAULT '',
    "nextValue" INTEGER NOT NULL DEFAULT 50000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeSerialCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeeSchedule_academicYear_kind_idx" ON "FeeSchedule"("academicYear", "kind");

-- CreateIndex
CREATE INDEX "FeeSchedule_isPublished_idx" ON "FeeSchedule"("isPublished");

-- CreateIndex
CREATE INDEX "FeeScheduleItem_scheduleId_sortOrder_idx" ON "FeeScheduleItem"("scheduleId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "FeeScheduleItem_scheduleId_label_key" ON "FeeScheduleItem"("scheduleId", "label");

-- CreateIndex
CREATE INDEX "FeeAssessment_status_academicYear_idx" ON "FeeAssessment"("status", "academicYear");

-- CreateIndex
CREATE INDEX "FeeAssessment_studentId_status_idx" ON "FeeAssessment"("studentId", "status");

-- CreateIndex
CREATE INDEX "FeeAssessment_academicYear_term_status_idx" ON "FeeAssessment"("academicYear", "term", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FeeAssessment_studentId_scheduleId_key" ON "FeeAssessment"("studentId", "scheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "FeeVoucher_serial_key" ON "FeeVoucher"("serial");

-- CreateIndex
CREATE INDEX "FeeVoucher_assessmentId_idx" ON "FeeVoucher"("assessmentId");

-- CreateIndex
CREATE INDEX "FeeVoucher_issuedAt_idx" ON "FeeVoucher"("issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeePayment_opId_key" ON "FeePayment"("opId");

-- CreateIndex
CREATE INDEX "FeePayment_assessmentId_idx" ON "FeePayment"("assessmentId");

-- CreateIndex
CREATE INDEX "FeePayment_paidOn_idx" ON "FeePayment"("paidOn");

-- CreateIndex
CREATE INDEX "FeePayment_recordedAt_idx" ON "FeePayment"("recordedAt");

-- CreateIndex
CREATE INDEX "FeePayment_voucherId_idx" ON "FeePayment"("voucherId");

-- AddForeignKey
ALTER TABLE "FeeScheduleItem" ADD CONSTRAINT "FeeScheduleItem_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "FeeSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAssessment" ADD CONSTRAINT "FeeAssessment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeAssessment" ADD CONSTRAINT "FeeAssessment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "FeeSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeVoucher" ADD CONSTRAINT "FeeVoucher_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "FeeAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePayment" ADD CONSTRAINT "FeePayment_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "FeeAssessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePayment" ADD CONSTRAINT "FeePayment_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "FeeVoucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Hand-added, and Prisma will not recreate either of these.
--
-- 1. The schedule identity index.
--
-- A plain @@unique([academicYear, kind, yearGroup, term]) does NOT do the job,
-- which is why this is written out by hand in the same spirit as the
-- lower(email) index in 20260820140000_sixth_form_unique_email and the partial
-- indexes in 20260913000100_add_textbook_rental.
--
-- Postgres treats NULLs as distinct, and both nullable columns are NULL for
-- exactly the cases that matter: `term` is NULL on every INCIDENTAL schedule,
-- and `yearGroup` is NULL on every SCHOOL_FEE one. Without the COALESCE the
-- office can create the Christmas term school fee twice and assess both, and
-- two assessments is a parent being asked to pay J$30,000 twice.
--
-- 2. The serial counter row.
--
-- Seeded so the first voucher does not have to create it. 50000 is a starting
-- point clear of the school's pre-printed paper books, a sample of which
-- carries serial 20115 - if the app allocated into that range, two different
-- slips would carry the same number and the bank reconciliation would be
-- unrecoverable. The office can change it before the first real print run.
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX "FeeSchedule_identity"
  ON "FeeSchedule" ("academicYear", "kind",
                    COALESCE("yearGroup", -1), COALESCE("term", -1));

INSERT INTO "FeeSerialCounter" ("id", "prefix", "nextValue", "updatedAt")
VALUES ('voucher', '', 50000, NOW())
ON CONFLICT ("id") DO NOTHING;
