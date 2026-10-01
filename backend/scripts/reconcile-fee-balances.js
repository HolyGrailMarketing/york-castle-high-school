/**
 * Check FeeAssessment's cached totals against the payments, which are the
 * authoritative record.
 *
 *   npm run fees:reconcile            # report only
 *   npm run fees:reconcile -- --fix   # correct the assessments
 *
 * FeeAssessment.paidAmount and .status are derived caches of the FeePayment
 * rows beneath them, written by services/feeBalances.recomputeAssessment in the
 * same transaction as every payment, reversal, waive and cancel. The two should
 * never disagree - but "should never" is not "cannot", and a cache nobody
 * checks is a cache that quietly rots. This is the check that earns them.
 *
 * Run it after any manual SQL against these tables, and before the office takes
 * a balance list to a parent.
 *
 * A reversed payment is deliberately not money: it stays on the record with its
 * reason, and the sum below ignores it, exactly as recomputeAssessment does.
 */

import dotenv from 'dotenv';
import prisma from '../src/utils/prisma.js';
import { toCents, money, statusFor } from '../src/services/feeBalances.js';

dotenv.config({ path: './.env' });

const fix = process.argv.includes('--fix');

const fmt = (n) => Number(n).toLocaleString('en-JM', { minimumFractionDigits: 2 });

async function main() {
  const assessments = await prisma.feeAssessment.findMany({
    include: {
      student: { select: { name: true, studentProfile: { select: { formClass: true } } } },
      payments: { where: { reversedAt: null }, select: { amount: true } },
    },
  });

  const drifted = [];

  for (const a of assessments) {
    const actualPaid = toCents(a.payments.reduce((sum, p) => sum + money(p.amount), 0));
    const cachedPaid = toCents(money(a.paidAmount));
    const waived = toCents(money(a.waivedAmount));
    const total = toCents(money(a.totalAmount));

    const expectedStatus = statusFor({
      assessment: a, paidAmount: actualPaid, waivedAmount: waived, totalAmount: total,
    });

    if (actualPaid !== cachedPaid || expectedStatus !== a.status) {
      drifted.push({ a, actualPaid, cachedPaid, expectedStatus, waived, total });
    }
  }

  console.log(`Checked ${assessments.length} charge${assessments.length === 1 ? '' : 's'}.`);

  if (drifted.length === 0) {
    console.log('No drift. Every cached balance matches its payments.');
    return;
  }

  console.log(`\n${drifted.length} disagree with their payments:\n`);
  for (const d of drifted) {
    const who = `${d.a.student?.name ?? d.a.studentId}${d.a.student?.studentProfile?.formClass ? ` (${d.a.student.studentProfile.formClass})` : ''}`;
    const parts = [];
    if (d.actualPaid !== d.cachedPaid) parts.push(`paid cached ${fmt(d.cachedPaid)}, payments add to ${fmt(d.actualPaid)}`);
    if (d.expectedStatus !== d.a.status) parts.push(`status ${d.a.status}, should be ${d.expectedStatus}`);
    console.log(`  ${who} — ${d.a.kind} ${d.a.academicYear}${d.a.term ? ` term ${d.a.term}` : ''}: ${parts.join('; ')}`);
  }

  if (!fix) {
    console.log('\nRun with --fix to correct them.');
    return;
  }

  for (const d of drifted) {
    await prisma.feeAssessment.update({
      where: { id: d.a.id },
      data: { paidAmount: d.actualPaid, status: d.expectedStatus },
    });
  }
  console.log(`\nCorrected ${drifted.length}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
