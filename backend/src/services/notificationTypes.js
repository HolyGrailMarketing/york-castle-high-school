/**
 * Registry of Sixth Form bulk-notification types. Each entry knows how to
 * build its own email template; the controller stays type-agnostic and just
 * looks up `NOTIFICATION_TYPES[type]`.
 *
 * `build(name, ctx, app)` — `ctx` is shared across the whole send, `app` is the
 * recipient's own application, for the types that say something specific to
 * that student.
 */
import { templates } from './emailTemplates.js';

export const NOTIFICATION_TYPES = {
  INTERVIEW_INVITATION: {
    label: 'Interview Invitation',
    build: (name, ctx) => templates.sixthFormInterviewInvitation(name, ctx.loginUrl),
  },
  CXC_RESULTS_RELEASED: {
    label: 'CXC Results Released',
    build: (name, ctx) => templates.cxcResultsReleased(name, ctx.loginUrl),
  },
  ACCEPTANCE_LETTER: {
    label: 'Acceptance Letter',
    // A decision letter is only meaningful once the decision is recorded, and
    // sending the wrong one cannot be taken back. `requiresStatus` makes the
    // controller check each recipient at the point of sending rather than
    // trusting whatever was selected.
    requiresStatus: 'APPROVED',
    build: (name, ctx, app) => templates.sixthFormAcceptanceLetter(name, ctx.acceptance, app?.faculty),
  },
  UNSUCCESSFUL_LETTER: {
    label: 'Unsuccessful Letter',
    requiresStatus: 'REJECTED',
    build: (name) => templates.sixthFormUnsuccessful(name),
  },
  CUSTOM: {
    label: 'Custom Announcement',
    build: (name, ctx) => templates.customAnnouncement(name, ctx.subject, ctx.message),
  },
};

export const NOTIFICATION_TYPE_KEYS = Object.keys(NOTIFICATION_TYPES);
