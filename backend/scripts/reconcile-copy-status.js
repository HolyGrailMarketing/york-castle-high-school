/**
 * Check BookCopy.status against the loans, which are the authoritative record.
 *
 *   npm run library:reconcile            # report only
 *   npm run library:reconcile -- --fix   # correct the copies
 *
 * The rule the rental system rests on is that BookLoan says who has a copy and
 * BookCopy.status is a derived cache of that. The cache is written in the same
 * transaction as every loan change, so the two should never disagree - but
 * "should never" is not "cannot", and a cache nobody checks is a cache that
 * quietly rots. This is the check.
 *
 * Run it after any incident involving the offline queue, and after any manual
 * SQL against these tables.
 *
 * Copies that are LOST, WITHDRAWN or in REPAIR are left alone: those states say
 * something about the physical book that no loan can tell you.
 */

import dotenv from 'dotenv';
import prisma from '../src/utils/prisma.js';

dotenv.config({ path: './.env' });

const fix = process.argv.includes('--fix');

async function main() {
  const copies = await prisma.bookCopy.findMany({
    where: { status: { in: ['AVAILABLE', 'ON_LOAN'] } },
    select: {
      id: true,
      barcode: true,
      status: true,
      loans: {
        where: { status: 'ACTIVE' },
        select: { id: true, student: { select: { name: true } } },
      },
    },
  });

  const shouldBeOnLoan = [];
  const shouldBeAvailable = [];

  for (const copy of copies) {
    const live = copy.loans.length > 0;
    if (live && copy.status !== 'ON_LOAN') shouldBeOnLoan.push(copy);
    if (!live && copy.status === 'ON_LOAN') shouldBeAvailable.push(copy);
  }

  console.log(`Checked ${copies.length} copies in circulation.\n`);

  if (shouldBeOnLoan.length === 0 && shouldBeAvailable.length === 0) {
    console.log('No drift. Every copy agrees with its loans.');
    return;
  }

  if (shouldBeOnLoan.length) {
    console.log(`${shouldBeOnLoan.length} marked available but actually out:`);
    for (const c of shouldBeOnLoan.slice(0, 20)) {
      console.log(`  ${c.barcode}  held by ${c.loans[0].student.name}`);
    }
    if (shouldBeOnLoan.length > 20) console.log(`  ...and ${shouldBeOnLoan.length - 20} more`);
  }

  if (shouldBeAvailable.length) {
    console.log(`\n${shouldBeAvailable.length} marked out but with no live loan:`);
    for (const c of shouldBeAvailable.slice(0, 20)) console.log(`  ${c.barcode}`);
    if (shouldBeAvailable.length > 20) console.log(`  ...and ${shouldBeAvailable.length - 20} more`);
  }

  if (!fix) {
    console.log('\nReport only. Re-run with --fix to correct the copies from the loans.');
    process.exitCode = 1; // so CI or a cron can notice
    return;
  }

  await prisma.$transaction([
    prisma.bookCopy.updateMany({ where: { id: { in: shouldBeOnLoan.map((c) => c.id) } }, data: { status: 'ON_LOAN' } }),
    prisma.bookCopy.updateMany({ where: { id: { in: shouldBeAvailable.map((c) => c.id) } }, data: { status: 'AVAILABLE' } }),
  ]);

  console.log(`\nCorrected ${shouldBeOnLoan.length + shouldBeAvailable.length} copies from the loan records.`);
}

main()
  .catch((error) => {
    console.error(`\nReconcile failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
