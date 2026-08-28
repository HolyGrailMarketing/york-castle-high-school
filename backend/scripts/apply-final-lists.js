#!/usr/bin/env node

/**
 * Apply the final sixth-form candidate lists to application status.
 *
 * Selection produced four lists — Technical, Science, Humanities and Business
 * (scripts/data/final-lists-2026.json, transcribed verbatim from the CSVs).
 * This marks every applicant named on a list APPROVED so application-status.html
 * shows them their result. Everyone else is left PENDING and untouched.
 *
 *   node scripts/apply-final-lists.js            # report only, writes nothing
 *   node scripts/apply-final-lists.js --apply    # perform the update
 *   node scripts/apply-final-lists.js --reviewer=someone@moeschools.edu.jm
 *
 * The lists and the database do not line up cleanly. Emails on the lists often
 * differ from the email a student applied with (different domain, a stray dot,
 * a parent's address), so matching on email alone silently drops around a fifth
 * of the intake. Matching runs in confidence tiers instead, and anything that
 * does not reach a tier is reported for a human rather than guessed at — a
 * surname alone is never enough, or "Miller, Ajani" would approve one of six
 * unrelated Millers.
 *
 * A JSON backup of every row's prior state is written in both modes, so the
 * backup always exists before --apply is ever considered.
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

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const reviewerArg = process.argv.find((a) => a.startsWith('--reviewer='))?.split('=')[1];

/** Marks the interview rows this import creates, so staff never read them as a real panel's notes. */
const IMPORT_MARKER = 'Created by the final candidate list import. Not a recorded interview.';

const LISTS = ['Technical', 'Science', 'Humanities', 'Business'];

const streamOf = (app) =>
  app.subjectChoices?.preferredStream || app.subjectChoices?.firstChoice || '—';

