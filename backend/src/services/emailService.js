import { Resend } from 'resend';
import logger from '../utils/logger.js';
import prisma from '../utils/prisma.js';
import { templates } from './emailTemplates.js';

let resend = null;
let emailConfigured = false;

export const initEmailService = () => {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM;

  if (apiKey) {
    try {
      resend = new Resend(apiKey);
      emailConfigured = true;
      logger.info('Resend email service configured');
    } catch (error) {
      logger.error('Failed to initialize Resend email service', { error: error.message });
      emailConfigured = false;
    }
  } else {
    logger.warn('Email service not configured - RESEND_API_KEY is missing');
    emailConfigured = false;
  }

  if (!fromEmail) {
    logger.warn('RESEND_FROM_EMAIL not set - emails may fail to send');
  }
};

export const isEmailConfigured = () => emailConfigured;

export const sendEmail = async (to, subject, text, html) => {
  if (!resend || !emailConfigured) {
    const error = new Error('Email service not configured. RESEND_API_KEY is missing.');
    logger.warn('Email service not configured. Skipping email send.', { to, subject });
    throw error;
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM;
  if (!fromEmail) {
    const error = new Error('RESEND_FROM_EMAIL not configured. Cannot send email.');
    logger.error('RESEND_FROM_EMAIL not configured. Cannot send email.', { to, subject });
    throw error;
  }

  try {
    const result = await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      text,
      html,
    });

    logger.info('Email sent successfully via Resend', {
      to,
      subject,
      emailId: result.data?.id,
    });

    return result;
  } catch (error) {
    logger.error('Failed to send email via Resend', {
      to,
      subject,
      error: error.message,
    });
    throw error;
  }
};

export const sendApplicationStatusEmail = async (email, name, status, applicationId = null) => {
  const template = templates.applicationStatus(name, status, applicationId);
  await sendEmail(email, template.subject, template.text, template.html);
};

export const sendSixthFormInterviewInvitation = async (email, name) => {
  const template = templates.sixthFormInterviewInvitation(name);
  await sendEmail(email, template.subject, template.text, template.html);
};

// Default recipients for new-request notifications; overridable via env
// (comma-separated for multiple addresses). Used as a fallback when no other
// recipient can be resolved.
export const REQUEST_NOTIFICATION_EMAIL = process.env.REQUEST_NOTIFICATION_EMAIL
  ? process.env.REQUEST_NOTIFICATION_EMAIL.split(',').map((e) => e.trim()).filter(Boolean)
  : ['annallee.brown.ssr3@moeschools.edu.jm', 'Yorkcastlehigh@yahoo.com'];

// Mailboxes that always receive submission notifications regardless of per-user
// flags - e.g. a shared inbox with no login account to hold a flag. Overridable
// via env (comma-separated).
export const ALWAYS_NOTIFY_EMAILS = process.env.ALWAYS_NOTIFY_EMAILS
  ? process.env.ALWAYS_NOTIFY_EMAILS.split(',').map((e) => e.trim()).filter(Boolean)
  : ['Yorkcastlehigh@yahoo.com'];

export const sendAdminRequestNotification = async (details, to = REQUEST_NOTIFICATION_EMAIL) => {
  const template = templates.adminNewRequest(details);
  await sendEmail(to, template.subject, template.text, template.html);
};

export const sendAdminSixthFormNotification = async (details, to = REQUEST_NOTIFICATION_EMAIL) => {
  const template = templates.adminNewSixthFormApplication(details);
  await sendEmail(to, template.subject, template.text, template.html);
};

export const sendAdminApplicationNotification = async (details, to = REQUEST_NOTIFICATION_EMAIL) => {
  const template = templates.adminNewApplication(details);
  await sendEmail(to, template.subject, template.text, template.html);
};

// Resolve the recipients for a given submission category: the users flagged for
// it, always unioned with ALWAYS_NOTIFY_EMAILS (deduped, case-insensitive).
// Falls back to the default REQUEST_NOTIFICATION_EMAIL list only if that union
// somehow yields nothing, so notifications are never silently dropped.
export const getNotificationRecipients = async (flagField) => {
  const users = await prisma.user.findMany({
    where: { [flagField]: true },
    select: { email: true },
  });
  const flagged = users.map((u) => u.email).filter(Boolean);

  const seen = new Set();
  const recipients = [];
  for (const email of [...flagged, ...ALWAYS_NOTIFY_EMAILS]) {
    const key = email.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      recipients.push(email);
    }
  }
  return recipients.length ? recipients : REQUEST_NOTIFICATION_EMAIL;
};

