/**
 * Teacher-name tidying, shared by the build pipeline and the database exporter
 * so both spell a teacher the same way.
 */

/**
 * FET's teacher names carry stray runs of spaces and trailing spaces
 * ("Gordon   M", "Cummings "), and exactly one - "Salmon, J" - has a stray comma
 * where every other name is "Surname Initial". FET's own export hides that by
 * splitting teacher lists on commas; we separate with a middot instead, so it
 * would show. Punctuation and whitespace only - no spelling is touched.
 */
export const tidyName = (n) => String(n).replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
