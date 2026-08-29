#!/usr/bin/env node
/**
 * Build the payloads timetable.html reads, from the parsed .fet data.
 *
 * The payload shaping itself lives in payload.js, because the database exporter
 * (backend/scripts/timetable-export.js) has to produce byte-identical output for
 * the same timetable — that equivalence is what proves the database round-trips
 * without losing anything.
 *
 * Usage:
 *   node scripts/timetable/build-public.js [parsed.json] [outdir]
 */

import fs from 'fs';
import path from 'path';
import { buildPayloads, UnusedPeriodError } from '../../backend/src/timetable/payload.js';

const input = process.argv[2] || 'data/timetable-2026-2027.json';
const outDir = process.argv[3] || 'data';
const schoolYear = (path.basename(input).match(/(\d{4}-\d{4})/) || [, 'unknown'])[1];

const data = JSON.parse(fs.readFileSync(input, 'utf8'));

let payloads;
try {
  payloads = buildPayloads(data, { schoolYear });
} catch (e) {
  if (e instanceof UnusedPeriodError) {
    console.error(`\nREFUSING: ${e.message}`);
    process.exit(1);
  }
  throw e;
}
const { publicPayload, staffPayload } = payloads;

fs.mkdirSync(outDir, { recursive: true });
const write = (name, payload) => {
  const file = path.join(outDir, name);
  fs.writeFileSync(file, JSON.stringify(payload));
  return `${name.padEnd(24)} ${(fs.statSync(file).size / 1024).toFixed(0)} KB`;
};

console.log(write('timetable-public.json', publicPayload));
console.log(write('timetable-staff.json', staffPayload));

// Teacher names are intentionally part of the public payload; report the
// coverage so a build that silently loses them is obvious.
const lessons = Object.values(publicPayload.lessons).flat();
console.log(`\nlessons naming a teacher: ${lessons.filter((l) => l.w?.length).length} of ${lessons.length}`);
console.log(`classes: ${Object.keys(publicPayload.lessons).length}  ` +
  `teachers: ${Object.keys(staffPayload.teachers).length}  rooms: ${Object.keys(staffPayload.rooms).length}`);

// Likely typos in the source subject names - the office should fix these in FET,
// we deliberately do not silently rewrite them here.
const SUSPECT = ['Literatrue', 'Agicultural', 'Managenent', 'Basic /'];
const typos = [...new Set(data.placements.filter((p) => !p.staffOnly).map((p) => p.subject))]
  .filter((s) => SUSPECT.some((w) => s.includes(w)));
if (typos.length) {
  console.log('\nProbable typos in FET subject names (report to the office):');
  for (const t of typos) console.log(`  ${t}`);
}
