# School fees & sixth form enrolment — handoff

## Pick up here

Branch `sixth-form-enrolment-fees`. Nothing is committed yet. Two features:

1. **Enrolment** — turning an approved sixth form applicant into a student on the register.
2. **School fees** — fee schedules, per-student charges, three-part paying-in vouchers, and
   recording the stamped slips that come back from the bank.

Both are additive. Nothing existing changes behaviour, with one exception noted under
*Things that will bite you*.

## Verify it works

A scratch database is already set up locally (`ychs_fees_scratch`). **Never point these at
`backend/.env`, which is the live Supabase pooler.**

```bash
cd backend && nohup env DATABASE_URL="postgresql://$USER@localhost:5432/ychs_fees_scratch" \
  PORT=3391 NODE_ENV=development node src/server.js > /tmp/fee_api.log 2>&1 &
```

Then `http://localhost:3391/admin` → School Fees.

The test scripts live in the session scratchpad rather than the repo (they are harnesses, not
a suite the project runs in CI). What they cover:

Three suites, **111 checks**, each needing a fresh server because `adminLimiter` is 50 requests per 15 minutes and in-memory (`run-all.sh` in the scratchpad restarts between them).

- **Enrolment, 22 checks** — reuses an existing account instead of creating a duplicate,
  re-running returns `alreadyEnrolled` rather than erroring, upserts a self-signed-up student's
  profile without colliding, fills an empty guardian field but never overwrites one the student
  entered themselves, refuses a non-approved application.
- **Cohort, 37 checks** — the list assembles real fee and loan figures (not placeholders) and its summary matches the database; filters by grade, faculty, owing and name; the full record returns fees, loans and the application together; faculty placement saves and an invented faculty is refused; a teacher can read but not write.
- **Fees, 52 checks over HTTP** — the three real 2023-24 schedules total 8,000 / 6,000 / 30,000;
  a duplicate Christmas school fee is refused; a draft fee cannot be charged; the charge run is
  idempotent; part-payment → settle → reverse walks the status back correctly; a waiver plus a
  part-payment jointly settle; overpayment is accepted and flagged; serials are contiguous;
  editing a schedule does not restate what students were already told; a student sees only their
  own fees; CSV is BOM-prefixed.

Drift check for the cached balances:

```bash
cd backend && DATABASE_URL="postgresql://$USER@localhost:5432/ychs_fees_scratch" \
  node scripts/reconcile-fee-balances.js        # --fix to correct
```

## What exists

### Enrolment

`POST /api/sixth-form/:id/enrol` (office) and `POST /api/sixth-form/enrol` (admin, bulk, with a
dry run). `GET /api/sixth-form/enrolment-candidates` lists everyone approved, including those
already enrolled — hiding the done ones would leave the office unable to tell "nobody is left"
from "something is broken".

Three columns on `SixthFormApplication`: `enrolledAt`, `enrolledById`, `enrolledUserId`.
**Deliberately not a new `ApplicationStatus` value** — every status filter, every count and
`NOTIFICATION_TYPES.requiresStatus` read `status`, and APPROVED is still true after they enrol.

The record-making lives in `backend/src/services/studentEnrolment.js`, extracted from
`deskRegisterStudent` so the library desk, sixth form enrolment and the future register import
cannot drift apart.

### The sixth form cohort

`Sixth Form` is now two screens behind one nav item, joined by a sub-navigation:

- **Applicants** — the admissions pipeline, unchanged, plus the enrol action.
- **Students** (`/admin/sixth-form/students`) — the enrolled cohort, one record per
  student rather than per application.

Everything the office knows about a sixth former already existed; it was spread across five
screens, so answering "where is this student up to" meant opening five of them. The student
record pulls it into four tabs: **Record** (who they are, who to ring), **Fees** (what they
have been charged and paid, with a slip printable on the spot), **Textbooks** (what they hold
and what is overdue), **Application & interview** (what they were admitted on, with their CSEC
results).

`GET /api/sixth-form/students` assembles the list in four queries regardless of cohort size —
one for the students, then grouped lookups for applications, fees, loans and book charges —
rather than a join per row.

**Faculty placement is now editable.** Until this screen it could only be set by
`backend/scripts/set-faculty.js`, so a placement corrected after the final lists went out had
nowhere to be recorded. The faculty lives on the application, not the profile, because it is a
decision about this intake; `PUT /api/sixth-form/students/:userId` writes both in one
transaction.

**Deliberately not attendance, grades or report cards.** Those belong to MySchool Jamaica,
which the school is already required to keep current. A second copy here would be a second
answer to a question that gets audited. What this screen does is the part MySchool has no
concept of: the admissions pipeline, the faculty placement, the bank-voucher fees and the
textbook rental.

### Fees

The school does not collect this money. It is paid at **Bank of Nova Scotia, Brown's Town,
account 39-13** against a printed three-part slip; the stamped SCHOOL'S COPY comes back to the
office and is recorded here.

| Model | What it is |
|---|---|
| `FeeSchedule` + `FeeScheduleItem` | What the school charges, and the lines that make it up |
| `FeeAssessment` | What one named student was told they owe — a frozen snapshot |
| `FeeVoucher` | One printed three-part slip, with its serial |
| `FeePayment` | A stamped bank copy that has come back |
| `FeeSerialCounter` | Allocates serials, like `BarcodeCounter` does barcodes |

