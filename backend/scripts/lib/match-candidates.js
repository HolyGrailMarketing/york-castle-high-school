/**
 * Match a named candidate from a final selection list to their application.
 *
 * The lists and the database disagree about people constantly: a student writes
 * one address on the interview form and applied with another, a name is spelt
 * from memory, a surname is recorded in full on one side and shortened on the
 * other. Matching on email alone silently loses about a fifth of the intake.
 *
 * Shared by apply-final-lists.js and send-application-invites.js so the two can
 * never disagree about who is missing an application.
 */

/** Names disagree on punctuation, case and spacing across the two sources. */
export const norm = (s) => (s || '').toLowerCase().replace(/[^a-z]/g, '');
export const normEmail = (s) => (s || '').toLowerCase().trim();

/**
 * Find the application a listed candidate belongs to, most trustworthy signal
 * first. Returns null rather than a doubtful guess — an unmatched candidate is
 * a line in a report, a wrongly matched one is a student wrongly approved, or a
 * stranger emailed an invite meant for somebody else.
 *
 * `apps` must carry the precomputed `_email` / `_fn` / `_sn` fields that
 * `prepareApplications` adds.
 */
export function matchCandidate(cand, apps) {
  const email = normEmail(cand.email);
  const fn = norm(cand.firstname);
  const sn = norm(cand.surname);

  // 1. Same email. A unique index on lower(email) makes this exact and unambiguous.
  if (email) {
    const hit = apps.find((a) => a._email === email);
    if (hit) return { app: hit, tier: 1, how: 'email' };
  }

  // 2. Same first and last name. Covers every case where only the address moved.
  let hits = apps.filter((a) => a._fn === fn && a._sn === sn);
  if (hits.length === 1) return { app: hits[0], tier: 2, how: 'first + last name' };

  // 3. First name, and the list's surname is the tail of a longer one on file
  //    ("Simon" on the list, "Rivera Simon" in the database).
  hits = apps.filter((a) => a._fn === fn && a._sn.endsWith(sn) && sn.length >= 4);
  if (hits.length === 1) return { app: hits[0], tier: 3, how: 'first name + surname suffix' };

  // 4. Surname exact, first name agreeing on its opening — the list and the form
  //    spell it differently (Rhoniel/Rhoneil, Triston/Tristan, Judriq/Jude-Riq).
  hits = apps.filter((a) => a._sn === sn && a._fn.slice(0, 3) === fn.slice(0, 3) && fn.length >= 3);
  if (hits.length === 1) return { app: hits[0], tier: 4, how: 'surname + first-name stem' };

  // A surname on its own is never enough: "Miller, Ajani" would resolve to one
  // of six unrelated Millers.
  return null;
}

/** Attach the normalised forms once; matchCandidate scans every row per candidate. */
export function prepareApplications(applications) {
  for (const a of applications) {
    a._email = normEmail(a.email);
    a._fn = norm(a.firstName);
    a._sn = norm(a.lastName);
  }
  return applications;
}

/**
 * Split a candidate list into those with an application and those without.
 * Two list entries resolving to one application means the matcher is wrong
 * about at least one of them, so both are reported instead of either being used.
 */
export function reconcile(candidates, applications, { onConflict } = {}) {
  prepareApplications(applications);

  const matched = [];
  const unmatched = [];
  const claimed = new Map(); // application id -> the candidate that took it

  for (const cand of candidates) {
    const result = matchCandidate(cand, applications);
    if (!result) {
      unmatched.push(cand);
      continue;
    }
    const prior = claimed.get(result.app.id);
    if (prior) {
      onConflict?.(cand, prior, result.app);
      unmatched.push(cand, prior);
      matched.splice(matched.findIndex((m) => m.app.id === result.app.id), 1);
      claimed.delete(result.app.id);
      continue;
    }
    claimed.set(result.app.id, cand);
    matched.push({ cand, ...result });
  }

  return { matched, unmatched };
}
