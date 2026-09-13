/**
 * Seed the textbook rental tables with obviously-fake data for local development.
 *
 *   npm run seed:library              # catalogue, students, a few loans
 *   npm run seed:library -- --conflict  # also pre-stage the offline sync conflict cases
 *
 * Safe to re-run: every write is an upsert on a natural key, and the barcode
 * counter is only advanced for copies that do not already exist.
 *
 * The identities here are fictional and every address is @example.invalid, so
 * seeded rows can never be mistaken for the real student data in
 * backend/scripts/data/ (which is gitignored, and which this script must never
 * read from).
 *
 * This script refuses to run against a non-local database. Seeding fake
 * students into the live school database would be very hard to undo by hand;
 * set ALLOW_REMOTE_SEED=1 if you genuinely mean to.
 */

import dotenv from 'dotenv';
import prisma from '../src/utils/prisma.js';
import { FORM_CLASSES_BY_YEAR } from '../src/services/schoolClasses.js';

dotenv.config({ path: './.env' });

const wantsConflicts = process.argv.includes('--conflict');

// --- safety guard ----------------------------------------------------------

const assertLocalDatabase = () => {
  const url = process.env.DATABASE_URL || '';
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error('DATABASE_URL is missing or unparseable.');
  }
  const isLocal = ['localhost', '127.0.0.1', '::1', 'db', 'postgres'].includes(host);
  if (!isLocal && process.env.ALLOW_REMOTE_SEED !== '1') {
    throw new Error(
      `Refusing to seed fake students into a non-local database (host: ${host}).\n` +
      '  This script is for local development. If you really mean to, re-run with ALLOW_REMOTE_SEED=1.'
    );
  }
  return host;
};

// --- fixtures --------------------------------------------------------------

const ACADEMIC_YEAR = '2026-2027';

const TERMS = [
  { term: 1, startsOn: '2026-09-07', endsOn: '2026-12-18', isCurrent: true },
  { term: 2, startsOn: '2027-01-04', endsOn: '2027-04-01', isCurrent: false },
  { term: 3, startsOn: '2027-04-19', endsOn: '2027-07-02', isCurrent: false },
];

// Replacement costs are realistic Jamaican textbook prices in JMD.
const BOOKS = [
  { isbn: 'SEED-0001', title: 'Integrated Science for the Caribbean 1', subject: 'Integrated Science', yearGroups: [7], replacementCost: 3200, rentalFee: 600 },
  { isbn: 'SEED-0002', title: 'Mathematics: A Complete Course 1',        subject: 'Mathematics',        yearGroups: [7, 8], replacementCost: 4100, rentalFee: 750 },
  { isbn: 'SEED-0003', title: 'Language Tree Student Book 2',            subject: 'English Language',   yearGroups: [8], replacementCost: 2800, rentalFee: 550 },
  { isbn: 'SEED-0004', title: 'Caribbean Social Studies 2',              subject: 'Social Studies',     yearGroups: [8, 9], replacementCost: 3000, rentalFee: 600 },
  { isbn: 'SEED-0005', title: 'Mathematics: A Complete Course 2',        subject: 'Mathematics',        yearGroups: [9, 10], replacementCost: 4300, rentalFee: 800 },
  { isbn: 'SEED-0006', title: 'Principles of Business for CSEC',         subject: 'Principles of Business', yearGroups: [10, 11], replacementCost: 4800, rentalFee: 900 },
  { isbn: 'SEED-0007', title: 'Human and Social Biology for CSEC',       subject: 'Human and Social Biology', yearGroups: [10, 11], replacementCost: 4600, rentalFee: 850 },
  { isbn: 'SEED-0008', title: 'Chemistry for CSEC',                      subject: 'Chemistry',          yearGroups: [10, 11], replacementCost: 5200, rentalFee: 950 },
  { isbn: 'SEED-0009', title: 'Physics for CSEC',                        subject: 'Physics',            yearGroups: [10, 11], replacementCost: 5200, rentalFee: 950 },
  { isbn: 'SEED-0010', title: 'A Concise History of the Caribbean',      subject: 'History',            yearGroups: [9, 10, 11], replacementCost: 3900, rentalFee: 700 },
  { isbn: 'SEED-0011', title: 'Pure Mathematics for CAPE Unit 1',        subject: 'Pure Mathematics',   yearGroups: [12, 13], replacementCost: 6800, rentalFee: 1200 },
  { isbn: 'SEED-0012', title: 'Caribbean Studies for CAPE',              subject: 'Caribbean Studies',  yearGroups: [12, 13], replacementCost: 6200, rentalFee: 1100 },
];

