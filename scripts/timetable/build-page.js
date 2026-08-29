#!/usr/bin/env node
/**
 * Inject the pre-rendered timetable into timetable.html.
 *
 * The page used to build its tables in JavaScript from a fetched JSON payload.
 * That broke for anyone without JavaScript - a student on a locked-down school
 * device got a "turn JavaScript on" message and nothing else - and it cost an
 * extra request before anything appeared.
 *
 * Pre-rendering all 23 classes is also simply smaller: the markup is highly
 * repetitive, so it gzips to ~9 KB against ~22.7 KB for the old page plus its
 * JSON fetch, in one request rather than two.
 *
 * So the tables ship in the HTML, class switching is hidden radios plus
 * :checked CSS, and JavaScript is now pure enhancement (search, calendar export,
 * "on now" highlighting, remembering your class).
 *
 * This rewrites the region between the GENERATED markers in timetable.html, in
 * place and idempotently. Edit anything you like outside those markers; edits
 * inside them are overwritten on the next build.
 *
 * Usage:
 *   node scripts/timetable/build-page.js [payload.json] [page.html]
 */

import fs from 'fs';

const payloadPath = process.argv[2] || 'data/timetable-public.json';
const pagePath = process.argv[3] || 'timetable.html';

const BEGIN = '<!-- BEGIN GENERATED TIMETABLE -->';
const END = '<!-- END GENERATED TIMETABLE -->';

const d = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));
const order = d.periods.map((p) => p.id);
const pi = Object.fromEntries(order.map((id, i) => [id, i]));
const groups = d.years.flatMap((y) => y.groups);

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const t12 = (s) => {
  if (!s) return '';
  const [h, m] = s.split(':');
  const H = Number(h);
  return `${H % 12 || 12}:${m} ${H < 12 ? 'am' : 'pm'}`;
};

// Whole-year classes are stored under the year name ("11"); name them in full.
const label = (g) => (d.years.some((y) => y.name === g) ? `Grade ${g}` : g);
// Radio ids must be valid CSS identifiers, and every group name here is
// alphanumeric already - this only guards against a future rename.
const rid = (g) => `c-${g.replace(/[^A-Za-z0-9]/g, '')}`;

const lessonBody = (l) =>
  `<div class="yc-tt-subject">${esc(l.t)}</div>` +
  (l.o && l.o.length ? `<div class="yc-tt-opts">${esc(l.o.join(' · '))}</div>` : '') +
  // Separated with a middot, not a comma: one of the names is "Salmon, J".
  (l.w && l.w.length
    ? `<div class="yc-tt-teachers">${esc(l.w.join(' · '))}</div>`
    : '') +
  (l.r ? `<span class="yc-tt-room">${esc(l.r)}</span>` : '');

const slots = (g) => {
  const bySlot = {};
  const covered = {};
  for (const l of d.lessons[g] || []) {
    bySlot[`${l.d}|${l.p}`] = l;
    for (let k = 1; k < (l.n || 1); k += 1) {
      const next = order[pi[l.p] + k];
      if (next) covered[`${l.d}|${next}`] = true;
    }
  }
  return { bySlot, covered };
};

const grid = (g) => {
  const { bySlot, covered } = slots(g);
  // Visually hidden, but still announced: a <caption> is how a screen reader
  // user knows which class this grid belongs to. Webflow's .w-hidden was
  // display:none, which removed it from the accessibility tree as well.
  let h = '<table class="yc-tt-grid"><caption class="yc-sr-only">Weekly timetable for ' +
    `${esc(label(g))}</caption><thead><tr><th class="yc-tt-time" scope="col">Time</th>` +
    d.days.map((x) => `<th scope="col">${esc(x)}</th>`).join('') + '</tr></thead><tbody>';

  for (const p of d.periods) {
    let nonClass = p.kind !== 'class';
    // A lunch-sitting period with nothing scheduled all week is this class's
    // lunch, per the school's own period naming.
    const atLunch = !nonClass && p.lunchSitting &&
      !d.days.some((_, i) => bySlot[`${i}|${p.id}`] || covered[`${i}|${p.id}`]);
    if (atLunch) nonClass = true;

    h += `<tr${nonClass ? ' class="yc-tt-nonclass"' : ''}>` +
      `<th class="yc-tt-time" scope="row"><b>${esc(p.label)}</b>` +
      (p.start ? `<span>${t12(p.start)} &ndash; ${t12(p.end)}${p.timeAssumed ? ' *' : ''}</span>` : '') +
      // Periods 1 and 2 also carry a shortened set of times, for mornings with a
      // longer devotion: the 30 minutes that opens up after registration is paid
      // for by trimming both periods to 45 minutes, so Break still starts at
      // 10:20 and the rest of the day is untouched.
      (p.altStart ? `<span class="yc-tt-alt">short: ${t12(p.altStart)} &ndash; ${t12(p.altEnd)}</span>` : '') +
      '</th>';

    if (nonClass) {
      const text = atLunch ? `Lunch (${p.lunchSitting === 1 ? '1st' : '2nd'} sitting)` : p.label;
      h += `<td class="yc-tt-nonclass" colspan="${d.days.length}">${esc(text)}</td></tr>`;
      continue;
    }

    d.days.forEach((_, i) => {
      const key = `${i}|${p.id}`;
      if (covered[key]) return;
      const l = bySlot[key];
      if (!l) { h += '<td class="yc-tt-free"></td>'; return; }
      h += `<td class="yc-tt-cell yc-tt-find" data-day="${i}" data-period="${esc(p.id)}"` +
        ((l.n || 1) > 1 ? ` rowspan="${l.n}"` : '') + `>${lessonBody(l)}</td>`;
    });
    h += '</tr>';
  }
  return `${h}</tbody></table>`;
};

