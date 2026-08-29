#!/usr/bin/env node
/**
 * Turn a FET .fet file into the JSON that timetable.html reads.
 *
 * Why parse the .fet rather than FET's exported HTML: the export is 1 MB of
 * presentation spread over four redundant views, and it drops the structure we
 * need (which activity is which, what is a class vs. a staff duty). The .fet is
 * the source of truth and is a third of the size.
 *
 * Two things worth knowing about this particular file:
 *
 *  - Every active activity is pinned to an exact day and hour by a
 *    ConstraintActivityPreferredStartingTime at 100% weight. FET is being used
 *    to validate and render a hand-built timetable, not to generate one, so the
 *    placements here are simply read off those constraints.
 *
 *  - Roughly half the active activities carry no <Students> at all. Those are
 *    staff lunch duty and CPS roster entries, not lessons. They are kept, but
 *    flagged `staffOnly` so the public page never shows them and the teacher
 *    view still can.
 *
 * Usage:
 *   node scripts/timetable/parse-fet.js <input.fet> [output.json]
 */

import fs from 'fs';
import path from 'path';
import { PERIODS, isStaffRosterSubject } from './periods.js';

// --- tiny XML helpers -------------------------------------------------------
// The .fet is machine-written, flat, and never uses attributes or CDATA, so
// scanning for tags is safe here and avoids adding an XML dependency.

const decode = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

const blocks = (xml, tag) => {
  const out = [];
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g');
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
};

const one = (xml, tag) => {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? decode(m[1]) : null;
};

const many = (xml, tag) => blocks(xml, tag).map(decode);

const section = (xml, tag) => {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1] : '';
};

// --- parse ------------------------------------------------------------------

export function parseFet(xml) {
  const warnings = [];

  const days = many(section(xml, 'Days_List'), 'Name');
  const hourNames = many(section(xml, 'Hours_List'), 'Name');

  // Map each FET hour name onto our normalised period. Order comes from the
  // .fet, not from PERIODS, because placements index into the FET grid.
  const periods = hourNames.map((sourceLabel, index) => {
    const known = PERIODS.find((p) => p.sourceLabel === sourceLabel);
    if (!known) {
      warnings.push(
        `Unrecognised period ${JSON.stringify(sourceLabel)} - add it to scripts/timetable/periods.js`
      );
      return { id: `hour-${index}`, sourceLabel, label: sourceLabel.trim(), kind: 'class', index };
    }
    return { ...known, index };
  });
  const periodByLabel = new Map(periods.map((p) => [p.sourceLabel, p]));

  // Years hold groups. Activities reference either, so we need year -> groups
  // to put a whole-year lesson on each class's timetable.
  //
  // Grades 11, 12 and 13 are not divided into groups at all - the year IS the
  // class, and every lesson is attached to the year name. (FET's own export
  // invents an "11 Automatic Group" label for this at render time; there is no
  // such group in the file.) Those years map to themselves, otherwise their
  // lessons would expand to an empty group list and vanish.
  const years = [];
  const groupsOfYear = new Map();
  for (const y of blocks(section(xml, 'Students_List'), 'Year')) {
    const name = one(y, 'Name');
    const declared = blocks(y, 'Group').map((g) => one(g, 'Name'));
    const groups = declared.length ? declared : [name];
    years.push({ name, groups, undivided: declared.length === 0 });
    groupsOfYear.set(name, groups);
  }
  // Natural order: 7, 8, 9, 10, 11, 12, 13 - the .fet lists 10 first.
  years.sort((a, b) => Number(a.name) - Number(b.name) || a.name.localeCompare(b.name));
  const allGroups = years.flatMap((y) => y.groups);

  const teachers = many(section(xml, 'Teachers_List'), 'Name');
  const subjects = many(section(xml, 'Subjects_List'), 'Name');
  const rooms = many(section(xml, 'Rooms_List'), 'Name');

  // Activities
  const activities = new Map();
  for (const a of blocks(section(xml, 'Activities_List'), 'Activity')) {
    const id = one(a, 'Id');
    const subject = one(a, 'Subject') || '';
    const students = many(a, 'Students');
    activities.set(id, {
      id,
      subject,
      teachers: many(a, 'Teacher'),
      students,
      duration: parseInt(one(a, 'Duration') || '1', 10),
      active: one(a, 'Active') === 'true',
      // No student set + a lunch/CPS subject means a staff duty, not a lesson.
      staffOnly: students.length === 0 && isStaffRosterSubject(subject),
    });
  }

  // Rooms come from constraints, never from the activity itself in this file.
  const roomOfActivity = new Map();
  for (const c of blocks(xml, 'ConstraintActivityPreferredRoom')) {
    if (one(c, 'Active') !== 'true') continue;
    roomOfActivity.set(one(c, 'Activity_Id'), one(c, 'Room'));
  }
  const roomsOfSubject = new Map();
  for (const c of blocks(xml, 'ConstraintSubjectPreferredRooms')) {
    if (one(c, 'Active') !== 'true') continue;
    roomsOfSubject.set(one(c, 'Subject'), many(c, 'Preferred_Room'));
  }

  // Placements: every active activity is pinned by one of these.
  const placements = [];
  for (const c of blocks(xml, 'ConstraintActivityPreferredStartingTime')) {
    if (one(c, 'Active') !== 'true') continue;
    const activityId = one(c, 'Activity_Id');
    const activity = activities.get(activityId);
    if (!activity || !activity.active) continue;

    const day = one(c, 'Day');
    const period = periodByLabel.get(one(c, 'Hour'));
    if (!period) {
      warnings.push(`Activity ${activityId} placed at unknown hour ${JSON.stringify(one(c, 'Hour'))}`);
      continue;
    }

    const room = roomOfActivity.get(activityId) || null;
    const candidateRooms = room ? [room] : roomsOfSubject.get(activity.subject) || [];

    // A group reference stays as-is; a year reference expands to its groups so
    // "Grade 10 does Maths" lands on 10Y, 10O, 10R, 10K and 10S alike.
    const groups = [];
    for (const s of activity.students) {
      if (groupsOfYear.has(s)) groups.push(...groupsOfYear.get(s));
      else groups.push(s);
    }

    placements.push({
      activityId,
      day,
      periodId: period.id,
      periodIndex: period.index,
      duration: activity.duration,
      subject: activity.subject,
      teachers: activity.teachers,
      students: activity.students,
      groups: [...new Set(groups)],
      room,
      candidateRooms,
      staffOnly: activity.staffOnly,
    });
  }

  return {
    days,
    periods,
    years,
    groups: allGroups,
    teachers,
    subjects,
    rooms,
    activities: [...activities.values()],
    placements,
    warnings,
  };
}

