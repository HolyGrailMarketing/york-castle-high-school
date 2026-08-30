/*
 * Lives under backend/src rather than scripts/ because the API imports it at
 * runtime, and vercel.json excludes `scripts/**` from the serverless function
 * bundle - a copy left in scripts/ would work locally and 404 in production.
 * The build scripts import it from here.
 */
/**
 * Timetable clash detection - the single implementation.
 *
 * This is the check the Stage 1 verification trusts (it is what proved the
 * hand-built 2026-2027 timetable has 0 teacher, group and room collisions), so
 * the importer, the API's validate endpoint and the admin editor all call this
 * rather than each growing their own copy. A second implementation would drift,
 * and a clash check that disagrees with itself is worse than none.
 *
 * Input is deliberately plain data, not Prisma rows, so the same function works
 * on a freshly parsed .fet, on a version read out of the database, and on the
 * editor's in-memory state:
 *
 *   periods:    [{ ... }]                  order matters; index is the slot number
 *   placements: [{ day, periodIndex, duration, teachers[], groups[], room,
 *                  activityId, subject }]
 *
 * Reported kinds are 'teacher', 'group' and 'room' - two things in one slot -
 * plus 'fit', for a multi-period lesson that runs off the end of the day.
 */

/**
 * Replays every placement across the slots it occupies and reports anyone booked
 * twice. A multi-period activity occupies consecutive periods, so a 2-period
 * lesson starting at Period 1 also fills Period 2 - miss that and overlapping
 * doubles look clash-free.
 */
export function findClashes({ periods, placements }) {
  const slots = new Map();
  const push = (map, k, v) => {
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(v);
  };

  const clashes = [];

  for (const p of placements) {
    for (let k = 0; k < (p.duration || 1); k += 1) {
      const index = p.periodIndex + k;
      // A lesson longer than the day has left is not "clash-free" - it has
      // nowhere to put its second half. Skipping the slot silently made a
      // double period in the last slot look fine.
      if (index >= periods.length) {
        clashes.push({
          kind: 'fit',
          who: p.subject,
          day: p.day,
          period: periods[p.periodIndex]?.label ?? String(p.periodId ?? p.periodIndex),
          periodId: periods[p.periodIndex]?.id ?? p.periodId,
          activities: [{ id: p.activityId, subject: p.subject }],
        });
        break;
      }
      push(slots, `${p.day}|${index}`, p);
    }
  }

  for (const [id, entries] of slots) {
    if (entries.length < 2) continue;          // nothing can collide on its own
    const [day, index] = id.split('|');
    const period = periods[Number(index)];
    const seen = { teacher: new Map(), group: new Map(), room: new Map() };

    for (const p of entries) {
      for (const t of new Set(p.teachers || [])) push(seen.teacher, t, p);
      for (const g of new Set(p.groups || [])) push(seen.group, g, p);
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
            periodId: period.id,
            activities: list.map((p) => ({ id: p.activityId, subject: p.subject })),
          });
        }
      }
    }
  }
  return clashes;
}

/**
 * Would placing `moving` at (day, periodIndex) collide with anything? Used by the
 * editor to warn before a move is saved, so it must answer the same way
 * findClashes would afterwards.
 */
export function clashesForMove({ periods, placements }, moving, day, periodIndex) {
  const others = placements.filter((p) => p.activityId !== moving.activityId);
  const candidate = { ...moving, day, periodIndex };
  return findClashes({ periods, placements: [...others, candidate] })
    .filter((c) => c.activities.some((a) => a.id === moving.activityId));
}