const dayList = (g) =>
  d.days.map((day, di) => {
    const todays = (d.lessons[g] || []).filter((l) => l.d === di).sort((a, b) => pi[a.p] - pi[b.p]);
    return `<section class="yc-tt-day"><h3>${esc(day)}</h3>` +
      (todays.length
        ? todays.map((l) => {
          const p = d.periods[pi[l.p]];
          const last = d.periods[pi[l.p] + (l.n || 1) - 1] || p;
          return `<div class="yc-tt-day-item yc-tt-find" data-day="${di}" data-period="${esc(l.p)}"` +
            ` data-start="${esc(p.start || '')}" data-end="${esc(last.end || '')}">` +
            `<div class="yc-tt-day-time">${t12(p.start)}<br>${t12(last.end)}</div>` +
            `<div class="yc-tt-day-body">${lessonBody(l)}</div></div>`;
        }).join('')
        : '<div class="yc-tt-empty">No timetabled lessons.</div>') +
      '</section>';
  }).join('');

// --- assemble ---------------------------------------------------------------

// A sentinel in the SAME radio group as the 23 classes. It is the one checked in
// the markup, so on a first visit nothing is selected yet and the picker shows
// expanded. Picking any class unchecks it automatically - that is just how radio
// groups work - which collapses the picker with no JavaScript involved.
const NONE = 'c-none';

const radios =
  `<input type="radio" name="ycclass" id="${NONE}" checked aria-label="No class chosen yet">\n      ` +
  groups
    .map((g) => `<input type="radio" name="ycclass" id="${rid(g)}" data-group="${esc(g)}"` +
      ` aria-label="Show the timetable for ${esc(label(g))}">`)
    .join('\n      ') +
  // Separate from the class group: lets someone re-open the picker to change
  // class without clearing the class they already have.
  `\n      <input type="checkbox" id="tt-expand" aria-label="Show the class picker">`;

const picker = d.years.map((y) => {
  const whole = y.groups.length === 1 && y.groups[0] === y.name;
  return `<div class="yc-tt-year"><span class="yc-tt-year-name">Grade ${esc(y.name)}</span>` +
    y.groups.map((g) => `<label class="yc-tt-chip" for="${rid(g)}">${whole ? 'Whole year' : esc(g)}</label>`).join('') +
    '</div>';
}).join('\n          ');

// The collapsed bar names the current class. One span per class, and CSS reveals
// whichever one matches the checked radio.
const current = `<span class="yc-tt-current">` +
  `<span data-c="${NONE}">Choose your class</span>` +
  groups.map((g) => `<span data-c="${rid(g)}">${esc(label(g))}</span>`).join('') +
  `</span>`;

const panels = groups.map((g) =>
  `<section class="yc-tt-panel" id="p-${rid(g)}" data-group="${esc(g)}">` +
  `<div class="yc-tt-panel-head"><h2>${esc(label(g))}</h2>` +
  `<span class="yc-tt-count" data-total="${(d.lessons[g] || []).length}">` +
  `${(d.lessons[g] || []).length} lessons a week</span></div>` +
  `<div class="yc-tt-scroll">${grid(g)}</div>` +
  `<div class="yc-tt-days">${dayList(g)}</div></section>`).join('\n          ');

// Only the checked class's panel and chip are shown. Generated rather than done
// with :has() so the page does not depend on a recent browser.
const showPanel = groups.map((g) => `#${rid(g)}:checked ~ .yc-tt-panels #p-${rid(g)}`).join(',\n    ');
const showChip = groups.map((g) => `#${rid(g)}:checked ~ .yc-tt-years label[for="${rid(g)}"]`).join(',\n    ');
// The radios sit before .yc-tt-controls rather than beside their own labels, so
// the focus ring has to be routed to the label the same way the checked style is
// - an adjacent-sibling rule would never match.
const focusChip = groups.map((g) => `#${rid(g)}:focus-visible ~ .yc-tt-years label[for="${rid(g)}"]`).join(',\n    ');
// Same routing for the name shown in the collapsed bar.
const showCurrent = [NONE, ...groups.map(rid)]
  .map((id) => `#${id}:checked ~ .yc-tt-bar .yc-tt-current [data-c="${id}"]`).join(',\n    ');

