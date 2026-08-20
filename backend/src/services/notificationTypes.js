/**
 * Registry of Sixth Form bulk-notification types. Each entry knows how to
 * build its own email template; the controller stays type-agnostic and just
 * looks up `NOTIFICATION_TYPES[type]`.
 */
import { templates } from './emailTemplates.js';

export const NOTIFICATION_TYPES = {
  INTERVIEW_INVITATION: {
    label: 'Interview Invitation',
    build: (name, ctx) => templates.sixthFormInterviewInvitation(name, ctx.loginUrl, ctx.applicantCount),
  },
  CXC_RESULTS_RELEASED: {
    label: 'CXC Results Released',
    build: (name, ctx) => templates.cxcResultsReleased(name, ctx.loginUrl),
  },
  CUSTOM: {
    label: 'Custom Announcement',
    build: (name, ctx) => templates.customAnnouncement(name, ctx.subject, ctx.message),
  },
};

export const NOTIFICATION_TYPE_KEYS = Object.keys(NOTIFICATION_TYPES);
