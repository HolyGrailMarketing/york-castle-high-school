#!/usr/bin/env node

/**
 * Invite the candidates who were accepted at interview but never applied online.
 *
 * The August 25 interviews ran on paper. Candidates who were accepted there but
 * never submitted the online form have no application on file, so they are
 * invisible to every downstream process — including the bulk notifier, which
 * resolves recipients by application id and so structurally cannot reach them.
 *
 * This emails each of them their acceptance and a personal link that opens the
 * closed application form for their address alone. Acceptance and the call to
 * apply travel together because the bulk ACCEPTANCE_LETTER cannot reach these
 * students at all: it resolves recipients from SixthFormApplication and refuses
 * anyone who is not APPROVED, and they have no application row to find.
 *
 *   node scripts/send-application-invites.js                # report only, sends nothing
 *   node scripts/send-application-invites.js --render-only  # also write the composed email to a file
 *   node scripts/send-application-invites.js --apply        # send
 *   node scripts/send-application-invites.js --base=https://…  # override the link host
 *   node scripts/send-application-invites.js --collect-from=2026-09-01 --cost='$4,000'
 *
 * Recipients are recomputed against the live database every run, so anyone who
 * has applied since the last send is dropped automatically and nobody is chased
 * twice. A JSON log of every recipient and the link they were issued is written
 * in all modes — SixthFormNotification cannot hold these, since its
 * applicationId is a required foreign key to a row that does not exist yet.
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { reconcile } from './lib/match-candidates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { templates } = await import('../src/services/emailTemplates.js');
const { sendEmail, isEmailConfigured, initEmailService } = await import('../src/services/emailService.js');
const { signInviteToken, INVITE_EXPIRY } = await import('../src/utils/inviteToken.js');

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const renderOnly = process.argv.includes('--render-only');
const baseArg = process.argv.find((a) => a.startsWith('--base='))?.split('=')[1];

/** Matches getBaseUrl()'s production result, which is what sent emails already use. */
const BASE_URL = baseArg || process.env.FRONTEND_URL || process.env.APP_URL || 'https://yorkcastlehighschool.org';

/** Send concurrency, matching NOTIFY_BATCH_SIZE in sixthFormController.js. */
const BATCH_SIZE = 5;

/** The date the invite link stops working, worded for the email. */
const APPLY_BY_TEXT = INVITE_EXPIRY.toLocaleDateString('en-JM', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Jamaica',
});

/** Same date, short enough for a subject line. */
const APPLY_BY_SHORT = INVITE_EXPIRY.toLocaleDateString('en-JM', {
  day: 'numeric', month: 'long', timeZone: 'America/Jamaica',
});

const flag = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;

/**
 * Welcome Package details, repeated from ACCEPTANCE_DEFAULTS in
 * admin-dashboard/src/pages/SixthFormApplications.tsx. That dialog is the
 * source of truth for the bulk acceptance letter, and these two must agree —
 * some students will read one and some the other. Override with the flags
 * rather than editing, so a corrected date does not need a code change.
 */
const ACCEPTANCE = {
  collectionStart: flag('collect-from', '2026-09-01'),
  collectionEnd: flag('collect-to', '2026-09-04'),
  openFrom: flag('open-from', '9:00 a.m.'),
  openTo: flag('open-to', '3:00 p.m.'),
  cost: flag('cost', '$3,500'),
};

/**
 * Addresses we refuse to send to. A structurally valid address is not
 * necessarily a safe one: "gmai.com" is a typosquat of Gmail, so mailing it
 * would hand a student's name and acceptance to whoever owns that domain
 * rather than bouncing. Correct the address in data/final-lists-2026.json and
 * re-run to invite them.
 */
const TYPOSQUAT_DOMAINS = new Set([
  'gmai.com', 'gmial.com', 'gmail.co', 'gnail.com', 'gmaill.com',
  'yaho.com', 'yahooo.com', 'hotmial.com', 'outlok.com',
]);

const emailProblem = (email) => {
  const e = (email || '').trim();
  if (!e) return 'no email address on the list';
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e)) return `malformed address "${e}"`;
  const domain = e.toLowerCase().split('@')[1];
  if (TYPOSQUAT_DOMAINS.has(domain)) return `"${domain}" looks like a typo for a real provider`;
  return null;
};