Routes under `/api/fees`. Office (`ADMIN`+`STAFF`) reads, records payments and prints slips;
`ADMIN` sets the figures, charges in bulk, waives, cancels, voids and reverses.

Admin UI: a **School Fees** section in the sidebar with three screens — Balances, What we
charge, Payments — plus the voucher print in `admin-dashboard/src/utils/voucher.ts`.

## Things that will bite you

**1. `backend/prisma/schema.prisma` was broken when this work started.** It was 692 lines
against HEAD's 1008: an accidental edit had deleted the entire textbook-rental block —
`StudentProfile`, `BookLoan`, `BookCharge`, `AcademicTerm`, `BarcodeCounter` and seven enums.
A `prisma migrate dev` against it would have emitted `DROP TABLE` against live student and
money data. It is repaired, and `prisma migrate diff --from-migrations --to-schema-datamodel`
now returns an empty migration. **Run that check before generating any future migration**, and
read the generated SQL for `DROP` before applying it.

**2. The two migrations go out of band**, as the last four did. `migration.sql` must run as a
single paste into Supabase, followed by a hand-inserted `_prisma_migrations` row carrying the
real SHA-256 — the equivalent of `prisma migrate resolve --applied`. Then run
`supabase/migrations/20260930130100_enable_rls_school_fees.sql` straight after, and confirm the
Security Advisor shows no new `rls_disabled_in_public`. Editing an applied migration file breaks
its checksum; write a new one instead.

**3. Voucher serials must not collide with the paper books.** The school has pre-printed
three-part books in use; a sample slip carries **20115**. The counter starts at 50000 and is
settable from *What we charge → Voucher numbering*. **Confirm the safe band with the school
before the first real print run** — two slips sharing a number makes the bank reconciliation
unrecoverable. The counter cannot be set below a serial already issued.

**4. Nullable columns do not make a unique key.** `FeeSchedule` has a hand-written
`FeeSchedule_identity` index using `COALESCE(...,-1)`, because Postgres treats NULLs as distinct
and both nullable columns are NULL for the cases that matter — `term` on every incidental fee,
`yearGroup` on every school fee. Without it the office can create the Christmas school fee twice
and charge both, which is a parent asked for J$30,000 twice. Prisma will not recreate it.

**5. The school fee is per term.** Christmas, Easter and Summer are three separate schedules and
three charges per student per year. Every confirmation names the term in words for this reason.

**6. Editing a schedule does not restate existing charges.** That is what the snapshot on
`FeeAssessment` is for — a family keeps the figure on the slip they were handed. The response
returns `affectedFutureIssues` and the UI says so, because it is the most surprising behaviour
in the feature.

**7. `Decimal` is an object, not a number.** Everything goes through `money()`/`toCents()` in
`services/feeBalances.js`. `decimal + decimal` in JavaScript concatenates two objects.

**8. There must be a current `AcademicTerm`.** `academicYear` defaults from it, never from
`new Date()`. Without one the fee pages have no year to file against.

**9. `dataDeletionService.js` does not cover these tables** — nor `studentProfile`, `bookLoan` or
`bookCharge`, which was already true. `FeeAssessment`/`FeePayment` use `onDelete: Restrict`, so a
GDPR erasure for a student with any fee record will now fail on the foreign key. Fee records are
a financial record with a statutory retention period, which is a legitimate ground to refuse
erasure — but it needs writing into `COMPLIANCE.md` rather than surfacing as a 500.

**10. An overpayment is not netted against what is owed.** On the student's Fees tab, a fee
paid over the top shows as "overpaid" and is counted separately from the outstanding total.
Netting them would show a smaller figure than the student actually owes on the unpaid fee —
two different problems for the office, and only one of them is money it can collect.

**11. `backend/.env` has two `JWT_SECRET` lines.** dotenv takes the last. Unrelated to this work,
but worth cleaning up before it confuses someone.

## Still to do

- **`fees.html`** — the student-facing balance page. `GET /api/fees/my` already exists and is
  tested; the page itself is not written. Clone `my-books.html`, add it to `PAGES` in
  `scripts/build-partials.js`.
- **Grade 13 have no records at all.** They were last year's Grade 12, and the application
  deadline was 2026-07-20, so this is the first cohort the system handled — there is nothing to
  promote from. They cannot be charged until they exist. The plan is a paste-a-CSV bulk import
  through `studentEnrolment.js`; **get a real export file from the school first** so the parser
  matches what they can actually produce.
- **Parents cannot see a child's balance.** There is no Parent↔Student relation anywhere in the
  schema. That needs a `GuardianLink` model and a verification flow — a separate decision.
- **Confirm the 2026-27 figures and line labels.** The schedules entered are last year's. Note
  the Grade 12 sheet lists both `TEXT MESSAGE/REPORTS 500` and `MESSAGE/REPORTS 500`, which looks
  like a duplicate but is needed to reach 8,000 — check before entering this year's.

## Where the data came from

The three fee structures are transcribed from the school's own paying-in slips for 2023-2024:
Grade 12 incidental (9 lines, J$8,000), Grade 13 incidental (7 lines, J$6,000), and the sixth
form parent contribution for the Christmas term (J$20,000 + J$10,000 building fund = J$30,000).
The voucher layout, the denomination tally, the bank details and the wording on the slip
("Verified as to cash only", "PLEASE WRITE IN THE AMOUNT BEING PAID", "PAID IN BY") are
reproduced from those same documents.
