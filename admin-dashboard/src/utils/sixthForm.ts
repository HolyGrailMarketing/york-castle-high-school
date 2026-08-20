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