const COPIES_PER_BOOK = 40;

// Fictional names. Any resemblance to a real student is coincidental - these
// exist so the desk screen has something plausible-looking to render.
const FIRST_NAMES = ['Aaliyah', 'Kemar', 'Shanice', 'Tarik', 'Jodian', 'Rojae', 'Kimani', 'Alecia', 'Damar', 'Nastassia'];
const LAST_NAMES = ['Bennett', 'Clarke', 'Ellis', 'Grant', 'Hinds', 'McKenzie', 'Powell', 'Reid', 'Samuels', 'Wright'];

const STUDENT_COUNT = 30;

const STAFF = { email: 'librarian@example.invalid', name: 'Seed Librarian', role: 'STAFF' };

// --- helpers ---------------------------------------------------------------

const barcodeFor = (n) => `YCHS-${String(n).padStart(6, '0')}`;
const at = (iso) => new Date(`${iso}T09:00:00.000Z`);
const daysFromNow = (n) => new Date(Date.now() + n * 86400000);

/** Deterministic student fixtures spread across the real form classes. */
const buildStudents = () => {
  const allClasses = Object.values(FORM_CLASSES_BY_YEAR).flat();
  return Array.from({ length: STUDENT_COUNT }, (_, i) => {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length];
    const formClass = allClasses[i % allClasses.length];
    const yearGroup = Number(formClass.match(/^\d+/)[0]);
    return {
      email: `${first}.${last}.${i + 1}@example.invalid`.toLowerCase(),
      name: `${first} ${last}`,
      formClass,
      yearGroup,
      studentNumber: `S${String(2600 + i).padStart(5, '0')}`,
      // Roughly a third are left unconfirmed so the verification queue has a
      // backlog to work through on first run.
      verified: i % 3 !== 0,
    };
  });
};

// --- seeding ---------------------------------------------------------------

async function seedTerms() {
  for (const t of TERMS) {
    await prisma.academicTerm.upsert({
      where: { academicYear_term: { academicYear: ACADEMIC_YEAR, term: t.term } },
      update: { startsOn: at(t.startsOn), endsOn: at(t.endsOn), isCurrent: t.isCurrent },
      create: { academicYear: ACADEMIC_YEAR, term: t.term, startsOn: at(t.startsOn), endsOn: at(t.endsOn), isCurrent: t.isCurrent },
    });
  }
  const current = await prisma.academicTerm.findFirst({ where: { isCurrent: true } });
  console.log(`  terms      ${TERMS.length} (current: ${current.academicYear} term ${current.term}, ends ${current.endsOn.toISOString().slice(0, 10)})`);
  return current;
}

async function seedStaff() {
  return prisma.user.upsert({
    where: { email: STAFF.email },
    update: { notifyOverdueBooks: true },
    create: { ...STAFF, notifyOverdueBooks: true },
  });
}

async function seedStudents(staffId) {
  const fixtures = buildStudents();
  const students = [];
  for (const s of fixtures) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: { email: s.email, name: s.name, role: 'STUDENT' },
    });
    const profile = {
      studentNumber: s.studentNumber,
      yearGroup: s.yearGroup,
      formClass: s.formClass,
      claimedYearGroup: s.yearGroup,
      claimedFormClass: s.formClass,
      verification: s.verified ? 'VERIFIED' : 'UNVERIFIED',
      verifiedAt: s.verified ? new Date() : null,
      verifiedById: s.verified ? staffId : null,
    };
    await prisma.studentProfile.upsert({
      where: { userId: user.id },
      update: profile,
      create: { userId: user.id, ...profile },
    });
    students.push({ ...s, id: user.id });
  }
  const confirmed = fixtures.filter((s) => s.verified).length;
  console.log(`  students   ${students.length} (${confirmed} confirmed, ${students.length - confirmed} awaiting confirmation)`);
  return students;
}

