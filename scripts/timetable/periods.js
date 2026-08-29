/**
 * The school's bell schedule, recovered from the FET `Hours_List`.
 *
 * FET's "hours" are just names, and York Castle has been using those names to
 * carry prose - two bell times in one label, lunch sittings, registration
 * windows, and one period ("CPS Session") with no time at all. That is fine for
 * a human reading a printed grid, but it means nothing downstream can sort
 * periods, work out what is on now, or emit a calendar feed.
 *
 * So the messy source label stays the join key (`sourceLabel` - it is what every
 * placement in the .fet refers to), and everything a machine needs is spelled
 * out beside it. Times are 24-hour so they sort correctly; the raw labels are
 * 12-hour with no am/pm, which puts "1:40" before "8:00".
 *
 * `timeAssumed: true` marks a period whose real time is NOT recorded anywhere in
 * the .fet and that we inferred. Those need confirming with the office before
 * the calendar feed can be trusted.
 */

export const PERIODS = [
  {
    id: 'registration-am',
    sourceLabel: '8:00-8:20 ',
    label: 'Morning Registration',
    start: '08:00',
    end: '08:20',
    kind: 'registration',
  },
  {
    id: 'p1',
    sourceLabel: '8:20-9:20( Mon.-Fri. -8:50-9:35)',
    label: 'Period 1',
    start: '08:20',
    end: '09:20',
    // The source label carries a second set of times. Both are written
    // "Mon.-Fri.", so this is not a per-day variation - it is a second bell
    // pattern (most likely the shortened/assembly day) folded into one label.
    altStart: '08:50',
    altEnd: '09:35',
    kind: 'class',
  },
  {
    id: 'p2',
    sourceLabel: '9:20-10:20:40 ((Mon - Fri: 9:35-10:20) ',
    label: 'Period 2',
    // The label reads "9:20-10:20:40", which is not a time. Period 3's break
    // starts at 10:20, so the intended end is 10:20 and the stray ":40" is a
    // typo carried over from the break slot "10:20-10:40".
    start: '09:20',
    end: '10:20',
    altStart: '09:35',
    altEnd: '10:20',
    kind: 'class',
  },
  {
    id: 'break',
    sourceLabel: '10:20-10:40 (Break)',
    label: 'Break',
    start: '10:20',
    end: '10:40',
    kind: 'break',
  },
  {
    id: 'p3',
    sourceLabel: '10:40- 11:40',
    label: 'Period 3',
    start: '10:40',
    end: '11:40',
    kind: 'class',
  },
  {
    id: 'p4',
    sourceLabel: '11:40-12:40 (1 st L)',
    label: 'Period 4',
    start: '11:40',
    end: '12:40',
    kind: 'class',
    // A teaching period that doubles as the first lunch sitting: whoever is not
    // at lunch is in class.
    lunchSitting: 1,
  },
  {
    id: 'p5',
    sourceLabel: '12:40-1:40 (2nd L) (Reg. Start 1:40)',
    label: 'Period 5',
    start: '12:40',
    end: '13:40',
    kind: 'class',
    lunchSitting: 2,
  },
  {
    id: 'p6',
    sourceLabel: '1:40 - 2:50 (Reg. End 1:50)',
    label: 'Period 6',
    start: '13:40',
    end: '14:50',
    kind: 'class',
    // "Reg. End 1:50" means afternoon registration occupies the first ten
    // minutes of this slot, not that the slot ends at 1:50.
    registration: { start: '13:40', end: '13:50' },
  },
  {
    id: 'cps',
    sourceLabel: 'CPS Session',
    label: 'CPS Session',
    // An empty leftover in the FET grid: nothing has ever been scheduled in it.
    // The real CPS sessions are departmental planning meetings, and they are
    // already placed in ordinary periods - CPS-Maths in Tuesday Period 4,
    // CPS-Lan in Wednesday Period 5, and the three CPS-Hum groups in the 8:00
    // registration slot. The teaching day ends at 2:50 with Period 6.
    //
    // So it carries no time, and `unused` keeps it out of the published
    // timetable. build-public.js fails the build if anything is ever scheduled
    // here, rather than hiding it.
    unused: true,
    kind: 'other',
  },
];

/** Staff-roster subjects: lunch duty and CPS. Never part of a class timetable. */
export const isStaffRosterSubject = (subject) =>
  /^lunch/i.test(subject) || /^CPS-/i.test(subject);
