import crypto from 'crypto';
import { normaliseFormClass, formClassMatchesYear } from './schoolClasses.js';

/**
 * Turning a person into a student.
 *
 * Three things create students and they must not drift apart: the library desk
 * (studentProfileController.deskRegisterStudent), sixth form enrolment, and the
 * bulk register import. Each has its own reason for existing, but the record
 * they produce has to be identical, so the record-making lives here and they
 * only decide who and when.
 *
 * Everything below takes a transaction client. Creating the account and the
 * profile is one act - a User with no StudentProfile is a student no student
 * screen can see - and the callers are already inside `prisma.$transaction`.
 */

/**
 * Find or create the User behind a student.
 *
 * Order matters. A sixth form applicant usually already has an account: one is
 * created for them when they submit the application, so that they can sign in
 * and track it. Enrolling them must reuse it rather than mint a second account
 * with the same email.
 */
export const resolveStudentUser = async (tx, { name, email, userId }) => {
  const cleanEmail = email?.trim().toLowerCase() || null;

  if (userId) {
    const existing = await tx.user.findUnique({ where: { id: userId } });
    if (existing) return { user: existing, created: false, placeholderEmail: false };
    // Falls through: a userId pointing at a deleted account is stale data, not
    // a reason to refuse to enrol someone who is standing in the office.
  }

  if (cleanEmail) {
    const byEmail = await tx.user.findFirst({
      where: { email: { equals: cleanEmail, mode: 'insensitive' } },
    });
    if (byEmail) return { user: byEmail, created: false, placeholderEmail: false };
  }

  // A student with no email still needs a unique value for the column. The
  // .invalid TLD is reserved by RFC 2606 and can never be routed, so a
  // placeholder can never accidentally be mailed.
  const placeholderEmail = !cleanEmail;
  const addressToUse = cleanEmail
    || `${name.trim().toLowerCase().replace(/[^a-z]+/g, '.')}.${crypto.randomBytes(3).toString('hex')}@no-email.invalid`;

  // No password. The account can be used immediately; the student sets their
  // own password through the normal forgotten-password flow, so staff never
  // handle a student's password.
  const user = await tx.user.create({
    data: { email: addressToUse, name: name.trim(), role: 'STUDENT' },
  });

  return { user, created: true, placeholderEmail };
};

/**
 * Write the school-specific fields.
 *
 * Upsert, never create: a student who signed themselves up already has a
 * profile, and enrolling them should fill in what the office has confirmed, not
 * collide on the unique userId.
 *
 * Guardian details are only written into empty fields. What a student told us
 * about their guardian in September is better than what a form said in July,
 * and an enrolment run must not quietly overwrite the newer answer.
 */
export const upsertStudentProfile = async (tx, {
  userId,
  yearGroup,
  formClass,
  studentNumber = null,
  guardian = {},
  verifiedById = null,
  registeredAtDesk = false,
  notes = null,
}) => {
  const existing = await tx.studentProfile.findUnique({ where: { userId } });

  const confirmed = {
    yearGroup,
    formClass,
    verification: 'VERIFIED',
    verifiedAt: new Date(),
    verifiedById,
  };

  // Only fill a guardian field that is currently empty.
  const guardianFill = {};
  for (const key of ['guardianName', 'guardianPhone', 'guardianEmail']) {
    if (guardian[key] && !existing?.[key]) guardianFill[key] = guardian[key];
  }

  if (existing) {
    return tx.studentProfile.update({
      where: { userId },
      data: {
        ...confirmed,
        ...guardianFill,
        // Never overwrite a student number the office has already assigned.
        ...(studentNumber && !existing.studentNumber ? { studentNumber } : {}),
        ...(notes && !existing.notes ? { notes } : {}),
      },
    });
  }

  return tx.studentProfile.create({
    data: {
      userId,
      studentNumber,
      ...confirmed,
      // What they claimed and what the office confirmed are the same thing when
      // the office is the one entering it.
      claimedYearGroup: yearGroup,
      claimedFormClass: formClass,
      ...guardianFill,
      registeredAtDesk,
      notes,
    },
  });
};

/**
 * Map the sixth form application's guardian blob onto the profile's flat
 * fields.
 *
 * The application stores guardianInfo as JSON with the keys the form collects:
 * firstName, lastName, relationship, address, town, parish, workPhone,
 * homePhone, cellPhone. Three of those matter here and the rest stay on the
 * application, which is where anyone looking for an address will go anyway.
 */
export const guardianFromSixthForm = (info) => {
  if (!info || typeof info !== 'object') return {};
  return {
    guardianName: [info.firstName, info.lastName].filter(Boolean).join(' ').trim() || null,
    // Whichever number is most likely to be answered.
    guardianPhone: info.cellPhone || info.homePhone || info.workPhone || null,
    // The sixth form form never asks for a guardian email address. Falling back
    // to the applicant's own would make the student their own guardian and send
    // fee notices to a sixteen-year-old instead of the person paying them.
    guardianEmail: null,
  };
};

/**
 * The form class for a whole year group.
 *
 * Years 11, 12 and 13 are undivided and their form class is the year number
 * itself ("12"), while years 7-10 are split into five. Enrolment only ever
 * places sixth formers, so the year is enough - but validate rather than assume,
 * because the day someone passes 9 this returns null instead of "9".
 */
export const formClassForUndividedYear = (yearGroup) => {
  const code = normaliseFormClass(String(yearGroup));
  if (!code || !formClassMatchesYear(code, Number(yearGroup))) return null;
  return code;
};