async function seedCatalogue() {
  const books = [];
  let nextBarcode = 1;

  for (const b of BOOKS) {
    const book = await prisma.book.upsert({
      where: { isbn: b.isbn },
      update: { title: b.title, subject: b.subject, yearGroups: b.yearGroups, replacementCost: b.replacementCost, rentalFee: b.rentalFee },
      create: b,
    });

    // Barcodes are deterministic so tests can hardcode YCHS-000001. Existing
    // rows are left alone, which is what makes a re-run a no-op.
    const rows = Array.from({ length: COPIES_PER_BOOK }, (_, i) => ({
      bookId: book.id,
      barcode: barcodeFor(nextBarcode + i),
      copyNumber: i + 1,
      condition: i % 9 === 0 ? 'FAIR' : 'GOOD',
      acquiredAt: at('2026-08-20'),
      batchId: `seed-${b.isbn}`,
    }));
    await prisma.bookCopy.createMany({ data: rows, skipDuplicates: true });

    nextBarcode += COPIES_PER_BOOK;
    books.push(book);
  }

  // Point the allocator past everything the seed just used, so copies added
  // through the dashboard carry on from YCHS-000481 rather than colliding.
  await prisma.barcodeCounter.upsert({
    where: { id: 'copy' },
    update: { nextValue: { set: nextBarcode } },
    create: { id: 'copy', nextValue: nextBarcode },
  });

  const copyCount = await prisma.bookCopy.count();
  console.log(`  catalogue  ${books.length} titles, ${copyCount} copies (${barcodeFor(1)}..${barcodeFor(nextBarcode - 1)})`);
  return books;
}

/**
 * Issue one copy, idempotently, keyed on a deterministic op id.
 *
 * Pass `copyNumber` to pin the loan to a specific physical copy. The conflict
 * fixtures do that so the barcodes they print stay the same from run to run -
 * picking "the first available copy" makes them drift as soon as anything else
 * has been issued, and a test that hardcodes a barcode then fails for a reason
 * that has nothing to do with what it is testing.
 */
async function issue({ opId, book, student, staffId, term, issuedAt, dueAt, condition = 'GOOD', copyNumber }) {
  const existing = await prisma.bookLoan.findUnique({ where: { issueOpId: opId } });
  if (existing) return existing;

  const copy = copyNumber
    ? await prisma.bookCopy.findUnique({ where: { bookId_copyNumber: { bookId: book.id, copyNumber } } })
    : await prisma.bookCopy.findFirst({
        where: { bookId: book.id, status: 'AVAILABLE' },
        orderBy: { copyNumber: 'asc' },
      });
  if (!copy) throw new Error(`no available copy of ${book.title}`);
  if (copy.status !== 'AVAILABLE') throw new Error(`${copy.barcode} is ${copy.status}, cannot issue`);

  return prisma.$transaction(async (tx) => {
    const loan = await tx.bookLoan.create({
      data: {
        copyId: copy.id,
        studentId: student.id,
        academicYear: term.academicYear,
        term: term.term,
        issuedAt,
        issuedById: staffId,
        issuedCondition: condition,
        dueAt,
        issueOpId: opId,
      },
    });
    await tx.bookCopy.update({ where: { id: copy.id }, data: { status: 'ON_LOAN' } });
    return loan;
  });
}

async function seedLoans(books, students, staffId, term) {
  const confirmed = students.filter((s) => s.verified);

  // A spread of ordinary, in-date loans.
  for (let i = 0; i < 8; i++) {
    await issue({
      opId: `seed-loan-${i}`,
      book: books[i % books.length],
      student: confirmed[i % confirmed.length],
      staffId,
      term,
      issuedAt: daysFromNow(-14),
      dueAt: term.endsOn,
    });
  }

  // One already overdue, so the reminder job and the Overdue filter have
  // something to find on first run.
  const overdue = await issue({
    opId: 'seed-loan-overdue',
    book: books[3],
    student: confirmed[1],
    staffId,
    term,
    issuedAt: daysFromNow(-120),
    dueAt: daysFromNow(-9),
  });

  // One lost, with the replacement charge that goes with it.
  const lostLoan = await issue({
    opId: 'seed-loan-lost',
    book: books[7],
    student: confirmed[2],
    staffId,
    term,
    issuedAt: daysFromNow(-60),
    dueAt: term.endsOn,
  });
  if (lostLoan.status !== 'LOST') {
    await prisma.$transaction([
      prisma.bookLoan.update({ where: { id: lostLoan.id }, data: { status: 'LOST' } }),
      prisma.bookCopy.update({ where: { id: lostLoan.copyId }, data: { status: 'LOST' } }),
    ]);
  }
  await prisma.bookCharge.upsert({
    where: { loanId_type: { loanId: lostLoan.id, type: 'LOST' } },
    update: {},
    create: {
      studentId: lostLoan.studentId,
      loanId: lostLoan.id,
      copyId: lostLoan.copyId,
      type: 'LOST',
      amount: books[7].replacementCost,
      academicYear: term.academicYear,
      term: term.term,
      reason: 'Reported lost by the student (seed data).',
      raisedById: staffId,
    },
  });

  return { overdue, lostLoan };
}

