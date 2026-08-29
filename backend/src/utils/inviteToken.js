import crypto from 'crypto';
import prisma from './prisma.js';
import logger from './logger.js';

/**
 * Invite links for late Sixth Form applicants.
 *
 * Candidates who were interviewed and accepted on August 25 but never submitted
 * the online application need a way past the closed form. Each gets a link
 * naming them, so the form can open for exactly those people and stay shut to
 * everyone else — no shared code to hand out, leak, or remember to revoke.
 *
 * The token is a random string checked against the database rather than a
 * signed one. Signing needs the issuer and the verifier to hold the same
 * secret, and they do not: invites are issued by a script on a staff machine
 * and verified in production, which run different JWT_SECRETs. Both already
 * talk to this database, so that is what they can agree on. It also buys
 * revocation and a record of who has responded, neither of which a stateless
 * token gives you.
 */

// Jamaica does not observe DST, so a fixed -05:00 offset is always correct.
// Kept in sync with LATE_APPLICATION_DEADLINE in sixth-form-application.html.
export const INVITE_EXPIRY = new Date('2026-09-04T23:59:59-05:00');

export const normaliseInviteEmail = (s) => (s || '').toLowerCase().trim();

/** 32 random bytes: long enough that guessing one is not a strategy. */
const newToken = () => crypto.randomBytes(32).toString('base64url');

/**
 * Issue an invite. Re-issuing for an address revokes whatever came before, so
 * a corrected or re-sent email always leaves exactly one live link per student.
 */
export const createInvite = async (
  { email, firstName, lastName, faculty },
  { expiresAt = INVITE_EXPIRY, createdBy = null } = {}
) => {
  const normalised = normaliseInviteEmail(email);
  const token = newToken();

  await prisma.$transaction([
    prisma.sixthFormInvite.updateMany({
      where: { email: normalised, revokedAt: null, usedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.sixthFormInvite.create({
      data: { token, email: normalised, firstName, lastName, faculty, expiresAt, createdBy },
    }),
  ]);

  return token;
};

/**
 * Resolve a token. Returns null for anything that is not a live invite —
 * unknown, expired, or revoked — so callers cannot accidentally treat a dead
 * link as a good one.
 */
export const readInvite = async (token) => {
  if (!token || typeof token !== 'string') return null;

  const invite = await prisma.sixthFormInvite.findUnique({ where: { token } });
  if (!invite) {
    logger.warn('Sixth Form invite token not recognised');
    return null;
  }
  if (invite.revokedAt) {
    logger.warn('Sixth Form invite token revoked', { email: invite.email });
    return null;
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    logger.warn('Sixth Form invite token expired', { email: invite.email });
    return null;
  }
  return invite;
};

/**
 * Record that an application came in on this invite. Reporting only — what
 * actually stops a second application is the unique index on lower(email), so a
 * student whose submission fails partway is never locked out of retrying.
 */
export const markInviteUsed = async (token) => {
  try {
    await prisma.sixthFormInvite.updateMany({
      where: { token, usedAt: null },
      data: { usedAt: new Date() },
    });
  } catch (error) {
    logger.error('Could not mark Sixth Form invite as used', { error: error.message });
  }
};