async function main() {
  const listPath = path.join(__dirname, 'data', 'final-lists-2026.json');
  if (!fs.existsSync(listPath)) {
    console.error(
      `\nABORTED: ${listPath} not found.\n` +
      'It is deliberately not in the repository — it holds students\' names and\n' +
      'addresses, and this repo is public. See scripts/data/README.md to rebuild it\n' +
      'from the final candidate list CSVs.\n'
    );
    process.exit(1);
  }
  const candidates = JSON.parse(fs.readFileSync(listPath, 'utf8'));

  const applications = await prisma.sixthFormApplication.findMany({
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  const { matched, unmatched } = reconcile(candidates, applications);

  console.log(`\n${candidates.length} candidate(s) on the final lists; ${applications.length} application(s) on file.`);
  console.log(`${matched.length} have applied. ${unmatched.length} have not.\n`);

  const sendable = [];
  const blocked = [];
  for (const cand of unmatched) {
    const problem = emailProblem(cand.email);
    if (problem) blocked.push({ cand, problem });
    else sendable.push(cand);
  }

  if (blocked.length > 0) {
    console.log(`CANNOT BE EMAILED — ${blocked.length}. Reach these by phone, or fix the address and re-run.`);
    console.log('─'.repeat(72));
    for (const { cand, problem } of blocked) {
      console.log(`  ${cand.list.padEnd(11)} ${(cand.surname + ', ' + cand.firstname).padEnd(28)} ${problem}`);
    }
    console.log('');
  }

  const recipients = sendable.map((cand) => {
    const token = signInviteToken({
      email: cand.email,
      firstName: cand.firstname,
      lastName: cand.surname,
      list: cand.list,
    });
    return { cand, url: `${BASE_URL}/sixth-form-application.html?invite=${encodeURIComponent(token)}` };
  });

  console.log(`TO INVITE — ${recipients.length}`);
  console.log('─'.repeat(72));
  for (const list of ['Technical', 'Science', 'Humanities', 'Business']) {
    const rows = recipients.filter((r) => r.cand.list === list);
    if (rows.length === 0) continue;
    console.log(`  ${list} (${rows.length}):`);
    for (const r of rows) {
      console.log(`     ${(r.cand.surname + ', ' + r.cand.firstname).padEnd(28)} ${r.cand.email}`);
    }
  }
  console.log('');
  console.log('─'.repeat(72));
  console.log(`Invites to send  : ${recipients.length}`);
  console.log(`Flagged for staff: ${blocked.length}`);
  console.log(`Apply by         : ${APPLY_BY_TEXT}`);
  console.log(`Collect between  : ${ACCEPTANCE.collectionStart} to ${ACCEPTANCE.collectionEnd}, ${ACCEPTANCE.openFrom}-${ACCEPTANCE.openTo}`);
  console.log(`Package cost     : ${ACCEPTANCE.cost}`);
  console.log(`Link host        : ${BASE_URL}`);
  console.log('─'.repeat(72));

  const logDir = path.join(__dirname, 'backups');
  fs.mkdirSync(logDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  // Every generated link is recorded so a student whose email bounces can still
  // be given theirs by hand, without minting a second one.
  const logPath = path.join(logDir, `application-invites-${stamp}.json`);
  fs.writeFileSync(logPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    sent: apply,
    baseUrl: BASE_URL,
    expiresAt: INVITE_EXPIRY.toISOString(),
    acceptance: ACCEPTANCE,
    recipients: recipients.map((r) => ({ ...r.cand, inviteUrl: r.url })),
    blocked: blocked.map(({ cand, problem }) => ({ ...cand, problem })),
  }, null, 2));
  console.log(`\nRun log (includes every invite link) written to:\n  ${logPath}`);

  if (renderOnly && recipients.length > 0) {
    const sample = recipients[0];
    const built = templates.sixthFormAcceptanceInvite(
      sample.cand.firstname, sample.url, sample.cand.list, APPLY_BY_TEXT, ACCEPTANCE, APPLY_BY_SHORT
    );
    const htmlPath = path.join(logDir, `application-invite-preview-${stamp}.html`);
    fs.writeFileSync(htmlPath, built.html);
    console.log(`\nSubject: ${built.subject}`);
    console.log(`Preview (addressed to ${sample.cand.firstname} ${sample.cand.surname}) written to:\n  ${htmlPath}`);
  }

  if (!apply) {
    console.log('\nDry run — no email was sent. Re-run with --apply to send.\n');
    await prisma.$disconnect();
    return;
  }

  initEmailService();
  if (!isEmailConfigured()) {
    console.error('\nABORTED: email is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL). Nothing was sent.\n');
    await prisma.$disconnect();
    process.exit(1);
  }

  let sent = 0;
  const failed = [];
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((r) => {
      const built = templates.sixthFormAcceptanceInvite(
        r.cand.firstname, r.url, r.cand.list, APPLY_BY_TEXT, ACCEPTANCE, APPLY_BY_SHORT
      );
      return sendEmail(r.cand.email, built.subject, built.text, built.html);
    }));
    // One bad address must not strand the rest of the list.
    results.forEach((result, n) => {
      if (result.status === 'fulfilled') {
        sent++;
      } else {
        failed.push({ email: batch[n].cand.email, reason: result.reason?.message });
        console.error(`  FAILED  ${batch[n].cand.email}: ${result.reason?.message}`);
      }
    });
  }

  console.log(`\nSent ${sent} invite(s).`);
  if (failed.length > 0) {
    console.log(`${failed.length} failed — their links are in the run log and can be sent by hand.`);
  }
  console.log('');

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('send-application-invites failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