const generated = `${BEGIN}
      <!-- Everything between these markers is written by
           scripts/timetable/build-page.js. Do not edit it by hand. -->
      <style>
    /* Visually hidden but still a real, focusable radio group. The obvious
       "opacity:0; width:0; height:0" is NOT equivalent - zero-sized controls get
       skipped, which silently broke arrow-key navigation between classes. This
       is the standard clip recipe: 1px, clipped away, still focusable. */
    input[name="ycclass"], #tt-expand {
      position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
      overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%);
      white-space: nowrap; border: 0;
    }
    ${focusChip} { outline: 3px solid var(--yc-gold); outline-offset: 2px; }
    #tt-expand:focus-visible ~ .yc-tt-bar .yc-tt-change { outline: 3px solid var(--yc-gold); outline-offset: 2px; }

    .yc-tt-panel { display: none; }
    ${showPanel} { display: block; }
    ${showChip} { background: var(--yc-ink); border-color: var(--yc-ink); color: #fff; }

    /* The chip grid is collapsed unless no class has been chosen yet (first
       visit) or the visitor has opened it to change class. */
    .yc-tt-years { display: none; }
    #${NONE}:checked ~ .yc-tt-years,
    #tt-expand:checked ~ .yc-tt-years { display: block; }

    .yc-tt-current > span { display: none; }
    ${showCurrent} { display: inline; }

    /* While the picker is already open on a first visit the bar is a heading,
       not a toggle - otherwise tapping it would latch #tt-expand on and the
       picker would not collapse when a class is finally chosen. */
    #${NONE}:checked ~ .yc-tt-bar .yc-tt-change { pointer-events: none; }
    #${NONE}:checked ~ .yc-tt-bar .yc-tt-caret { display: none; }

    .yc-tt-change .yc-tt-close { display: none; }
    #tt-expand:checked ~ .yc-tt-bar .yc-tt-open { display: none; }
    #tt-expand:checked ~ .yc-tt-bar .yc-tt-close { display: inline; }

    /* Nothing chosen yet, so prompt instead of showing an arbitrary class. */
    .yc-tt-prompt { display: none; }
    #${NONE}:checked ~ .yc-tt-panels .yc-tt-prompt { display: block; }
      </style>
      <script type="application/json" id="ttData" data-year="${esc(d.schoolYear.replace('-', '\u2013'))}">${JSON.stringify({
        days: d.days,
        periods: d.periods.map((p) => ({ id: p.id, start: p.start, end: p.end })),
      })}</script>
      ${radios}
      <!-- The bar is a direct child of .yc-tt-wrap, not of the picker: a sticky
           element is confined to its containing block, so nesting it inside the
           collapsed picker would let it scroll away after ~120px. -->
      <div class="yc-tt-bar">
        <label class="yc-tt-change" for="tt-expand">
          ${current}
          <span class="yc-tt-caret" aria-hidden="true"><span class="yc-tt-open">Change</span><span class="yc-tt-close">Close</span></span>
        </label>
      </div>
      <!-- Deliberately a sibling of the sticky bar, not inside it: on a phone
           these wrap onto three lines, which made the pinned bar 160px - 20% of
           the screen. Only the class name stays pinned; these scroll away.
           They all need JavaScript, so they ship hidden and the enhancement
           script reveals them. -->
      <div class="yc-tt-tools" id="ttTools" hidden>
        <input type="search" id="ttSearch" class="yc-tt-search" placeholder="Find a subject&hellip;" aria-label="Find a subject in this timetable">
        <a href="#" id="ttIcs" class="yc-tt-btn secondary" download>Add to calendar</a>
        <button type="button" id="ttPdf" class="yc-tt-btn">Download PDF</button>
      </div>
      <div class="yc-tt-years" role="group" aria-labelledby="ttClassLabel">
        <span class="yc-tt-label" id="ttClassLabel">Choose your class</span>
        ${picker}
      </div>
      <div class="yc-tt-panels">
        <div class="yc-tt-prompt">Choose your class above to see its timetable for the week.</div>
        ${panels}
      </div>
      ${END}`;

const page = fs.readFileSync(pagePath, 'utf8');
const a = page.indexOf(BEGIN);
const b = page.indexOf(END);
if (a === -1 || b === -1) {
  console.error(`Could not find the GENERATED markers in ${pagePath}.`);
  process.exit(1);
}
const out = page.slice(0, a) + generated + page.slice(b + END.length);
fs.writeFileSync(pagePath, out);

import { gzipSync } from 'zlib';
console.log(`Rendered ${groups.length} classes into ${pagePath}`);
console.log(`  raw  ${(out.length / 1024).toFixed(0)} KB` +
  `   gzip ${(gzipSync(Buffer.from(out), { level: 9 }).length / 1024).toFixed(1)} KB`);
