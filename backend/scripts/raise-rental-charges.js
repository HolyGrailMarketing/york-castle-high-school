/**
 * Record the term's book rental charges.
 *
 *   npm run library:charges -- --dry-run     # show what would happen
 *   npm run library:charges                  # record them
 *
 * A deliberate once-a-term act, not something that happens automatically when a
 * book is handed over: the school decides when the term's rental falls due.
 *
 * The office can do the same thing from Admin > Book Charges > Raise Term
 * Rental. This script exists for the case where someone wants it run without
 * signing in, and so it can be scheduled if the school ever wants that.
 *
 * Safe to re-run: the unique index on (loanId, type) means a loan can only ever
 * carry one RENTAL charge, so a second run records nothing.
 */

import dotenv from 'dotenv';
import prisma from '../src/utils/prisma.js';

dotenv.config({ path: './.env' });

const dryRun = process.argv.includes('--dry-run');

const money = (n) => `JMD ${Number(n).toLocaleString('en-JM')}`;

async function main() {
  const term = await prisma.academicTerm.findFirst({ where: { isCurrent: true } });
  if (!term) {
    throw new Error('No academic term is marked current. Set one in Admin > Book Charges first.');
  }

  console.log(`Term ${term.term} of ${term.academicYear}, books due ${term.endsOn.toISOString().slice(0, 10)}\n`);

  const loans = await prisma.bookLoan.findMany({
    where: {
      status: 'ACTIVE',
      academicYear: term.academicYear,
      term: term.term,
      charges: { none: { type: 'RENTAL' } },
      copy: { book: { rentalFee: { gt: 0 } } },
    },
    include: {
      copy: { include: { book: { select: { title: true, rentalFee: true } } } },
      student: { select: { id: true, name: true, studentProfile: { select: { formClass: true } } } },
    },
  });

  if (loans.length === 0) {
    console.log('Nothing to charge. Either no books are out, or every loan has already been charged.');
    return;
  }

  const total = loans.reduce((sum, l) => sum + Number(l.copy.book.rentalFee), 0);
  const students = new Set(loans.map((l) => l.studentId)).size;

  console.log(`${loans.length} loans across ${students} students, totalling ${money(total)}`);
  for (const l of loans.slice(0, 10)) {
    const cls = l.student.studentProfile?.formClass ?? '-';
    console.log(`  ${l.student.name} (${cls})  ${l.copy.book.title}  ${money(l.copy.book.rentalFee)}`);
  }
  if (loans.length > 10) console.log(`  ...and ${loans.length - 10} more`);

  if (dryRun) {
    console.log('\nDry run - nothing was recorded. Re-run without --dry-run to record these.');
    return;
  }

  const result = await prisma.bookCharge.createMany({
    data: loans.map((l) => ({
      studentId: l.studentId,
      loanId: l.id,
      copyId: l.copyId,
      type: 'RENTAL',
      amount: l.copy.book.rentalFee,
      academicYear: term.academicYear,
      term: term.term,
      reason: `Book rental for ${l.copy.book.title}, term ${term.term}.`,
    })),
    skipDuplicates: true,
  });

  console.log(`\nRecorded ${result.count} charge(s). Students can see these on My Books; the bursary collects.`);
}

main()
  .catch((error) => {
    console.error(`\nRental charge run failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
