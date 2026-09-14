/**
 * The school's year groups and form classes.
 *
 * One list, used by four things that must agree: the sign-up validation chain
 * in utils/validation.js, the dropdowns on sign-up.html (served by
 * GET /api/students/classes), the admin verification screen, and the seed
 * script. When a form class changes, it changes here and nowhere else.
 *
 * The codes are taken from the 2026-2027 timetable (data/timetable-2026-2027.json,
 * `years[].groups`), which is what the school actually timetables against.
 *
 * Note the shape is NOT uniformly "<year><letter>": years 7-10 are divided into
 * five form classes each, but years 11, 12 and 13 are undivided and their form
 * class is just the year number. Anything that parses a form class has to cope
 * with both, which is why yearGroupForFormClass() exists rather than callers
 * slicing the first character.
 */

/** Every year group the school teaches. */
export const YEAR_GROUPS = [7, 8, 9, 10, 11, 12, 13];

/**
 * Form classes per year group, in the order the school lists them.
 * Years 11-13 are undivided - one "class" whose code is the year itself.
 */
export const FORM_CLASSES_BY_YEAR = {
  7: ['7Y', '7O', '7R', '7K', '7S'],
  8: ['8Y', '8O', '8R', '8K', '8S'],
  9: ['9Y', '9O', '9R', '9K', '9S'],
  10: ['10Y', '10O', '10R', '10K', '10S'],
  11: ['11'],
  12: ['12'],
  13: ['13'],
};

/** Flat list of all 23 form classes. */
export const FORM_CLASSES = YEAR_GROUPS.flatMap((year) => FORM_CLASSES_BY_YEAR[year]);

/** Year groups that are not split into form classes. */
export const UNDIVIDED_YEARS = YEAR_GROUPS.filter((year) => FORM_CLASSES_BY_YEAR[year].length === 1);

const FORM_CLASS_TO_YEAR = new Map(
  YEAR_GROUPS.flatMap((year) => FORM_CLASSES_BY_YEAR[year].map((code) => [code, year]))
);

/**
 * Normalise what someone typed into a form-class code, or null if it is not one.
 * Accepts lowercase and stray whitespace, because this runs against a text
 * input on sign-up and against whatever a member of staff types at the desk.
 */
export const normaliseFormClass = (value) => {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase().replace(/\s+/g, '');
  return FORM_CLASS_TO_YEAR.has(code) ? code : null;
};

export const isValidFormClass = (value) => normaliseFormClass(value) !== null;

export const isValidYearGroup = (value) => {
  const year = Number(value);
  return Number.isInteger(year) && YEAR_GROUPS.includes(year);
};

/** The year group a form class belongs to, or null if the code is unknown. */
export const yearGroupForFormClass = (value) => {
  const code = normaliseFormClass(value);
  return code === null ? null : FORM_CLASS_TO_YEAR.get(code);
};

/**
 * True when the form class belongs to the year group. Both must be valid.
 * This is the check that stops a student signing up as "Year 7, class 13".
 */
export const formClassMatchesYear = (formClass, yearGroup) => {
  const year = yearGroupForFormClass(formClass);
  return year !== null && year === Number(yearGroup);
};

/** The payload GET /api/students/classes returns. */
export const classesPayload = () => ({
  yearGroups: YEAR_GROUPS.map((year) => ({
    yearGroup: year,
    label: `Grade ${year}`,
    formClasses: FORM_CLASSES_BY_YEAR[year],
    undivided: FORM_CLASSES_BY_YEAR[year].length === 1,
  })),
  formClasses: FORM_CLASSES,
});