// --- validation -------------------------------------------------------------

/**
 * Replays every placement across the slots it occupies and reports anyone
 * booked twice. A multi-period activity occupies consecutive periods, so a
 * 2-period lesson starting at Period 1 also fills Period 2.
 */
export function findClashes(data) {
  const slots = new Map();
  const key = (day, index) => `${day}|${index}`;

  for (const p of data.placements) {
    for (let k = 0; k < p.duration; k += 1) {
      const index = p.periodIndex + k;
      if (index >= data.periods.length) continue;
      const id = key(p.day, index);
      if (!slots.has(id)) slots.set(id, []);
      slots.get(id).push(p);
    }
  }

  const clashes = [];
  for (const [id, entries] of slots) {
    const [day, index] = id.split('|');
    const period = data.periods[Number(index)];
    const seen = { teacher: new Map(), group: new Map(), room: new Map() };

    for (const p of entries) {
      for (const t of new Set(p.teachers)) push(seen.teacher, t, p);
      for (const g of new Set(p.groups)) push(seen.group, g, p);
      if (p.room) push(seen.room, p.room, p);
    }

    for (const kind of ['teacher', 'group', 'room']) {
      for (const [who, list] of seen[kind]) {
        if (list.length > 1) {
          clashes.push({
            kind,
            who,
            day,
            period: period.label,
            activities: list.map((p) => ({ id: p.activityId, subject: p.subject })),
          });
        }
      }
    }
  }
  return clashes;

  function push(map, k, v) {
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(v);
  }
}

// --- cli --------------------------------------------------------------------

const isMain = process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`;

if (isMain) {
  const input = process.argv[2];
  const output = process.argv[3] || 'data/timetable.json';
  if (!input) {
    console.error('usage: node scripts/timetable/parse-fet.js <input.fet> [output.json]');
    process.exit(1);
  }

  const data = parseFet(fs.readFileSync(input, 'utf8'));
  const clashes = findClashes(data);

  const classPlacements = data.placements.filter((p) => !p.staffOnly);
  const staffPlacements = data.placements.filter((p) => p.staffOnly);

  console.log('Parsed', path.basename(input));
  console.log(`  days              ${data.days.length}`);
  console.log(`  periods           ${data.periods.length}`);
  console.log(`  years / groups    ${data.years.length} / ${data.groups.length}`);
  console.log(`  teachers          ${data.teachers.length}`);
  console.log(`  subjects          ${data.subjects.length}`);
  console.log(`  rooms             ${data.rooms.length}`);
  console.log(`  activities        ${data.activities.length} (${data.activities.filter((a) => a.active).length} active)`);
  console.log(`  placements        ${data.placements.length}`);
  console.log(`    class lessons   ${classPlacements.length}`);
  console.log(`    staff roster    ${staffPlacements.length}`);

  const assumed = data.periods.filter((p) => p.timeAssumed);
  if (assumed.length) {
    console.log('\n  Periods with an inferred time (confirm with the office):');
    for (const p of assumed) console.log(`    ${p.label}  ${p.start}-${p.end}`);
  }

  const unused = data.periods.filter((p) => p.unused);
  if (unused.length) {
    console.log('\n  Empty periods, not published:');
    for (const p of unused) {
      const n = data.placements.filter((x) => x.periodId === p.id).length;
      console.log(`    ${p.label}  ${n} placement(s)`);
    }
  }

  for (const w of data.warnings) console.warn(`  WARNING ${w}`);

  if (clashes.length) {
    console.error(`\n  ${clashes.length} CLASH(ES) FOUND - refusing to write output`);
    for (const c of clashes.slice(0, 20)) {
      console.error(`    ${c.kind} ${JSON.stringify(c.who)} @ ${c.day} ${c.period}: ` +
        c.activities.map((a) => `${a.id} ${a.subject}`).join(' | '));
    }
    process.exit(1);
  }
  console.log('\n  clashes           0  (teacher, group and room all clear)');

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(data, null, 2));
  console.log(`\nWrote ${output} (${(fs.statSync(output).size / 1024).toFixed(0)} KB)`);
}