/** Does the stream a student applied for agree with the list they were selected onto? */
const LEGACY_EQUIVALENT = {
  Science: 'natural-sciences',
  Technical: 'industrial-tech',
  Business: 'entrepreneurship',
  Humanities: 'law',
};
const streamAgrees = (list, stream) => {
  const s = (stream || '').toLowerCase();
  return s === list.toLowerCase() || s === LEGACY_EQUIVALENT[list];
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
    include: { interview: { select: { id: true } } },
    orderBy: { submittedAt: 'asc' },
  });

  console.log(`\n${candidates.length} candidate(s) across ${LISTS.length} list(s); ` +
    `${applications.length} application(s) on file.\n`);

  const { matched, unmatched } = reconcile(candidates, applications, {
    onConflict: (cand, prior, app) => {
      console.error(
        `CONFLICT: "${cand.surname}, ${cand.firstname}" (${cand.list}) and ` +
        `"${prior.surname}, ${prior.firstname}" (${prior.list}) both match ` +
        `${app.firstName} ${app.lastName} <${app.email}>.\n` +
        '          Both left unmatched. Resolve by hand.'
      );
    },
  });

  // Per-list tally.
  console.log('LIST TOTALS');
  console.log('─'.repeat(72));
  for (const list of LISTS) {
    const on = candidates.filter((c) => c.list === list).length;
    const ok = matched.filter((m) => m.cand.list === list).length;
    const no = unmatched.filter((c) => c.list === list).length;
    console.log(`  ${list.padEnd(12)} on list ${String(on).padStart(3)}   matched ${String(ok).padStart(3)}   no application ${String(no).padStart(3)}`);
  }
  console.log('─'.repeat(72));
  console.log(`  ${'TOTAL'.padEnd(12)} on list ${String(candidates.length).padStart(3)}   matched ${String(matched.length).padStart(3)}   no application ${String(unmatched.length).padStart(3)}\n`);

  // Matches that were not a straight email hit — these need a human to sign off.
  const nearMatches = matched.filter((m) => m.tier > 1);
  if (nearMatches.length > 0) {
    console.log(`MATCHED ON NAME, NOT EMAIL — ${nearMatches.length} to check before --apply`);
    console.log('─'.repeat(72));
    for (const m of nearMatches) {
      console.log(`  ${m.cand.list.padEnd(11)} ${(m.cand.surname + ', ' + m.cand.firstname).padEnd(28)} [${m.how}]`);
      console.log(`              list: ${m.cand.firstname} ${m.cand.surname} <${m.cand.email || 'no email on list'}>`);
      console.log(`              file: ${m.app.firstName} ${m.app.lastName} <${m.app.email}>`);
    }
    console.log('');
  }

  // Selected onto a list that disagrees with the stream they applied for.
  const streamConflicts = matched.filter((m) => !streamAgrees(m.cand.list, streamOf(m.app)));
  if (streamConflicts.length > 0) {
    console.log(`STREAM CONFLICTS — ${streamConflicts.length} (approved on the list's authority; the application is left as-is)`);
    console.log('─'.repeat(72));
    for (const m of streamConflicts) {
      console.log(`  ${(m.cand.surname + ', ' + m.cand.firstname).padEnd(28)} on the ${m.cand.list} list, applied for "${streamOf(m.app)}"`);
    }
    console.log('');
  }

  if (unmatched.length > 0) {
    console.log(`NO APPLICATION ON FILE — ${unmatched.length}. Not approved; chase these offline.`);
    console.log('─'.repeat(72));
    for (const list of LISTS) {
      const rows = unmatched.filter((c) => c.list === list);
      if (rows.length === 0) continue;
      console.log(`  ${list} (${rows.length}):`);
      for (const c of rows) {
        console.log(`     ${(c.surname + ', ' + c.firstname).padEnd(28)} ${c.email || '(no email on list)'}`);
      }
    }
    console.log('');
  }

  const alreadyApproved = matched.filter((m) => m.app.status === 'APPROVED');
  // Somebody has since made a different decision about these — a hold, a
  // withdrawal — and this script must not quietly reverse it on a re-run. It
  // promotes applications that are still awaiting a decision, nothing else.
  const decidedOtherwise = matched.filter(
    (m) => m.app.status !== 'PENDING' && m.app.status !== 'APPROVED'
  );
  const toApprove = matched.filter((m) => m.app.status === 'PENDING');
  const withInterview = matched.filter((m) => m.app.interview).length;

  if (decidedOtherwise.length > 0) {
    console.log(`ALREADY DECIDED OTHERWISE — ${decidedOtherwise.length}, left exactly as they are`);
    console.log('─'.repeat(72));
    for (const m of decidedOtherwise) {
      console.log(`  ${(m.cand.surname + ', ' + m.cand.firstname).padEnd(28)} ${m.app.status.padEnd(13)} <${m.app.email}>`);
    }
    console.log('');
  }

  console.log('─'.repeat(72));
  console.log(`Applications to approve       : ${toApprove.length}`);
  console.log(`Already APPROVED (no change)  : ${alreadyApproved.length}`);
  console.log(`Decided otherwise (untouched) : ${decidedOtherwise.length}`);
  console.log(`Interview records to create   : ${matched.length - withInterview}`);
  console.log(`Left PENDING, untouched       : ${applications.length - matched.length}`);
  console.log('─'.repeat(72));

  if (matched.length === 0) {
    console.log('\nNothing to do.\n');
    await prisma.$disconnect();
    return;
  }

  // Backup carries the prior state of every row this run would touch, so the
  // change can be undone from the file alone.
  const backupDir = path.join(__dirname, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `apply-final-lists-${stamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    applied: apply,
    approving: matched.map((m) => ({
      id: m.app.id,
      list: m.cand.list,
      matchedBy: m.how,
      listName: `${m.cand.firstname} ${m.cand.surname}`,
      listEmail: m.cand.email,
      prior: {
        firstName: m.app.firstName,
        lastName: m.app.lastName,
        email: m.app.email,
        status: m.app.status,
        reviewedAt: m.app.reviewedAt,
        reviewedBy: m.app.reviewedBy,
        hadInterview: Boolean(m.app.interview),
      },
    })),
    unmatched,
  }, null, 2));
  console.log(`\nBackup of prior state written to:\n  ${backupPath}\n`);

  if (!apply) {
    console.log('Dry run — nothing was written. Re-run with --apply to perform the update.\n');
    await prisma.$disconnect();
    return;
  }

  // updateSixthFormStatus refuses to approve an application with no interview on
  // file. Rather than route around that rule, create the interview record the
  // rule is asking for — clearly marked so nobody mistakes it for panel notes.
  const reviewer = await prisma.user.findFirst({
    where: reviewerArg
      ? { email: { equals: reviewerArg, mode: 'insensitive' } }
      : { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
  });
  if (!reviewer) {
    console.error(
      `\nABORTED: no ${reviewerArg ? `user "${reviewerArg}"` : 'ADMIN user'} found to record as the reviewer.` +
      '\nNothing was written.\n'
    );
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log(`Recording ${reviewer.name} <${reviewer.email}> as the reviewer.\n`);

  const now = new Date();
  await prisma.$transaction([
    prisma.sixthFormApplication.updateMany({
      where: { id: { in: toApprove.map((m) => m.app.id) } },
      data: { status: 'APPROVED', reviewedAt: now, reviewedBy: reviewer.id },
    }),
    prisma.sixthFormInterview.createMany({
      data: toApprove
        .filter((m) => !m.app.interview)
        .map((m) => ({
          applicationId: m.app.id,
          studentName: `${m.app.firstName} ${m.app.lastName}`,
          decision: 'RECOMMEND',
          comments: `${IMPORT_MARKER} Selected onto the ${m.cand.list} list.`,
          createdByName: reviewer.name,
        })),
      skipDuplicates: true,
    }),
  ]);

  console.log(`Approved ${toApprove.length} application(s).`);
  console.log(`Created ${toApprove.filter((m) => !m.app.interview).length} interview record(s).`);
  console.log(`${applications.length - matched.length} application(s) left PENDING.\n`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('apply-final-lists failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
