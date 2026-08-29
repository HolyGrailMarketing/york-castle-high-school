#!/usr/bin/env node

/**
 * Re-send the acceptance letters and invitations that Resend never accepted.
 *
 * A bulk run fired five requests at a time with no pacing. Resend rejected the
 * excess with 429, and because its SDK reports API errors in the return value
 * rather than by throwing, every rejection was recorded as a successful send:
 * 68 acceptance letters and 30 invitations were reported delivered and never
 * left. emailService now checks that return value and paces sends, so this
 * script exists to deliver what was lost.
 *
 *   node scripts/resend-failed.js            # report only, sends nothing
 *   node scripts/resend-failed.js --apply    # send
 *
 * Recipients are computed by asking Resend what it actually accepted, not by
 * trusting our own logs — the logs are what got this wrong.
 *
 * Invitations reuse each student's existing invite row. Issuing a new one
 * revokes the old, which would break the links of the 22 students whose email
 * did arrive.
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { templates } = await import('../src/services/emailTemplates.js');
const { sendEmail, isEmailConfigured, initEmailService } = await import('../src/services/emailService.js');
const { INVITE_EXPIRY } = await import('../src/utils/inviteToken.js');

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

const BASE_URL = process.env.FRONTEND_URL || process.env.APP_URL || 'https://yorkcastlehighschool.org';

/** Must match ACCEPTANCE_DEFAULTS in the admin dashboard's send dialog. */
const ACCEPTANCE = {
  collectionStart: '2026-09-01',
  collectionEnd: '2026-09-04',
  openFrom: '9:00 a.m.',
  openTo: '3:00 p.m.',
  cost: '$3,500',
};

const APPLY_BY_TEXT = INVITE_EXPIRY.toLocaleDateString('en-JM', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Jamaica',
});
const APPLY_BY_SHORT = INVITE_EXPIRY.toLocaleDateString('en-JM', {
  day: 'numeric', month: 'long', timeZone: 'America/Jamaica',
});

/** Addresses Resend confirms it accepted, one file per send. */
const alreadyReceived = (file) => {
  const p = path.join(__dirname, 'data', file);
  if (!fs.existsSync(p)) {
    console.error(`\nABORTED: ${p} not found. It lists the addresses Resend actually accepted.`);
    console.error('Rebuild it from the Resend log before re-sending, or every recipient looks unsent.\n');
    process.exit(1);
  }
  return new Set(fs.readFileSync(p, 'utf8').split('\n').map((s) => s.trim().toLowerCase()).filter(Boolean));
};

async function main() {
  const gotAcceptance = alreadyReceived('received-acceptance.txt');
  const gotInvite = alreadyReceived('received-invite.txt');

  const approved = await prisma.sixthFormApplication.findMany({
    where: { status: 'APPROVED' },
    select: { id: true, firstName: true, lastName: true, email: true, faculty: true },
  });
  const missingAcceptance = approved.filter((a) => !gotAcceptance.has(a.email.toLowerCase()));

  // Live invites only: revoked or expired rows must not be re-sent.
  const invites = await prisma.sixthFormInvite.findMany({
    where: { revokedAt: null, expiresAt: { gt: new Date() } },
    select: { token: true, email: true, firstName: true, lastName: true, faculty: true },
  });
  const missingInvite = invites.filter((i) => !gotInvite.has(i.email.toLowerCase()));

  console.log(`\nACCEPTANCE LETTERS  approved ${approved.length} | confirmed sent ${gotAcceptance.size} | to send ${missingAcceptance.length}`);
  console.log(`INVITATIONS         live invites ${invites.length} | confirmed sent ${gotInvite.size} | to send ${missingInvite.length}`);
  console.log(`\nAt roughly 1.7 emails a second this takes about ${Math.ceil((missingAcceptance.length + missingInvite.length) * 0.6)}s.`);

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

  const failed = [];
  const sentAcceptanceIds = [];

  // Sequential, not batched: sendEmail paces itself, and a per-recipient result
  // is the whole point of this run.
  console.log('\nAcceptance letters:');
  for (const app of missingAcceptance) {
    const name = [app.firstName, app.lastName].filter(Boolean).join(' ') || 'Applicant';
    const built = templates.sixthFormAcceptanceLetter(name, ACCEPTANCE, app.faculty);
    try {
      await sendEmail(app.email, built.subject, built.text, built.html);
      sentAcceptanceIds.push(app.id);
    } catch (error) {
      failed.push({ kind: 'acceptance', email: app.email, reason: error.message });
      console.error(`  FAILED ${app.email}: ${error.message}`);
    }
  }
  console.log(`  sent ${sentAcceptanceIds.length} of ${missingAcceptance.length}`);

  // Only log what actually went, which is the fix for how this happened.
  if (sentAcceptanceIds.length > 0) {
    const subject = templates.sixthFormAcceptanceLetter('Applicant', ACCEPTANCE, null).subject;
    await prisma.sixthFormNotification.createMany({
      data: sentAcceptanceIds.map((applicationId) => ({
        applicationId, type: 'ACCEPTANCE_LETTER', subject, sentBy: null,
      })),
    });
  }

  console.log('\nInvitations:');
  let invitesSent = 0;
  for (const inv of missingInvite) {
    const url = `${BASE_URL}/sixth-form-application.html?invite=${encodeURIComponent(inv.token)}`;
    const built = templates.sixthFormAcceptanceInvite(
      inv.firstName, url, inv.faculty, APPLY_BY_TEXT, ACCEPTANCE, APPLY_BY_SHORT
    );
    try {
      await sendEmail(inv.email, built.subject, built.text, built.html);
      invitesSent += 1;
    } catch (error) {
      failed.push({ kind: 'invite', email: inv.email, reason: error.message });
      console.error(`  FAILED ${inv.email}: ${error.message}`);
    }
  }
  console.log(`  sent ${invitesSent} of ${missingInvite.length}`);

  console.log(`\nTotal sent: ${sentAcceptanceIds.length + invitesSent}. Failed: ${failed.length}.`);
  if (failed.length > 0) console.log(JSON.stringify(failed, null, 1));
  console.log('');

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('resend-failed failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
