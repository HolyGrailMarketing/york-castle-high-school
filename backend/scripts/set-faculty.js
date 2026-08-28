#!/usr/bin/env node

/**
 * Record which faculty each accepted student has been placed in.
 *
 * The final candidate lists are grouped by faculty — Business, Humanities,
 * Science, Technical — and that grouping is the placement decision, not a copy
 * of what the applicant asked for. `subjectChoices` holds the request;
 * `faculty` holds where they are actually going, and for at least one student
 * the two differ.
 *
 *   node scripts/set-faculty.js            # report only, changes nothing
 *   node scripts/set-faculty.js --apply    # write the faculty
 *
 * Uses the same matcher as apply-final-lists.js, so the students who get a
 * faculty are exactly the ones who were approved. Re-running is safe: it only
 * writes rows whose faculty is missing or different.
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
    select: { id: true, firstName: true, lastName: true, email: true, status: true, faculty: true },
  });

  const { matched, unmatched } = reconcile(candidates, applications);

  const toSet = matched.filter((m) => m.app.faculty !== m.cand.list);
  const alreadySet = matched.length - toSet.length;

  // A faculty on an application nobody accepted would be a matching error, so
  // say so rather than quietly leaving it.
  const strayFaculty = applications.filter(
    (a) => a.faculty && !matched.some((m) => m.app.id === a.id)
  );

  console.log(`\n${candidates.length} accepted candidate(s); ${matched.length} have an application, ${unmatched.length} do not.\n`);

  const byFaculty = {};
  for (const m of matched) byFaculty[m.cand.list] = (byFaculty[m.cand.list] || 0) + 1;
  console.log('FACULTY PLACEMENT');
  console.log('─'.repeat(60));
  for (const [f, n] of Object.entries(byFaculty).sort()) {
    const listed = candidates.filter((c) => c.list === f).length;
    console.log(`  ${f.padEnd(11)} ${String(n).padStart(3)} of ${String(listed).padStart(3)} placed have an application`);
  }
  console.log('─'.repeat(60));
  console.log(`  To write   : ${toSet.length}`);
  console.log(`  Unchanged  : ${alreadySet}`);
  console.log(`  No application, so no faculty recorded: ${unmatched.length}`);
  console.log('─'.repeat(60));

  if (strayFaculty.length > 0) {
    console.log(`\nFACULTY SET ON ${strayFaculty.length} APPLICATION(S) THAT MATCH NO LIST — investigate:`);
    strayFaculty.forEach((a) => console.log(`  ${a.firstName} ${a.lastName} <${a.email}> = ${a.faculty}`));
  }

  if (toSet.length === 0) {
    console.log('\nNothing to do.\n');
    await prisma.$disconnect();
    return;
  }

  if (!apply) {
    console.log('\nDry run — nothing was written. Re-run with --apply.\n');
    await prisma.$disconnect();
    return;
  }

  // One statement per faculty rather than per student: four updateMany calls
  // instead of eighty-nine round trips over the pooler.
  const byValue = toSet.reduce((groups, x) => {
    (groups[x.cand.list] = groups[x.cand.list] || []).push(x.app.id);
    return groups;
  }, {});
  await prisma.$transaction(
    Object.entries(byValue).map(([faculty, ids]) =>
      prisma.sixthFormApplication.updateMany({ where: { id: { in: ids } }, data: { faculty } })
    )
  );

  console.log(`\nRecorded a faculty on ${toSet.length} application(s).\n`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('set-faculty failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