// Recipients for overdue-request escalations - the principal, in practice.
//
// Deliberately does NOT union in ALWAYS_NOTIFY_EMAILS the way
// getNotificationRecipients does: that shared inbox wants the new-submission
// firehose, but an escalation is meant for whoever is accountable for it.
// Falls back to REQUEST_NOTIFICATION_EMAIL if nobody is flagged, so the alert
// is never silently dropped.
export const getOverdueEscalationRecipients = async () => {
  const users = await prisma.user.findMany({
    where: { notifyOverdueRequests: true },
    select: { email: true },
  });
  const recipients = users.map((u) => u.email).filter(Boolean);
  return recipients.length ? recipients : REQUEST_NOTIFICATION_EMAIL;
};

export const sendOverdueRequestsEscalation = async (details, to) => {
  const template = templates.overdueRequestsDigest(details);
  await sendEmail(to, template.subject, template.text, template.html);
};

export const sendRequestAssignmentNotification = async (email, details) => {
  const template = templates.requestAssignment(details);
  await sendEmail(email, template.subject, template.text, template.html);
};

export const sendRequestConfirmationEmail = async (email, name, requestType, requestId) => {
  const template = templates.requestConfirmation(name, requestType, requestId);
  await sendEmail(email, template.subject, template.text, template.html);
};

export const sendRequestStatusUpdateEmail = async (email, name, requestType, status, requestId) => {
  const template = templates.requestStatusUpdate(name, requestType, status, requestId);
  await sendEmail(email, template.subject, template.text, template.html);
};

export const sendWelcomeEmail = async (email, name, role) => {
  const template = templates.welcome(name, email, role);
  await sendEmail(email, template.subject, template.text, template.html);
};

export const sendInvitationEmail = async (email, name, role, authMethod, loginUrl) => {
  const template = templates.invitation(name, email, role, authMethod, loginUrl);
  await sendEmail(email, template.subject, template.text, template.html);
};

export const sendPasswordResetEmail = async (email, name, resetUrl) => {
  const firstName = (name || '').trim().split(' ')[0] || 'there';
  const subject = 'Reset your York Castle High School password';
  const text =
    `Hi ${firstName},\n\n` +
    `We received a request to reset the password for your York Castle High School account.\n\n` +
    `Reset your password using this link (valid for 1 hour):\n${resetUrl}\n\n` +
    `If you didn't request this, you can safely ignore this email — your password won't change.\n\n` +
    `York Castle High School`;
  const html = `
  <div style="background:#f6f7f9;padding:32px 0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e9ebf0;border-radius:14px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#0e0e10,#17171b 55%,#241d06);padding:28px 32px;border-bottom:3px solid #d4af37;">
        <div style="color:#f0d066;font:700 20px Georgia,serif;">York Castle High School</div>
      </div>
      <div style="padding:32px;">
        <p style="font-size:15px;color:#1a1a2e;margin:0 0 16px;">Hi ${firstName},</p>
        <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 24px;">
          We received a request to reset the password for your account. Click the button below to choose a new password. This link is valid for <strong>1 hour</strong>.
        </p>
        <a href="${resetUrl}" style="display:inline-block;background:#141417;color:#f0d066;text-decoration:none;font-weight:600;font-size:15px;padding:13px 28px;border-radius:10px;">Reset password</a>
        <p style="font-size:13px;color:#9ca3af;line-height:1.6;margin:24px 0 0;">
          If the button doesn't work, copy and paste this link into your browser:<br>
          <a href="${resetUrl}" style="color:#b8902a;word-break:break-all;">${resetUrl}</a>
        </p>
        <p style="font-size:13px;color:#9ca3af;line-height:1.6;margin:20px 0 0;">
          If you didn't request this, you can safely ignore this email — your password won't change.
        </p>
      </div>
    </div>
  </div>`;
  await sendEmail(email, subject, text, html);
};
