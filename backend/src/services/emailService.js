import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

let transporter = null;
let emailConfigured = false;

export const initEmailService = () => {
  const requiredVars = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
  const hasAllVars = requiredVars.every(v => process.env[v]);

  if (hasAllVars) {
    try {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: parseInt(process.env.SMTP_PORT) === 465, // SSL for port 465
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      // Verify connection
      transporter.verify((error, success) => {
        if (error) {
          logger.warn('Email service configuration invalid', { error: error.message });
          emailConfigured = false;
        } else {
          logger.info('Email service configured and verified');
          emailConfigured = true;
        }
      });

      emailConfigured = true;
    } catch (error) {
      logger.error('Failed to initialize email service', { error: error.message });
      emailConfigured = false;
    }
  } else {
    logger.warn('Email service not configured - missing required environment variables');
    emailConfigured = false;
  }
};

export const isEmailConfigured = () => emailConfigured;

export const sendEmail = async (to, subject, text, html) => {
  if (!transporter || !emailConfigured) {
    logger.warn('Email service not configured. Skipping email send.', { to, subject });
    return;
  }

  try {
    const result = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html,
    });

    logger.info('Email sent successfully', {
      to,
      subject,
      messageId: result.messageId,
    });

    return result;
  } catch (error) {
    logger.error('Failed to send email', {
      to,
      subject,
      error: error.message,
    });
    throw error;
  }
};

import { templates } from './emailTemplates.js';

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

