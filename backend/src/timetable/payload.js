/*
 * Lives under backend/src rather than scripts/ because the API imports it at
 * runtime, and vercel.json excludes `scripts/**` from the serverless function
 * bundle - a copy left in scripts/ would work locally and 404 in production.
 * The build scripts import it from here.
 */
/**
 * Build the payloads timetable.html reads.
 *
 * Two files come out of this, and the split is deliberate:
 *
 *   public  class timetables, including the teachers taking each lesson.
 *   staff   the above plus the per-teacher and per-room views and the
 *           lunch-duty roster.
 *
 * Teacher names on class lessons are published by the school's own decision
 * (2026-08-29). What stays behind the authenticated endpoint is the per-teacher
 * timetable and the lunch-duty roster: "who is where all week" is a different
 * thing from "who teaches this class".
 *
 * This lives on its own because there are two callers - the .fet build pipeline
 * and the database exporter - and they must produce byte-identical output for
 * the same timetable. Two implementations would drift, and the round-trip test
 * that proves the database loses nothing depends on them agreeing exactly.
 *
 * Keys are short (d/p/n/t/o/r/w) because this ships to every phone that opens
 * the page - the whole point is to replace a 1 MB export.
 */

import { displaySubject } from './subjects.js';
import { tidyName } from './names.js';

export class UnusedPeriodError extends Error {}

/**
 * @param data  { days, periods, years, groups, placements } - the parsed .fet
 *              shape, which the database exporter also reconstructs.
 * @param opts  { schoolYear, generatedAt, withPlacementIds }
 *
 * `withPlacementIds` adds each lesson's placement id to the STAFF payload only.
 * The editor needs it to move a lesson; the public page does not, and the files
 * written for the website deliberately leave it out so their content depends on
 * the timetable alone and not on database row ids.
 */
export function buildPayloads(data, { schoolYear, generatedAt = new Date().toISOString(), withPlacementIds = false } = {}) {
  const dayIndex = new Map(data.days.map((d, i) => [d, i]));

  const period = (p) => {
    const out = { id: p.id, label: p.label, start: p.start, end: p.end, kind: p.kind };
    if (p.altStart) { out.altStart = p.altStart; out.altEnd = p.altEnd; }
    if (p.lunchSitting) out.lunchSitting = p.lunchSitting;
    if (p.registration) out.registration = p.registration;
    if (p.timeAssumed) out.timeAssumed = true;
    return out;
  };

  // One lesson entry. `withTeachers` and `withIds` are the only differences.
  const lesson = (p, withTeachers, withIds = false) => {
    const s = displaySubject(p.subject);
    const out = { d: dayIndex.get(p.day), p: p.periodId, n: p.duration, t: s.title };
    if (s.options.length) out.o = s.options;
    if (s.isOptionBlock) out.b = 1;
    if (p.room) out.r = p.room;
    else if (p.candidateRooms?.length) out.r = p.candidateRooms.join(' / ');
    if (withTeachers && p.teachers.length) out.w = p.teachers.map(tidyName);
    if (withIds && p.placementId) out.i = p.placementId;
    return out;
  };

  const bySlot = (a, b) => a.d - b.d || a.p.localeCompare(b.p);
  const classLessons = data.placements.filter((p) => !p.staffOnly);

  const groupLessons = (withTeachers, withIds = false) => {
    const out = {};
    for (const g of data.groups) out[g] = [];
    for (const p of classLessons) {
      for (const g of p.groups) {
        if (!out[g]) out[g] = [];
        out[g].push(lesson(p, withTeachers, withIds));
      }
    }
    for (const g of Object.keys(out)) out[g].sort(bySlot);
    return out;
  };

  // Periods marked `unused` are empty leftovers in the FET grid and are not
  // published - but only once we have proved they really are empty, so a
  // timetable that starts using one fails loudly instead of losing lessons.
  for (const p of data.periods.filter((x) => x.unused)) {
    const used = data.placements.filter((x) => x.periodId === p.id);
    if (used.length) {
      throw new UnusedPeriodError(
        `${used.length} activit(ies) are scheduled in "${p.label}", which is marked unused. ` +
        'Give it a real start and end in scripts/timetable/periods.js (build-side) and drop the `unused` flag.');
    }
  }

  const base = {
    schoolYear,
    generatedAt,
    days: data.days,
    periods: data.periods.filter((p) => !p.unused).map(period),
    years: data.years,
  };

  const publicPayload = { ...base, lessons: groupLessons(true) };

  // Staff views: every placement, including the 367 lunch-duty and CPS entries
  // that never appear on a class timetable.
  const teacherLessons = {};
  const roomLessons = {};
  for (const p of data.placements) {
    const entry = lesson(p, true, withPlacementIds);
    entry.g = p.groups;
    if (p.staffOnly) entry.duty = true;
    // Keyed by the tidied name, so the staff view spells a teacher the same way
    // the lesson entries do.
    for (const t of p.teachers) (teacherLessons[tidyName(t)] ||= []).push(entry);
    if (p.room) (roomLessons[p.room] ||= []).push(entry);
  }
  for (const m of [teacherLessons, roomLessons]) {
    for (const k of Object.keys(m)) m[k].sort(bySlot);
  }

  // The staff class view is rebuilt rather than shared with the public one,
  // because only this side carries placement ids.
  const staffPayload = {
    ...base,
    lessons: withPlacementIds ? groupLessons(true, true) : publicPayload.lessons,
    teachers: teacherLessons,
    rooms: roomLessons,
  };

  return { publicPayload, staffPayload };
}
