/**
 * Turnaround commitments for document requests.
 *
 * doc-request.html shows the visitor a processing time per document type (see
 * the `processingTimes` map in that file). This module is the server-side copy
 * of the same commitment, used to decide when a request has run past what the
 * school promised.
 *
 * Keys must match the `metadata.requestType` values the form posts verbatim -
 * they come from the `data-type` attributes on the document cards.
 *
 * The number is the UPPER bound of the range shown on the form, in working
 * days. Escalating at the lower bound would fire while the request is still
 * inside the promised window.
 */

export const DOCUMENT_SLA_WORKING_DAYS = {
  'Transcript': 21,                    // form says 15-21 working days
  'Embassy Letter': 7,                 // form says 5-7 working days
  'Academic Status Letter': 5,         // form says 3-5 working days
  'Progress Report': 5,                // form says 3-5 working days
  'Recommendation': 4,                 // form says 3-4 working days
  'School Leaving Certificate': 10,    // form says 7-10 working days
};

/** Human-readable range shown on the form, for use in the escalation email. */
export const DOCUMENT_SLA_LABELS = {
  'Transcript': '15-21 working days',
  'Embassy Letter': '5-7 working days',
  'Academic Status Letter': '3-5 working days',
  'Progress Report': '3-5 working days',
  'Recommendation': '3-4 working days',
  'School Leaving Certificate': '7-10 working days',
};

const SLA_VALUES = Object.values(DOCUMENT_SLA_WORKING_DAYS);

/** Shortest promise on the form. Used as a cheap prefilter before doing real date math. */
export const MIN_SLA_WORKING_DAYS = Math.min(...SLA_VALUES);

/**
 * Longest promise on the form. Used for requests whose type we don't recognise
 * (an older submission, or a document type added to the form but not here) so
 * they still escalate eventually rather than being dropped silently.
 */
export const MAX_SLA_WORKING_DAYS = Math.max(...SLA_VALUES);

const isWeekend = (date) => {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
};

/**
 * Add `count` working days (Mon-Fri) to `date`.
 *
 * Note: Jamaican public holidays are not modelled, so around a holiday the due
 * date can land a day or so earlier than the school would count it.
 */
export const addWorkingDays = (date, count) => {
  const result = new Date(date.getTime());
  let remaining = Math.max(0, Math.floor(count));
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (!isWeekend(result)) {
      remaining -= 1;
    }
  }
  return result;
};

/** Number of working days between two dates, not counting the start day. */
export const workingDaysBetween = (from, to) => {
  if (to <= from) return 0;
  const cursor = new Date(from.getTime());
  let days = 0;
  while (cursor < to) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (!isWeekend(cursor) && cursor <= to) {
      days += 1;
    }
  }
  return days;
};

/** The document type a request was submitted for, or null if it isn't recorded. */
export const documentTypeOf = (request) => {
  const type = request?.metadata?.requestType;
  return typeof type === 'string' && type.trim() ? type.trim() : null;
};

/** Working-days allowance for a request, falling back to the longest promise. */
export const slaWorkingDaysFor = (request) => {
  const documentType = documentTypeOf(request);
  const sla = documentType ? DOCUMENT_SLA_WORKING_DAYS[documentType] : undefined;
  return sla ?? MAX_SLA_WORKING_DAYS;
};

/** The date by which the school promised to have this request done. */
export const dueDateFor = (request) =>
  addWorkingDays(new Date(request.createdAt), slaWorkingDaysFor(request));

/** True if `now` is past the promised turnaround for this request. */
export const isOverdue = (request, now = new Date()) => dueDateFor(request) < now;

/** The range as worded on the form, for the escalation email. */
export const slaLabelFor = (request) => {
  const documentType = documentTypeOf(request);
  return (
    (documentType && DOCUMENT_SLA_LABELS[documentType]) ||
    `${MAX_SLA_WORKING_DAYS} working days`
  );
};
