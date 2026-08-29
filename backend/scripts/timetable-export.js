#!/usr/bin/env node
/**
 * Export the published timetable from the database to the files the public page
 * is built from.
 *
 * This is the publish path. The database is the source of truth; the office
 * edits it in the portal; this writes data/timetable-public.json, and the normal
 * build pre-renders timetable.html from that. The public page therefore keeps
 * working with JavaScript off - it never talks to an API.
 *
 * It reconstructs the same shape parse-fet.js produces and hands it to the same
 * buildPayloads() the .fet pipeline uses, so for a given timetable the output is
 * byte-identical either way. That equivalence is the test that the database has
 * not quietly lost anything.
 *
 * Run from backend/:
 *   node scripts/timetable-export.js [--year 2026-2027] [--out ../data]
 *   node scripts/timetable-export.js --check     compare only, write nothing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, '..', '.env') });

import { buildPayloads, UnusedPeriodError } from '../src/timetable/payload.js';

const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };
const checkOnly = argv.includes('--check');
const outDir = path.resolve(here, '..', '..', flag('out', 'data'));

const prisma = new PrismaClient();

const run = async () => {
  const where = { status: 'PUBLISHED', ...(flag('year') ? { schoolYear: flag('year') } : {}) };
  const version = await prisma.timetableVersion.findFirst({
    where,
    orderBy: { publishedAt: 'desc' },
    include: {
      periods: { orderBy: { sortOrder: 'asc' } },
      groups: { orderBy: { sortOrder: 'asc' } },
      activities: { include: { placement: true } },
    },
  });
  if (!version) {
    console.error('No PUBLISHED timetable version found' + (flag('year') ? ` for ${flag('year')}` : '') + '.');
    process.exit(1);
  }

  const periodIndex = new Map(version.periods.map((p, i) => [p.key, i]));

  // Rebuild the shape parse-fet.js emits, so payload.js cannot tell the two
  // sources apart.
  const data = {
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    periods: version.periods.map((p) => ({
      id: p.key,
      label: p.label,
      start: p.startTime ?? undefined,
      end: p.endTime ?? undefined,
      ...(p.altStart ? { altStart: p.altStart, altEnd: p.altEnd } : {}),
      ...(p.lunchSitting ? { lunchSitting: p.lunchSitting } : {}),
      ...(p.regStart ? { registration: { start: p.regStart, end: p.regEnd } } : {}),
      kind: p.kind,
      unused: p.unused,
      sourceLabel: p.sourceLabel ?? undefined,
    })),
    years: [],
    groups: version.groups.map((g) => g.name),
    placements: [],
  };

  // Years, in the order the groups were imported.
  const byYear = new Map();
  for (const g of version.groups) {
    if (!byYear.has(g.yearName)) byYear.set(g.yearName, { name: g.yearName, groups: [], undivided: g.undivided });
    byYear.get(g.yearName).groups.push(g.name);
  }
  data.years = [...byYear.values()];

  for (const a of version.activities) {
    if (!a.placement) continue;
    data.placements.push({
      activityId: a.sourceId ?? a.id,
      day: a.placement.day,
      periodId: a.placement.periodKey,
      periodIndex: periodIndex.get(a.placement.periodKey),
      duration: a.duration,
      subject: a.subject,
      teachers: a.teacherNames,
      groups: a.groupNames,
      students: a.groupNames,
      room: a.room,
      candidateRooms: a.room ? [a.room] : [],
      staffOnly: a.staffOnly,
    });
  }

  let payloads;
  try {
    payloads = buildPayloads(data, { schoolYear: version.schoolYear });
  } catch (e) {
    if (e instanceof UnusedPeriodError) { console.error(`\nREFUSING: ${e.message}`); process.exit(1); }
    throw e;
  }

  // generatedAt is the only field expected to differ run to run; ignore it when
  // comparing, and keep the existing one when nothing else changed so the file
  // does not churn in git.
  const sameBut = (a, b) => JSON.stringify({ ...a, generatedAt: '' }) === JSON.stringify({ ...b, generatedAt: '' });

  const results = [];
  for (const [name, payload] of [['timetable-public.json', payloads.publicPayload],
                                 ['timetable-staff.json', payloads.staffPayload]]) {
    const file = path.join(outDir, name);
    const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
    const unchanged = existing && sameBut(existing, payload);
    if (unchanged) payload.generatedAt = existing.generatedAt;
    if (!checkOnly) {
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(payload));
    }
    results.push({ name, unchanged: Boolean(unchanged), bytes: JSON.stringify(payload).length });
  }

  console.log(`Exported "${version.label}" (${version.schoolYear}, published ${version.publishedAt?.toISOString().slice(0, 10)})`);
  console.log(`  activities ${version.activities.length}  placements ${data.placements.length}` +
    `  periods ${version.periods.length}  groups ${version.groups.length}`);
  for (const r of results) {
    console.log(`  ${r.name.padEnd(24)}${(r.bytes / 1024).toFixed(0)} KB   ` +
      `${r.unchanged ? 'identical to what is on disk' : (checkOnly ? 'WOULD CHANGE' : 'written')}`);
  }
  if (checkOnly && results.some((r) => !r.unchanged)) process.exitCode = 1;
};

run().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
