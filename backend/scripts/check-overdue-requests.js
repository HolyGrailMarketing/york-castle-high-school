/**
 * Escalate document requests that have run past the turnaround promised on
 * doc-request.html.
 *
 * In production this runs from Vercel Cron via GET /api/cron/overdue-requests.
 * This script does the same work from the command line - for manual runs, for
 * testing, and for deployments that use system cron or PM2 instead of Vercel.
 *
 *   npm run check:overdue            # send escalations
 *   npm run check:overdue -- --dry   # report only, send nothing
 */

import dotenv from 'dotenv';
import { initEmailService, isEmailConfigured } from '../src/services/emailService.js';
import { escalateOverdueRequests, findOverdueRequests } from '../src/services/overdueRequestService.js';
import { dueDateFor, slaLabelFor, documentTypeOf } from '../src/services/requestSla.js';
import { extractRequester } from '../src/utils/helpers.js';
import prisma from '../src/utils/prisma.js';

dotenv.config({ path: './.env' });

const dryRun = process.argv.includes('--dry');

async function main() {
  initEmailService();

  if (dryRun) {
    const overdue = await findOverdueRequests();
    console.log(`\n${overdue.length} overdue document request(s) would be escalated:\n`);
    for (const request of overdue) {
      const { name } = extractRequester(request);
      console.log(
        `  ${documentTypeOf(request) || request.title} for ${name}\n` +
        `    submitted ${new Date(request.createdAt).toISOString().slice(0, 10)}` +
        ` · promised ${slaLabelFor(request)}` +
        ` · due ${dueDateFor(request).toISOString().slice(0, 10)}\n` +
        `    id ${request.id}`
      );
    }
    console.log('\nDry run - no email sent, nothing marked as escalated.\n');
    return;
  }

  if (!isEmailConfigured()) {
    console.error('Email service is not configured (RESEND_API_KEY missing). Nothing sent.');
    process.exitCode = 1;
    return;
  }

  const result = await escalateOverdueRequests();
  console.log(
    `Checked: ${result.checked} · Escalated: ${result.escalated}` +
    (result.recipients?.length ? ` · Sent to: ${result.recipients.join(', ')}` : '')
  );
}

main()
  .catch((error) => {
    console.error('Overdue request check failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
