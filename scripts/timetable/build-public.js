#!/usr/bin/env node
/**
 * Build the payloads timetable.html reads, from the parsed .fet data.
 *
 * Two files come out of this, and the split is deliberate:
 *
 *   timetable-public.json  class timetables, including the teachers taking each
 *                          lesson.
 *   timetable-staff.json   the above plus the per-teacher and per-room views and
 *                          the lunch-duty roster.
 *
 * Teacher names on class lessons are published by the school's own decision
 * (2026-08-29) - they are already public on the school's GitHub Pages timetable
 * and in the .fet it offers for download. What stays behind the Stage 2
 * authenticated endpoint is the per-teacher timetable and the lunch-duty roster:
 * "who is where all week" is a different thing from "who teaches this class".
 *
 * Keys are short (d/p/n/t/o/r) because this ships to every phone that opens the
 * page - the whole point is to replace a 1 MB export.
 *
 * Usage:
 *   node scripts/timetable/build-public.js [parsed.json] [outdir]
 */

import fs from 'fs';
import path from 'path';
import { displaySubject } from './subjects.js';

const input = process.argv[2] || 'data/timetable-2026-2027.json';
const outDir = process.argv[3] || 'data';
const schoolYear = (path.basename(input).match(/(\d{4}-\d{4})/) || [, 'unknown'])[1];

const data = JSON.parse(fs.readFileSync(input, 'utf8'));
const dayIndex = new Map(data.days.map((d, i) => [d, i]));

// FET's teacher names carry stray runs of spaces and trailing spaces
// ("Gordon   M", "Cummings "), and exactly one - "Salmon, J" - has a stray comma
// where every other name is "Surname Initial". FET's own export hides that by
// splitting teacher lists on commas; we separate with a middot instead, so it
// would show. Punctuation and whitespace only - no spelling is touched.
const tidyName = (n) => n.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();

const period = (p) => {
  const out = { id: p.id, label: p.label, start: p.start, end: p.end, kind: p.kind };
  if (p.altStart) { out.altStart = p.altStart; out.altEnd = p.altEnd; }
  if (p.lunchSitting) out.lunchSitting = p.lunchSitting;
  if (p.registration) out.registration = p.registration;
  if (p.timeAssumed) out.timeAssumed = true;
  return out;
};

// One lesson entry. `withTeachers` is the only difference between the two files.
const lesson = (p, withTeachers) => {
  const s = displaySubject(p.subject);
  const out = { d: dayIndex.get(p.day), p: p.periodId, n: p.duration, t: s.title };
  if (s.options.length) out.o = s.options;
  if (s.isOptionBlock) out.b = 1;
  if (p.room) out.r = p.room;
  else if (p.candidateRooms.length) out.r = p.candidateRooms.join(' / ');
  if (withTeachers && p.teachers.length) out.w = p.teachers.map(tidyName);
  return out;
};

const bySlot = (a, b) => a.d - b.d || a.p.localeCompare(b.p);

const classLessons = data.placements.filter((p) => !p.staffOnly);

const groupLessons = (withTeachers) => {
  const out = {};
  for (const g of data.groups) out[g] = [];
  for (const p of classLessons) {
    for (const g of p.groups) {
      if (!out[g]) out[g] = [];
      out[g].push(lesson(p, withTeachers));
    }
  }
  for (const g of Object.keys(out)) out[g].sort(bySlot);
  return out;
};

// Periods marked `unused` are empty leftovers in the FET grid and are not
// published - but only once we have proved they really are empty, so a timetable
// that starts using one fails the build instead of silently losing lessons.
const unused = data.periods.filter((p) => p.unused);
for (const p of unused) {
  const used = data.placements.filter((x) => x.periodId === p.id);
  if (used.length) {
    console.error(`\nREFUSING: ${used.length} activit(ies) are scheduled in "${p.label}", ` +
      'which scripts/timetable/periods.js marks as unused.');
    console.error('  Give it a real start and end there, and drop the `unused` flag.');
    process.exit(1);
  }
}

const base = {
  schoolYear,
  generatedAt: new Date().toISOString(),
  days: data.days,
  periods: data.periods.filter((p) => !p.unused).map(period),
  years: data.years,
};

// --- public -----------------------------------------------------------------

const publicPayload = { ...base, lessons: groupLessons(true) };

// --- staff ------------------------------------------------------------------

const teacherLessons = {};
const roomLessons = {};
for (const p of data.placements) {
  const entry = lesson(p, true);
  entry.g = p.groups;
  entry.duty = p.staffOnly || undefined;
  for (const t of p.teachers) (teacherLessons[t] ||= []).push(entry);
  if (p.room) (roomLessons[p.room] ||= []).push(entry);
}
for (const m of [teacherLessons, roomLessons]) {
  for (const k of Object.keys(m)) m[k].sort(bySlot);
}

const staffPayload = {
  ...base,
  lessons: groupLessons(true),
  teachers: teacherLessons,
  rooms: roomLessons,
};

// --- write ------------------------------------------------------------------

fs.mkdirSync(outDir, { recursive: true });
const write = (name, payload) => {
  const file = path.join(outDir, name);
  fs.writeFileSync(file, JSON.stringify(payload));
  return `${name.padEnd(24)} ${(fs.statSync(file).size / 1024).toFixed(0)} KB`;
};

console.log(write('timetable-public.json', publicPayload));
console.log(write('timetable-staff.json', staffPayload));

// Teacher names are now intentionally part of the public payload; report the
// coverage so a build that silently loses them is obvious.
const withTeacher = Object.values(publicPayload.lessons)
  .flat().filter((l) => l.w && l.w.length).length;
const totalLessons = Object.values(publicPayload.lessons).flat().length;
console.log(`\nlessons naming a teacher: ${withTeacher} of ${totalLessons}`);

console.log(`classes: ${Object.keys(publicPayload.lessons).length}  ` +
  `teachers: ${Object.keys(teacherLessons).length}  rooms: ${Object.keys(roomLessons).length}`);

// Likely typos in the source subject names - the office should fix these in FET,
// we deliberately do not silently rewrite them here.
const SUSPECT = ['Literatrue', 'Agicultural', 'Managenent', 'Basic /'];
const typos = [...new Set(classLessons.map((p) => p.subject))].filter((s) =>
  SUSPECT.some((w) => s.includes(w))
);
if (typos.length) {
  console.log('\nProbable typos in FET subject names (report to the office):');
  for (const t of typos) console.log(`  ${t}`);
}
