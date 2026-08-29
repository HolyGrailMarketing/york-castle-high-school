/**
 * Subject names in the .fet are written for whoever builds the timetable, not
 * for the student reading it: "Grd. 10 P4 - (Bio, HSB, AS, IS, Geo)" tells a
 * Grade 10 student their own grade (which they know), an internal block number,
 * and then the actual choices. This pulls those apart so the page can show the
 * useful part prominently.
 *
 * Abbreviations are deliberately left alone - expanding "AS" or "MVS" would mean
 * guessing, and a wrong subject name on a student's timetable is worse than a
 * terse one.
 */

// "Grd. 10Y - ", "Grd 10 ", "GRD 11 ", "Grd. 9 Y/O- ".
// The house letter is restricted to Y/O/R/K/S (the actual group letters) rather
// than any letter, so it cannot swallow the "P" of a "P1" block marker.
const GRADE_PREFIX = /^gr[d]?\.?\s*\d+\s*(?:[YORKS](?:\s*\/\s*[YORKS])?)?\s*[-–—]?\s*/i;
// An internal option-block marker: "P1", "P4-", "P8 -"
const BLOCK = /\bP\s*(\d+)\s*[-–—]?\s*/i;

const tidy = (s) => s.replace(/\s+/g, ' ').replace(/\s*,\s*\)/g, ')').trim();

/**
 * Plain misspellings in the FET subject list. Listed one by one, deliberately,
 * rather than guessed at with a spellchecker - these go on a page students and
 * parents read, and a wrong "correction" to a subject name is worse than a typo.
 *
 * build-public.js still reports every one of these so the office can fix them at
 * source in FET; this map only stops them reaching the public page meanwhile.
 */
const SPELLING = {
  Literatrue: 'Literature',
  Agicultural: 'Agricultural',
  Managenent: 'Management',
};

const respell = (s) =>
  Object.keys(SPELLING).reduce(
    (acc, wrong) => acc.replace(new RegExp(wrong, 'g'), SPELLING[wrong]),
    s
  );

export function displaySubject(raw) {
  let s = respell(tidy(raw));

  let rest = s.replace(GRADE_PREFIX, '');
  const blockMatch = rest.match(BLOCK);
  const block = blockMatch ? Number(blockMatch[1]) : null;
  if (blockMatch) rest = tidy(rest.replace(BLOCK, ''));
  rest = tidy(rest.replace(/^[-–—]\s*/, ''));

  // Whatever is in the outermost brackets.
  const bracket = rest.match(/^\((.*)\)$/s);
  const inner = bracket ? tidy(bracket[1]) : null;

  if (block !== null && inner) {
    // A pool: the bracket lists the subjects a student can be taking. The .fet
    // writes these as "P4", "P5" and so on; students call them pools, so that is
    // the word the page uses.
    // Comma wins when present: some option lists contain a slash inside a
    // single subject name ("Ind T-TD(M/Building"), so splitting on slash first
    // would tear that subject in half.
    const options = inner
      .split(inner.includes(',') ? ',' : '/')
      .map((o) => tidy(o))
      .filter(Boolean);
    return {
      title: `Pool ${block}`,
      options,
      isOptionBlock: true,
      source: s,
    };
  }

  if (block !== null) {
    // "Grd 10 P1-Maths" - a block number and a single named subject.
    return { title: tidy(rest) || s, options: [], isOptionBlock: false, block, source: s };
  }

  // No block marker: the bracket, if any, is just the subject itself.
  const title = tidy(inner || rest) || s;
  return { title, options: [], isOptionBlock: false, source: s };
}
