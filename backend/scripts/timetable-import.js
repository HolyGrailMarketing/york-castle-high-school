#!/usr/bin/env node
/**
 * Import a FET .fet file into the database as a new DRAFT version.
 *
 * This is the bridge off the FET round-trip: after this, the office edits the
 * timetable in the portal and the .fet is only needed when someone wants to run
 * FET's solver again.
 *
 * Reuses parseFet() and findClashes() rather than re-reading the .fet its own
 * way, so the database can only ever contain what the Stage 1 verification
 * already checks against FET's own export.
 *
 * Usage:
 * Run from backend/:
 *   node scripts/timetable-import.js <file.fet> [--year 2026-2027] [--label "..."]
 *   node scripts/timetable-import.js <file.fet> --publish   (also publish it)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Lives under backend/ so `@prisma/client` resolves to the generated client,
// the way every other database script here does; the parser stays where the
// build pipeline keeps it.
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(here, '..', '.env') });

import { findClashes } from '../src/timetable/clashes.js';
const { parseFet } = await import('../../scripts/timetable/parse-fet.js');

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const has = (name) => argv.includes(`--${name}`);

const input = argv.find((a) => !a.startsWith('--') && a.endsWith('.fet'));
if (!input) {
  console.error('usage (from backend/): node scripts/timetable-import.js <file.fet> [--year Y] [--label L] [--publish]');
  process.exit(1);
}

const schoolYear = flag('year') || (path.basename(input).match(/(\d{4})[-\s]*(\d{4})/) || []).slice(1, 3).join('-') || 'unknown';
const label = flag('label') || `Imported from ${path.basename(input)}`;

const prisma = new PrismaClient();

const run = async () => {
  const data = parseFet(fs.readFileSync(input, 'utf8'));

  // The same gate the build uses: a timetable with a double-booking must not
  // reach the database, where it would be published from.
  const clashes = findClashes(data);
  if (clashes.length) {
    console.error(`\nREFUSING: ${clashes.length} clash(es) in ${path.basename(input)}`);
    for (const c of clashes.slice(0, 10)) {
      console.error(`  ${c.kind} ${JSON.stringify(c.who)} @ ${c.day} ${c.period}`);
    }
    process.exit(1);
  }
  for (const w of data.warnings) console.warn(`  WARNING ${w}`);

  const placementByActivity = new Map(data.placements.map((p) => [p.activityId, p]));

  const version = await prisma.$transaction(async (tx) => {
    const v = await tx.timetableVersion.create({
      data: {
        schoolYear,
        label,
        status: 'DRAFT',
        sourceFile: path.basename(input),
        notes: `${data.activities.length} activities, ${data.placements.length} placements, 0 clashes at import.`,
      },
    });

    await tx.timetablePeriod.createMany({
      data: data.periods.map((p, i) => ({
        versionId: v.id,
        key: p.id,
        label: p.label,
        sortOrder: i,
        startTime: p.start ?? null,
        endTime: p.end ?? null,
        altStart: p.altStart ?? null,
        altEnd: p.altEnd ?? null,
        kind: p.kind,
        lunchSitting: p.lunchSitting ?? null,
        regStart: p.registration?.start ?? null,
        regEnd: p.registration?.end ?? null,
        unused: Boolean(p.unused),
        sourceLabel: p.sourceLabel ?? null,
      })),
    });

    await tx.timetableGroup.createMany({
      data: data.years.flatMap((y, yi) =>
        y.groups.map((g, gi) => ({
          versionId: v.id, name: g, yearName: y.name,
          undivided: Boolean(y.undivided), sortOrder: yi * 100 + gi,
        }))),
    });

    // The FET spelling is the key. teacherId stays null - linking these to the
    // site's own Teacher records is a judgement call for staff, not a guess for
    // an import to make.
    await tx.timetableTeacher.createMany({
      data: data.teachers.map((name) => ({ versionId: v.id, name })),
    });
    await tx.timetableRoom.createMany({
      data: data.rooms.map((name) => ({ versionId: v.id, name })),
    });

    // Bulk insert. Creating 821 activities and 789 placements one row at a time
    // is ~1600 round-trips to a hosted database and does not finish inside a
    // sensible transaction timeout; createMany makes it three.
    await tx.timetableActivity.createMany({
      data: data.activities.map((a) => {
        const placed = placementByActivity.get(a.id);
        return {
          versionId: v.id,
          sourceId: a.id,
          subject: a.subject,
          duration: a.duration,
          isActive: a.active,
          staffOnly: Boolean(a.staffOnly),
          room: placed?.room ?? null,
          teacherNames: a.teachers,
          groupNames: placed ? placed.groups : a.students,
        };
      }),
    });

    // createMany cannot return ids, so map them back through sourceId - which is
    // the FET <Id>, unique within a version.
    const created = await tx.timetableActivity.findMany({
      where: { versionId: v.id },
      select: { id: true, sourceId: true },
    });
    const idBySource = new Map(created.map((a) => [a.sourceId, a.id]));

    await tx.timetablePlacement.createMany({
      data: data.placements
        .filter((p) => idBySource.has(p.activityId))
        .map((p) => ({
          versionId: v.id,
          activityId: idBySource.get(p.activityId),
          day: p.day,
          periodKey: p.periodId,
        })),
    });

    return v;
  }, { timeout: 120000 });

  if (has('publish')) {
    await prisma.$transaction([
      prisma.timetableVersion.updateMany({
        where: { schoolYear, status: 'PUBLISHED', NOT: { id: version.id } },
        data: { status: 'ARCHIVED' },
      }),
      prisma.timetableVersion.update({
        where: { id: version.id },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
      }),
    ]);
  }

  const counts = {
    periods: await prisma.timetablePeriod.count({ where: { versionId: version.id } }),
    groups: await prisma.timetableGroup.count({ where: { versionId: version.id } }),
    teachers: await prisma.timetableTeacher.count({ where: { versionId: version.id } }),
    rooms: await prisma.timetableRoom.count({ where: { versionId: version.id } }),
    activities: await prisma.timetableActivity.count({ where: { versionId: version.id } }),
    placements: await prisma.timetablePlacement.count({ where: { versionId: version.id } }),
  };

  console.log(`\nImported ${path.basename(input)} as ${has('publish') ? 'PUBLISHED' : 'DRAFT'}`);
  console.log(`  version    ${version.id}`);
  console.log(`  schoolYear ${schoolYear}`);
  for (const [k, n] of Object.entries(counts)) console.log(`  ${k.padEnd(11)}${n}`);
  console.log('  clashes    0');
};

run()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