/**
 * Counted from the database at the very end, rather than tracked in a variable
 * as the loans are created. A counter would report a first run and a re-run
 * differently for the same end state, and would miss the conflict fixtures,
 * which are seeded after the ordinary loans.
 */
async function reportLoans() {
  const [active, overdue, lost, charges] = await Promise.all([
    prisma.bookLoan.count({ where: { status: 'ACTIVE' } }),
    prisma.bookLoan.count({ where: { status: 'ACTIVE', dueAt: { lt: new Date() } } }),
    prisma.bookLoan.count({ where: { status: 'LOST' } }),
    prisma.bookCharge.count({ where: { status: 'OUTSTANDING' } }),
  ]);
  console.log(`  loans      ${active} active (${overdue} overdue), ${lost} lost, ${charges} outstanding charge(s)`);
}

/**
 * Copies left in a known state so the offline conflict cases can be exercised
 * without ten minutes of clicking. See the conflict matrix in the plan.
 */
async function seedConflictFixtures(books, students, staffId, term) {
  const confirmed = students.filter((s) => s.verified);

  // Reserved copy numbers, counting down from the top of each title's run, so
  // the ordinary seed loans (which take from the bottom) can never claim them.
  const CONTESTED = COPIES_PER_BOOK - 1; // copy 39
  const REISSUE = COPIES_PER_BOOK - 2;   // copy 38

  // Already out to a known student: scan this barcode on a second offline
  // station and the sync must come back COPY_ALREADY_ON_LOAN.
  const contested = await issue({
    opId: 'seed-conflict-contested',
    book: books[0],
    student: confirmed[5],
    staffId,
    term,
    issuedAt: daysFromNow(-3),
    dueAt: term.endsOn,
    copyNumber: CONTESTED,
  });
  const contestedCopy = await prisma.bookCopy.findUnique({ where: { id: contested.copyId } });

  // Out to someone, ready to be returned offline on one station while a second
  // station reissues it online - the LOAN_CHANGED case.
  const reissued = await issue({
    opId: 'seed-conflict-reissue',
    book: books[1],
    student: confirmed[6],
    staffId,
    term,
    issuedAt: daysFromNow(-5),
    dueAt: term.endsOn,
    copyNumber: REISSUE,
  });
  const reissuedCopy = await prisma.bookCopy.findUnique({ where: { id: reissued.copyId } });

  // Withdrawn: scanning it at the desk must be refused outright.
  //
  // Addressed by copy number rather than "the first available one", so a
  // re-run withdraws the same copy instead of quietly withdrawing another one
  // every time the seed is run.
  const withdrawn = await prisma.bookCopy.update({
    where: { bookId_copyNumber: { bookId: books[2].id, copyNumber: COPIES_PER_BOOK } },
    data: { status: 'WITHDRAWN', withdrawnAt: daysFromNow(-30), withdrawnReason: 'Water damage (seed data).' },
  });

  const unconfirmed = students.find((s) => !s.verified);

  console.log('  conflicts  pre-staged:');
  console.log(`               ${contestedCopy.barcode}  already on loan to ${confirmed[5].name} (${confirmed[5].formClass})  -> COPY_ALREADY_ON_LOAN`);
  console.log(`               ${reissuedCopy.barcode}  on loan to ${confirmed[6].name}, return it offline then reissue -> LOAN_CHANGED`);
  console.log(`               ${withdrawn.barcode}  withdrawn                                  -> refused at the desk`);
  console.log(`               ${unconfirmed.studentNumber}    ${unconfirmed.name} is unconfirmed        -> blocked at scan, accepted by sync`);
}

// --- main ------------------------------------------------------------------

async function main() {
  const host = assertLocalDatabase();
  console.log(`Seeding textbook rental data into ${host}\n`);

  const term = await seedTerms();
  const staff = await seedStaff();
  const students = await seedStudents(staff.id);
  const books = await seedCatalogue();
  await seedLoans(books, students, staff.id, term);
  if (wantsConflicts) await seedConflictFixtures(books, students, staff.id, term);
  await reportLoans();

  console.log('\nDone. Every seeded address ends @example.invalid.');
  if (!wantsConflicts) console.log('Re-run with --conflict to pre-stage the offline sync conflict cases.');
}

main()
  .catch((error) => {
    console.error(`\nLibrary seed failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
