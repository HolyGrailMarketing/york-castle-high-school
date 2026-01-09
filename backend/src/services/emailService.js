import { Resend } from 'resend';
import logger from '../utils/logger.js';
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
