/**
 * Shared labels for Sixth Form subject choices.
 *
 * `subjectChoices` on an application comes in two shapes. Applications
 * submitted from August 2026 onward use the CAPE subject-stream model taken
 * from the paper form (`coreSubject`, `stream`, `streamSubjects`,
 * `preferredStream`, `alternativeStream`). Everything submitted before that
 * used an earlier model where the applicant picked one of eight curated
 * programmes, stored as ids in `firstChoice` / `secondChoice`.
 *
 * Both shapes still need to render — the earlier applicants are the ones
 * being interviewed — so these maps turn either kind of id into a label.
 */

export const STREAM_LABELS: Record<string, string> = {
  business: 'Business & Management',
  humanities: 'Arts/Humanities',
  sciences: 'Pure & Applied Sciences',
  engineering: 'Engineering/Computer Science',
};

export const PROGRAMME_LABELS: Record<string, string> = {
  'natural-sciences': 'Natural Sciences',
  entrepreneurship: 'Entrepreneurship',
  ict: 'ICT',
  law: 'Law',
  'industrial-tech': 'Industrial Technology',
  tourism: 'Tourism',
  'visual-communication': 'Visual Communication',
  sociology: 'Sociology',
};

/** Unrecognised ids fall through to the raw stored value rather than vanishing. */
export const streamLabel = (id?: string) => (id ? STREAM_LABELS[id] || id : '');
export const programmeLabel = (id?: string) => (id ? PROGRAMME_LABELS[id] || id : '');

/**
 * True when an application predates the subject-stream section and so has no
 * Section D on file. Interviewers use this to know they must collect it.
 */
export const needsStreamSelection = (subjectChoices: any) => !subjectChoices?.stream;

/**
 * How far along an applicant's CSEC results are.
 *
 * Applicants who applied before results were released saved the subjects they
 * were still sitting with the grade `Sitting` — the sentinel the application
 * form writes for exactly that case — and are expected to come back through
 * cxc-update.html once results are out. So a row still marked `Sitting` (or
 * left ungraded) is a result the school does not have yet.
 *
 * `pending` rather than a bare yes/no because a student re-sitting one subject
 * in January is legitimately part-way: eight graded and one still to come is
 * very different from nothing on file.
 */
export type CsecReadiness = {
  total: number;
  graded: number;
  pending: number;
  updated: boolean;
};

const PENDING_GRADE = 'Sitting';

export const csecReadiness = (csecResults: any): CsecReadiness => {
  const rows = Array.isArray(csecResults) ? csecResults : [];
  const pending = rows.filter((r) => !r?.grade || r.grade === PENDING_GRADE).length;
  return {
    total: rows.length,
    graded: rows.length - pending,
    pending,
    updated: rows.length > 0 && pending === 0,
  };
};
