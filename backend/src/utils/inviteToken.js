import jwt from 'jsonwebtoken';
import logger from './logger.js';

/**
 * Invite tokens for late Sixth Form applicants.
 *
 * Candidates who were interviewed and accepted on August 25 but never submitted
 * the online application need a way past the closed form. A signed token in the
 * link carries who the invite is for, so the form can open for exactly those
 * people and stay shut to everyone else — no shared code to hand out, leak, or
 * remember to revoke.
 *
 * Modelled on the password-reset token in authController.js: the claims travel
 * inside the signature, so nothing is stored and no schema changes.
 *
 * Single use is a side effect rather than a mechanism. The moment an
 * application exists for the address, the lower(email) unique index and the 409
 * in createSixthFormApplication make the link useless. There is nothing to
 * expire early or clean up afterwards.
 */

// Jamaica does not observe DST, so a fixed -05:00 offset is always correct.
// Kept in sync with LATE_APPLICATION_DEADLINE in sixth-form-application.html.
export const INVITE_EXPIRY = new Date('2026-09-04T23:59:59-05:00');

/** Namespaced so an invite can never be presented as a session or reset token. */
const inviteSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return `${process.env.JWT_SECRET}|sfinvite`;
};

export const normaliseInviteEmail = (s) => (s || '').toLowerCase().trim();

/**
 * `exp` is an absolute moment, not a duration: every invite dies when the late
 * window closes, whether it was minted on the first send or a chase-up a week
 * later. Nobody gets a quietly longer deadline than the email told them.
 */
export const signInviteToken = ({ email, firstName, lastName, list }, expiry = INVITE_EXPIRY) =>
  jwt.sign(
    {
      email: normaliseInviteEmail(email),
      firstName,
      lastName,
      list,
      type: 'sixth_form_invite',
      exp: Math.floor(expiry.getTime() / 1000),
    },
    inviteSecret()
  );

/** Throws if the signature, type or expiry does not hold. */
export const verifyInviteToken = (token) => {
  if (!token) throw new Error('Invite token is required');
  const payload = jwt.verify(token, inviteSecret());
  if (payload.type !== 'sixth_form_invite') {
    throw new Error('Not an invite token');
  }
  return payload;
};

/** Non-throwing form for the places that only care whether it holds. */
export const readInviteToken = (token) => {
  try {
    return verifyInviteToken(token);
  } catch (error) {
    logger.warn('Sixth Form invite token rejected', { reason: error.message });
    return null;
  }
};
