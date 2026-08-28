#!/usr/bin/env node

/**
 * Record the decision for applicants who were not selected.
 *
 * Every application that matched a final candidate list is already APPROVED.
 * What remains at PENDING is, with a handful of exceptions, the applicants who
 * were not selected — this records that on their application so the decision is
 * on file and the "Unsuccessful Letter" can be sent to them.
 *
 *   node scripts/reject-unselected.js            # report only, changes nothing
 *   node scripts/reject-unselected.js --apply    # perform the update
 *
 * Note this is immediately visible to the student: application-status.html
 * renders REJECTED as "Not Successful" the moment the status changes, whether
 * or not any email has been sent.
 *
 * A JSON backup of every row's prior state is written in both modes.
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

/**
 * Addresses to leave alone: submissions made while building and testing the
 * portal. Rejecting them is harmless but pointless, and one is the
 * administrator's own — which would mail him a regret letter.
 *
 * Read from data/exclusions.json rather than hardcoded, because this repository
 * is public and those are real addresses. Missing file means no exclusions.
 */
const exclusionsPath = path.join(__dirname, 'data', 'exclusions.json');
const TEST_ACCOUNTS = new Set(
  fs.existsSync(exclusionsPath)
    ? JSON.parse(fs.readFileSync(exclusionsPath, 'utf8')).testAccounts.map((e) => e.toLowerCase())
    : []
);

const norm = (s) => (s || '').toLowerCase().trim().replace(/\s+/g, ' ');
const personOf = (a) => `${norm(a.firstName)}|${norm(a.lastName)}`;

async function main() {
  if (TEST_ACCOUNTS.size === 0) {
    console.log('\nNote: no scripts/data/exclusions.json found, so no addresses are being held back.');
  }

  const all = await prisma.sixthFormApplication.findMany({
    select: { id: true, firstName: true, lastName: true, email: true, status: true },
    orderBy: { submittedAt: 'asc' },
  });

  const approvedPeople = new Set(all.filter((a) => a.status === 'APPROVED').map(personOf));
  const pending = all.filter((a) => a.status === 'PENDING');

  const toReject = [];
  const skipped = [];

  for (const app of pending) {
    // A second, unapproved copy of somebody who was accepted. Rejecting it would
    // leave that student holding one APPROVED and one REJECTED application, and
    // whichever their status page happens to resolve to could tell an accepted
    // student they were turned down.
    if (approvedPeople.has(personOf(app))) {
      skipped.push({ app, why: 'duplicate row — this person is APPROVED on another application' });
      continue;
    }
    if (TEST_ACCOUNTS.has((app.email || '').toLowerCase())) {
      skipped.push({ app, why: 'test record' });
      continue;
    }
    toReject.push(app);
  }

  console.log(`\n${all.length} application(s): ${all.length - pending.length} already decided, ${pending.length} still PENDING.\n`);

  if (skipped.length > 0) {
    console.log(`EXCLUDED — ${skipped.length}, left at PENDING`);
    console.log('─'.repeat(78));
    for (const { app, why } of skipped) {
      console.log(`  ${(app.firstName + ' ' + app.lastName).padEnd(26)} ${(app.email || '').padEnd(34)} ${why}`);
    }
    console.log('');
  }

  // Both copies of a duplicated applicant would each be rejected, and each
  // would receive its own letter. Worth naming before that happens.
  const dupCounts = toReject.reduce((m, a) => m.set(personOf(a), (m.get(personOf(a)) || 0) + 1), new Map());
  const dupes = toReject.filter((a) => dupCounts.get(personOf(a)) > 1);
  if (dupes.length > 0) {
    console.log(`DUPLICATED APPLICANTS — ${dupes.length} rows for ${new Set(dupes.map(personOf)).size} people.`);
    console.log('Both copies will be rejected, and each would receive its own letter.');
    console.log('Run scripts/dedupe-sixth-form.js first if you would rather collapse them.');
    console.log('─'.repeat(78));
    for (const a of dupes) console.log(`  ${(a.firstName + ' ' + a.lastName).padEnd(26)} ${a.email}`);
    console.log('');
  }

  console.log('─'.repeat(78));
  console.log(`To mark REJECTED : ${toReject.length}`);
  console.log(`Left PENDING     : ${skipped.length}`);
  console.log(`Already APPROVED : ${all.length - pending.length}`);
  console.log('─'.repeat(78));

  if (toReject.length === 0) {
    console.log('\nNothing to do.\n');
    await prisma.$disconnect();
    return;
  }

  const backupDir = path.join(__dirname, 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    `reject-unselected-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  );
  fs.writeFileSync(backupPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    applied: apply,
    rejecting: toReject,
    skipped: skipped.map(({ app, why }) => ({ ...app, why })),
  }, null, 2));
  console.log(`\nBackup of prior state written to:\n  ${backupPath}`);

  if (!apply) {
    console.log('\nDry run — nothing was changed. Re-run with --apply to record the decision.\n');
    await prisma.$disconnect();
    return;
  }

  const reviewer = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } });
  if (!reviewer) {
    console.error('\nABORTED: no ADMIN user found to record as the reviewer. Nothing was changed.\n');
    await prisma.$disconnect();
    process.exit(1);
  }

  const result = await prisma.sixthFormApplication.updateMany({
    where: { id: { in: toReject.map((a) => a.id) } },
    data: { status: 'REJECTED', reviewedAt: new Date(), reviewedBy: reviewer.id },
  });

  console.log(`\nMarked ${result.count} application(s) REJECTED, reviewed by ${reviewer.name}.`);
  console.log(`${skipped.length} left at PENDING.`);
  console.log('These students now see "Not Successful" on their status page.\n');

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('reject-unselected failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
