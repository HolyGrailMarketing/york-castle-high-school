#!/usr/bin/env node

/**
 * Remove duplicate Sixth Form applications.
 *
 * Before `createSixthFormApplication` grew its one-application-per-email guard
 * (2026-07-22, after the July 20 deadline), a student who was unsure whether
 * their submission had gone through could simply fill the form in again. Some
 * did, two or three times. Those extra rows inflate the interview-readiness
 * counts in the admin dashboard, list the same student repeatedly, and leave
 * cxc-update.html saving results to whichever copy happens to be newest.
 *
 * This keeps one row per applicant and deletes the rest.
 *
 *   node scripts/dedupe-sixth-form.js            # report only, deletes nothing
 *   node scripts/dedupe-sixth-form.js --apply    # perform the deletion
 *
 * A JSON backup of every row that would be deleted is written in both modes,
 * so the backup always exists before --apply is ever considered.
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');

const norm = (s) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');

/** Identity of the person an application is for: name + date of birth. */
const identityOf = (app) =>
  [norm(app.firstName), norm(app.lastName), app.dateOfBirth?.toISOString().slice(0, 10)].join('|');

/**
 * How much of an application is filled in. Used to pick which copy to keep:
 * the fullest one, since a student re-filling the form often added more than
 * they had the first time. Ties fall to the newest submission.
 */
const OPTIONAL_FIELDS = [
  'address', 'gender', 'religion', 'nationality', 'previousSchool',
  'positionsHeld', 'careerGoals', 'strengthsWeaknesses', 'reasonForAttending',
];

const completeness = (app) =>
  OPTIONAL_FIELDS.filter((f) => app[f]).length +
  (Array.isArray(app.csecResults) ? app.csecResults.length : 0) +
  (app.guardianInfo ? 3 : 0) +
  (app.subjectChoices?.stream ? 5 : 0);

const fmtDate = (d) => (d ? d.toISOString().slice(0, 16).replace('T', ' ') : '—');

async function main() {
  const applications = await prisma.sixthFormApplication.findMany({
    include: {
      interview: { select: { id: true } },
      notifications: { select: { id: true, type: true, subject: true, sentAt: true } },
    },
    orderBy: { submittedAt: 'asc' },
  });

  const byEmail = new Map();
  for (const app of applications) {
    const key = (app.email || '').toLowerCase().trim();
    if (!byEmail.has(key)) byEmail.set(key, []);
    byEmail.get(key).push(app);
  }

  const toDelete = [];
  const skipped = [];
  const groups = [...byEmail.entries()].filter(([, rows]) => rows.length > 1);

  console.log(`\n${applications.length} application(s) total, ${byEmail.size} distinct email address(es).`);
  console.log(`${groups.length} address(es) carry more than one application.\n`);

  for (const [email, rows] of groups) {
    // Only ever collapse rows that are demonstrably the same person. Anything
    // else — two genuinely different applicants sharing an address — is
    // reported and left completely alone.
    const identities = new Set(rows.map(identityOf));
    if (identities.size > 1) {
      skipped.push({ email, rows });
      console.log(`SKIPPED  ${email} — ${identities.size} different applicants share this address:`);
      rows.forEach((r) => console.log(`           ${r.firstName} ${r.lastName}  dob=${r.dateOfBirth?.toISOString().slice(0, 10)}`));
      console.log('           Left untouched. Resolve by hand.\n');
      continue;
    }

    const ranked = [...rows].sort(
      (a, b) => completeness(b) - completeness(a) || b.submittedAt - a.submittedAt
    );
    const keep = ranked[0];
    const drop = ranked.slice(1);

    console.log(`${rows[0].firstName} ${rows[0].lastName}  <${email}>`);
    for (const r of rows) {
      const verdict = r.id === keep.id ? 'KEEP  ' : 'DELETE';
      const csec = Array.isArray(r.csecResults) ? r.csecResults.length : 0;
      console.log(
        `   ${verdict}  submitted=${fmtDate(r.submittedAt)}  csec=${String(csec).padStart(2)}` +
        `  stream=${(r.subjectChoices?.stream || '—').padEnd(12)}  score=${String(completeness(r)).padStart(2)}` +
        `  notifs=${r.notifications.length}${r.interview ? '  INTERVIEW ON FILE' : ''}`
      );
    }
    console.log('');
    toDelete.push(...drop);
  }

  // An interview record on a row being deleted would mean losing interview
  // notes. There are none today, but never silently destroy one if that changes.
  const withInterview = toDelete.filter((r) => r.interview);
  if (withInterview.length > 0) {
    console.error(
      `\nABORTED: ${withInterview.length} row(s) marked for deletion have an interview record.\n` +
      'Resolve those by hand — no rows have been deleted.\n'
    );
    withInterview.forEach((r) => console.error(`   ${r.firstName} ${r.lastName} <${r.email}> id=${r.id}`));
    await prisma.$disconnect();
    process.exit(1);
  }

  const notifCount = toDelete.reduce((n, r) => n + r.notifications.length, 0);

  console.log('─'.repeat(72));
  console.log(`Applications to delete : ${toDelete.length}`);
  console.log(`Applicants remaining   : ${applications.length - toDelete.length}`);
  console.log(`Groups skipped         : ${skipped.length}`);
  console.log(`Notification rows that cascade with them: ${notifCount}`);
  console.log('  (each duplicate holds its own copy of the same bulk sends; the surviving row keeps its own)');
  console.log('─'.repeat(72));

  if (toDelete.length === 0) {
    console.log('\nNothing to do.\n');
    await prisma.$disconnect();
    return;
  }

  const backupDir = path.join(__dirname, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    `sixth-form-dedupe-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  );
  fs.writeFileSync(backupPath, JSON.stringify(toDelete, null, 2));
  console.log(`\nBackup of every row above written to:\n  ${backupPath}\n`);

  if (!apply) {
    console.log('Dry run — nothing was deleted. Re-run with --apply to perform the deletion.\n');
    await prisma.$disconnect();
    return;
  }

  const result = await prisma.sixthFormApplication.deleteMany({
    where: { id: { in: toDelete.map((r) => r.id) } },
  });
  console.log(`Deleted ${result.count} duplicate application(s).\n`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('dedupe-sixth-form failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
