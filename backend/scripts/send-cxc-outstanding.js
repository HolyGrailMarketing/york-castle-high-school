#!/usr/bin/env node

/**
 * Chase the approved students whose CXC results are still not on file.
 *
 * The results-released notice went out on 19 August, but most of it never
 * left: the send was unpaced and Resend rejected the excess, while the old
 * sendEmail recorded every rejection as a success. The notification log
 * therefore says all of these students were told, and it cannot be trusted.
 * What can be trusted is the application itself — a subject still carrying the
 * sentinel grade `Sitting`, or no grade at all, is a result the school does not
 * have.
 *
 *   node scripts/send-cxc-outstanding.js            # report only
 *   node scripts/send-cxc-outstanding.js --apply    # send
 *   node scripts/send-cxc-outstanding.js --all      # every applicant, not just approved
 */

import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { templates } = await import('../src/services/emailTemplates.js');
const { sendEmail, isEmailConfigured, initEmailService } = await import('../src/services/emailService.js');

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const everyone = process.argv.includes('--all');

const BASE_URL = process.env.FRONTEND_URL || process.env.APP_URL || 'https://yorkcastlehighschool.org';

/** The grade the application form writes for a subject still being sat. */
const PENDING_GRADE = 'Sitting';

const outstanding = (csecResults) => {
  const rows = Array.isArray(csecResults) ? csecResults : [];
  return rows.filter((r) => !r?.grade || r.grade === PENDING_GRADE).length;
};

async function main() {
  const applications = await prisma.sixthFormApplication.findMany({
    where: everyone ? {} : { status: 'APPROVED' },
    select: { id: true, firstName: true, lastName: true, email: true, faculty: true, status: true, csecResults: true },
    orderBy: [{ faculty: 'asc' }, { lastName: 'asc' }],
  });

  const chase = applications
    .map((a) => ({ app: a, missing: outstanding(a.csecResults) }))
    .filter((x) => x.missing > 0);

  console.log(`\n${applications.length} application(s) considered${everyone ? '' : ' (approved only)'}.`);
  console.log(`${chase.length} still carry subjects with no real grade.\n`);
  console.log('─'.repeat(78));
  for (const { app, missing } of chase) {
    const total = Array.isArray(app.csecResults) ? app.csecResults.length : 0;
    console.log(`  ${(app.firstName + ' ' + app.lastName).padEnd(26)}${(app.faculty || '—').padEnd(12)}${String(missing)}/${total} ungraded   ${app.email}`);
  }
  console.log('─'.repeat(78));
  console.log(`To send: ${chase.length}  (about ${Math.ceil(chase.length * 0.6)}s at the paced send rate)`);

  if (!apply) {
    console.log('\nDry run — nothing sent. Re-run with --apply.\n');
    await prisma.$disconnect();
    return;
  }

  initEmailService();
  if (!isEmailConfigured()) {
    console.error('\nABORTED: email is not configured. Nothing sent.\n');
    await prisma.$disconnect();
    process.exit(1);
  }

  const sentIds = [];
  const failed = [];
  console.log('');
  for (const { app } of chase) {
    const name = [app.firstName, app.lastName].filter(Boolean).join(' ') || 'Applicant';
    const built = templates.cxcResultsReleased(name, BASE_URL);
    try {
      await sendEmail(app.email, built.subject, built.text, built.html);
      sentIds.push(app.id);
      console.log(`  sent    ${app.email}`);
    } catch (error) {
      failed.push({ email: app.email, reason: error.message });
      console.error(`  FAILED  ${app.email}: ${error.message}`);
    }
  }

  // Only what actually went. The old code logged rejections as sends, which is
  // why the August record is worthless.
  if (sentIds.length > 0) {
    await prisma.sixthFormNotification.createMany({
      data: sentIds.map((applicationId) => ({
        applicationId,
        type: 'CXC_RESULTS_RELEASED',
        subject: templates.cxcResultsReleased('Applicant', BASE_URL).subject,
        sentBy: null,
      })),
    });
  }

  console.log(`\nSent ${sentIds.length} of ${chase.length}. Failed: ${failed.length}.`);
  if (failed.length) console.log(JSON.stringify(failed, null, 1));
  console.log('');
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('send-cxc-outstanding failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
