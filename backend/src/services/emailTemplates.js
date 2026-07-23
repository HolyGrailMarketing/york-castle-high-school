/**
 * Email Templates for York Castle High School
 * Provides HTML email templates for various notifications
 */

const schoolColors = {
  primary: '#1a1a1a', // Charcoal (matches website navbar)
  secondary: '#d4af37', // Gold (matches website)
  goldLight: '#f4e4a6',
  goldDark: '#b8941f',
  charcoal: '#1a1a1a',
  darkGray: '#2d2d2d',
  gray: '#6b6b6b',
  lightGray: '#f5f5f5',
  cream: '#faf8f0',
  white: '#ffffff',
  text: '#1a1a1a',
  textLight: '#6b6b6b',
};

const baseTemplate = (content, title) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: ${schoolColors.text};
      margin: 0;
      padding: 0;
      background-color: ${schoolColors.lightGray};
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .email-wrapper {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .container {
      background-color: ${schoolColors.white};
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.12);
    }
    .header {
      background: linear-gradient(135deg, ${schoolColors.charcoal} 0%, ${schoolColors.darkGray} 100%);
      padding: 30px 30px 25px;
      text-align: center;
      border-bottom: 2px solid ${schoolColors.secondary};
    }
    .logo {
      font-size: 28px;
      font-weight: 700;
      color: ${schoolColors.white};
      margin-bottom: 8px;
      letter-spacing: 0.5px;
    }
    .subtitle {
      color: ${schoolColors.goldLight};
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-weight: 500;
    }
    .content {
      padding: 30px;
      color: ${schoolColors.text};
    }
    .content h2 {
      font-size: 24px;
      font-weight: 600;
      margin-top: 0;
      margin-bottom: 20px;
      line-height: 1.3;
    }
    .content p {
      margin: 0 0 16px 0;
      font-size: 15px;
      line-height: 1.7;
    }
    .content ul, .content ol {
      margin: 16px 0;
      padding-left: 24px;
    }
    .content li {
      margin-bottom: 8px;
      line-height: 1.6;
    }
    .button {
      display: inline-block;
      padding: 14px 28px;
      background: ${schoolColors.secondary};
      color: ${schoolColors.charcoal};
      text-decoration: none;
      border-radius: 8px;
      margin: 24px 0;
      font-weight: 600;
      font-size: 15px;
      text-align: center;
      transition: background 0.2s ease;
      box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);
    }
    .button:hover {
      background: ${schoolColors.goldDark};
    }
    .footer {
      margin-top: 30px;
      padding: 25px 30px;
      background-color: ${schoolColors.cream};
      border-top: 1px solid ${schoolColors.lightGray};
      font-size: 12px;
      color: ${schoolColors.textLight};
      text-align: center;
      line-height: 1.6;
    }
    .footer p {
      margin: 8px 0;
    }
    .highlight {
      background: linear-gradient(135deg, ${schoolColors.goldLight} 0%, ${schoolColors.cream} 100%);
      padding: 20px;
      border-left: 4px solid ${schoolColors.secondary};
      margin: 24px 0;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .highlight p {
      margin: 8px 0;
    }
    .highlight strong {
      color: ${schoolColors.charcoal};
      font-weight: 600;
    }
    .divider {
      height: 1px;
      background: ${schoolColors.lightGray};
      margin: 24px 0;
      border: none;
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper {
        padding: 10px;
      }
      .header, .content, .footer {
        padding: 20px;
      }
      .logo {
        font-size: 24px;
      }
      .content h2 {
        font-size: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="container">
      <div class="header">
        <div class="logo">York Castle High School</div>
        <div class="subtitle">Excellence in Education</div>
      </div>
      <div class="content">
        ${content}
      </div>
      <div class="footer">
        <p><strong>York Castle High School</strong></p>
        <p>This is an automated message. Please do not reply to this email.</p>
        <p>For inquiries, contact: <a href="mailto:yorkcastle.high.san@moey.gov.jm" style="color: ${schoolColors.secondary}; text-decoration: none;">yorkcastle.high.san@moey.gov.jm</a></p>
        <p>&copy; ${new Date().getFullYear()} York Castle High School. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

export const templates = {
  /**
   * Application status update email
   */
  applicationStatus: (name, status, applicationId) => {
    const statusConfig = {
      APPROVED: {
        title: 'Application Approved',
        message: `Congratulations! Your application to York Castle High School has been <strong>approved</strong>.`,
        details: 'We are delighted to offer you a place at our school. You will receive further instructions via email or mail.',
        color: '#16a34a',
      },
      REJECTED: {
        title: 'Application Update',
        message: `Thank you for your interest in York Castle High School.`,
        details: 'Unfortunately, we are unable to offer you a place at this time. We appreciate your interest and wish you the best in your educational journey.',
        color: '#dc2626',
      },
      WAITLISTED: {
        title: 'Application Waitlisted',
        message: `Your application to York Castle High School has been placed on our <strong>waitlist</strong>.`,
        details: 'We will contact you if a place becomes available. Please ensure your contact information is up to date.',
        color: '#f59e0b',
      },
      UNDER_REVIEW: {
        title: 'Application Under Review',
        message: `Your application to York Castle High School is currently <strong>under review</strong>.`,
        details: 'We are carefully reviewing your application and will notify you of our decision soon.',
        color: '#3b82f6',
      },
    };

    const config = statusConfig[status] || statusConfig.UNDER_REVIEW;

    const content = `
      <h2 style="color: ${config.color}; margin-top: 0;">${config.title}</h2>
      <p>Dear ${name},</p>
      <p>${config.message}</p>
      <div class="highlight">
        <p style="margin-top: 0;"><strong>${config.details}</strong></p>
        ${applicationId ? `<p style="margin-bottom: 0;"><small style="color: ${schoolColors.textLight}; font-size: 13px;">Application ID: <strong>${applicationId}</strong></small></p>` : ''}
      </div>
      <p>If you have any questions, please contact our admissions office at <a href="mailto:yorkcastle.high.san@moey.gov.jm" style="color: ${schoolColors.secondary}; text-decoration: none;">yorkcastle.high.san@moey.gov.jm</a> or call us at <a href="tel:+1876975-2217" style="color: ${schoolColors.secondary}; text-decoration: none;">+1 876 975-2217</a>.</p>
      <p>Best regards,<br><strong>York Castle High School</strong><br><span style="color: ${schoolColors.textLight}; font-size: 14px;">Admissions Office</span></p>
    `;

    return {
      subject: `${config.title} - York Castle High School`,
      html: baseTemplate(content, config.title),
      text: `${config.title}\n\nDear ${name},\n\n${config.message}\n\n${config.details}\n\nBest regards,\nYork Castle High School`,
    };
  },

  /**
   * Admin notification email - sent to staff each time a new request is submitted
   */
  adminNewRequest: ({ requestType, requesterName, requesterEmail, requesterPhone, requestId, requestUrl, submittedAt }) => {
    const submitted = submittedAt ? new Date(submittedAt) : new Date();
    const submittedStr = submitted.toLocaleString('en-JM', { dateStyle: 'medium', timeStyle: 'short' });

    const content = `
      <h2 style="color: ${schoolColors.secondary}; margin-top: 0;">New Request Submitted</h2>
      <p>A new request has just been submitted through the York Castle High School website and needs your attention.</p>
      <div class="highlight">
        <p style="margin-top: 0;"><strong>Request Type:</strong> ${requestType || 'Request'}</p>
        <p><strong>Submitted By:</strong> ${requesterName || 'Unknown'}</p>
        ${requesterEmail ? `<p><strong>Email:</strong> ${requesterEmail}</p>` : ''}
        ${requesterPhone ? `<p><strong>Phone:</strong> ${requesterPhone}</p>` : ''}
        <p><strong>Submitted On:</strong> ${submittedStr}</p>
        <p style="margin-bottom: 0;"><strong>Request ID:</strong> <span style="font-family: monospace; background: ${schoolColors.lightGray}; padding: 4px 8px; border-radius: 4px;">${requestId}</span></p>
      </div>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${requestUrl}" class="button" style="display: inline-block;">View Request</a>
      </p>
      <p style="color: ${schoolColors.textLight}; font-size: 14px;">If the button above doesn't work, copy and paste this link into your browser:<br>
        <a href="${requestUrl}" style="color: ${schoolColors.goldDark}; word-break: break-all;">${requestUrl}</a>
      </p>
      <p>You will need to sign in to the administrative portal to view and process this request.</p>
    `;

    return {
      subject: `New ${requestType || 'Request'} Submitted - York Castle High School`,
      html: baseTemplate(content, 'New Request Submitted'),
      text: `New Request Submitted\n\nA new request has been submitted through the website.\n\nRequest Type: ${requestType || 'Request'}\nSubmitted By: ${requesterName || 'Unknown'}\n${requesterEmail ? `Email: ${requesterEmail}\n` : ''}${requesterPhone ? `Phone: ${requesterPhone}\n` : ''}Submitted On: ${submittedStr}\nRequest ID: ${requestId}\n\nView the request here:\n${requestUrl}\n\nYork Castle High School`,
    };
  },

  /**
   * Request assignment email - sent to a staff member when a request is assigned to them
   */
  requestAssignment: ({ staffName, requestType, requesterName, requesterEmail, requesterPhone, assignedByName, requestId, requestUrl, submittedAt }) => {
    const submitted = submittedAt ? new Date(submittedAt) : new Date();
    const submittedStr = submitted.toLocaleString('en-JM', { dateStyle: 'medium', timeStyle: 'short' });
    const firstName = (staffName || '').trim().split(' ')[0] || 'there';

    const content = `
      <h2 style="color: ${schoolColors.secondary}; margin-top: 0;">A Request Has Been Assigned to You</h2>
      <p>Hi ${firstName},</p>
      <p>${assignedByName ? `${assignedByName} has assigned` : 'You have been assigned'} a request to you on the York Castle High School administrative portal. Please review and process it.</p>
      <div class="highlight">
        <p style="margin-top: 0;"><strong>Request Type:</strong> ${requestType || 'Request'}</p>
        <p><strong>Submitted By:</strong> ${requesterName || 'Unknown'}</p>
        ${requesterEmail ? `<p><strong>Email:</strong> ${requesterEmail}</p>` : ''}
        ${requesterPhone ? `<p><strong>Phone:</strong> ${requesterPhone}</p>` : ''}
        <p><strong>Submitted On:</strong> ${submittedStr}</p>
        <p style="margin-bottom: 0;"><strong>Request ID:</strong> <span style="font-family: monospace; background: ${schoolColors.lightGray}; padding: 4px 8px; border-radius: 4px;">${requestId}</span></p>
      </div>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${requestUrl}" class="button" style="display: inline-block;">View Request</a>
      </p>
      <p style="color: ${schoolColors.textLight}; font-size: 14px;">If the button above doesn't work, copy and paste this link into your browser:<br>
        <a href="${requestUrl}" style="color: ${schoolColors.goldDark}; word-break: break-all;">${requestUrl}</a>
      </p>
      <p>You will need to sign in to the administrative portal to view and process this request.</p>
    `;

    return {
      subject: `Request Assigned to You - ${requestType || 'Request'} - York Castle High School`,
      html: baseTemplate(content, 'Request Assigned to You'),
      text: `A Request Has Been Assigned to You\n\nHi ${firstName},\n\n${assignedByName ? `${assignedByName} has assigned` : 'You have been assigned'} a request to you on the administrative portal.\n\nRequest Type: ${requestType || 'Request'}\nSubmitted By: ${requesterName || 'Unknown'}\n${requesterEmail ? `Email: ${requesterEmail}\n` : ''}${requesterPhone ? `Phone: ${requesterPhone}\n` : ''}Submitted On: ${submittedStr}\nRequest ID: ${requestId}\n\nView the request here:\n${requestUrl}\n\nYork Castle High School`,
    };
  },

  /**
   * Admin notification email - sent to staff each time a new sixth-form application is submitted
   */
  adminNewSixthFormApplication: ({ applicantName, applicantEmail, applicantPhone, applicationId, applicationUrl, submittedAt }) => {
    const submitted = submittedAt ? new Date(submittedAt) : new Date();
    const submittedStr = submitted.toLocaleString('en-JM', { dateStyle: 'medium', timeStyle: 'short' });

    const content = `
      <h2 style="color: ${schoolColors.secondary}; margin-top: 0;">New Sixth-Form Application Submitted</h2>
      <p>A new sixth-form application has just been submitted through the York Castle High School website and needs your attention.</p>
      <div class="highlight">
        <p style="margin-top: 0;"><strong>Applicant:</strong> ${applicantName || 'Unknown'}</p>
        ${applicantEmail ? `<p><strong>Email:</strong> ${applicantEmail}</p>` : ''}
        ${applicantPhone ? `<p><strong>Phone:</strong> ${applicantPhone}</p>` : ''}
        <p><strong>Submitted On:</strong> ${submittedStr}</p>
        <p style="margin-bottom: 0;"><strong>Application ID:</strong> <span style="font-family: monospace; background: ${schoolColors.lightGray}; padding: 4px 8px; border-radius: 4px;">${applicationId}</span></p>
      </div>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${applicationUrl}" class="button" style="display: inline-block;">View Application</a>
      </p>
      <p style="color: ${schoolColors.textLight}; font-size: 14px;">If the button above doesn't work, copy and paste this link into your browser:<br>
        <a href="${applicationUrl}" style="color: ${schoolColors.goldDark}; word-break: break-all;">${applicationUrl}</a>
      </p>
      <p>You will need to sign in to the administrative portal to view and process this application.</p>
    `;

    return {
      subject: `New Sixth-Form Application Submitted - York Castle High School`,
      html: baseTemplate(content, 'New Sixth-Form Application Submitted'),
      text: `New Sixth-Form Application Submitted\n\nA new sixth-form application has been submitted through the website.\n\nApplicant: ${applicantName || 'Unknown'}\n${applicantEmail ? `Email: ${applicantEmail}\n` : ''}${applicantPhone ? `Phone: ${applicantPhone}\n` : ''}Submitted On: ${submittedStr}\nApplication ID: ${applicationId}\n\nView the application here:\n${applicationUrl}\n\nYork Castle High School`,
    };
  },

  /**
   * Admin notification email - sent to staff each time a new admission application is submitted
   */
  adminNewApplication: ({ applicantName, applicantEmail, applicantPhone, gradeApplying, applicationId, applicationUrl, submittedAt }) => {
    const submitted = submittedAt ? new Date(submittedAt) : new Date();
    const submittedStr = submitted.toLocaleString('en-JM', { dateStyle: 'medium', timeStyle: 'short' });

    const content = `
      <h2 style="color: ${schoolColors.secondary}; margin-top: 0;">New Admission Application Submitted</h2>
      <p>A new admission application has just been submitted through the York Castle High School website and needs your attention.</p>
      <div class="highlight">
        <p style="margin-top: 0;"><strong>Applicant:</strong> ${applicantName || 'Unknown'}</p>
        ${applicantEmail ? `<p><strong>Email:</strong> ${applicantEmail}</p>` : ''}
        ${applicantPhone ? `<p><strong>Phone:</strong> ${applicantPhone}</p>` : ''}
        ${gradeApplying ? `<p><strong>Grade Applying For:</strong> ${gradeApplying}</p>` : ''}
        <p><strong>Submitted On:</strong> ${submittedStr}</p>
        <p style="margin-bottom: 0;"><strong>Application ID:</strong> <span style="font-family: monospace; background: ${schoolColors.lightGray}; padding: 4px 8px; border-radius: 4px;">${applicationId}</span></p>
      </div>
      <p style="text-align: center; margin: 30px 0;">
        <a href="${applicationUrl}" class="button" style="display: inline-block;">View Application</a>
      </p>
      <p style="color: ${schoolColors.textLight}; font-size: 14px;">If the button above doesn't work, copy and paste this link into your browser:<br>
        <a href="${applicationUrl}" style="color: ${schoolColors.goldDark}; word-break: break-all;">${applicationUrl}</a>
      </p>
      <p>You will need to sign in to the administrative portal to view and process this application.</p>
    `;

    return {
      subject: `New Admission Application Submitted - York Castle High School`,
      html: baseTemplate(content, 'New Admission Application Submitted'),
      text: `New Admission Application Submitted\n\nA new admission application has been submitted through the website.\n\nApplicant: ${applicantName || 'Unknown'}\n${applicantEmail ? `Email: ${applicantEmail}\n` : ''}${applicantPhone ? `Phone: ${applicantPhone}\n` : ''}${gradeApplying ? `Grade Applying For: ${gradeApplying}\n` : ''}Submitted On: ${submittedStr}\nApplication ID: ${applicationId}\n\nView the application here:\n${applicationUrl}\n\nYork Castle High School`,
    };
  },

  /**
   * Request confirmation email
   */
  requestConfirmation: (name, requestType, requestId) => {
    const content = `
      <h2 style="color: ${schoolColors.secondary}; margin-top: 0;">Request Received</h2>
      <p>Dear ${name},</p>
      <p>We have received your request for <strong>${requestType}</strong>.</p>
      <div class="highlight">
        <p style="margin-top: 0;"><strong>Request Details:</strong></p>
        <p><strong>Request Type:</strong> ${requestType}</p>
        <p style="margin-bottom: 0;"><strong>Request ID:</strong> <span style="font-family: monospace; background: ${schoolColors.lightGray}; padding: 4px 8px; border-radius: 4px;">${requestId}</span></p>
      </div>
      <p>Your request is being processed and you will be notified once it's completed. We typically process requests within 3-5 business days.</p>
      <p>If you have any questions about your request, please contact our administration office at <a href="mailto:yorkcastle.high.san@moey.gov.jm" style="color: ${schoolColors.secondary}; text-decoration: none;">yorkcastle.high.san@moey.gov.jm</a> or call us at <a href="tel:+1876975-2217" style="color: ${schoolColors.secondary}; text-decoration: none;">+1 876 975-2217</a>.</p>
      <p>Best regards,<br><strong>York Castle High School</strong><br><span style="color: ${schoolColors.textLight}; font-size: 14px;">Administration Office</span></p>
    `;

    return {
      subject: `Request Confirmation - ${requestType} - York Castle High School`,
      html: baseTemplate(content, 'Request Confirmation'),
      text: `Request Confirmation\n\nDear ${name},\n\nWe have received your request for ${requestType}.\n\nRequest ID: ${requestId}\n\nYour request is being processed.\n\nBest regards,\nYork Castle High School`,
    };
  },

  /**
   * Request status update email
   */
  requestStatusUpdate: (name, requestType, status, requestId) => {
    const statusConfig = {
      COMPLETED: {
        message: 'Your request has been <strong>completed</strong>.',
        details: 'Your document is ready. Please contact the administration office to arrange collection or delivery.',
      },
      IN_PROGRESS: {
        message: 'Your request is now <strong>in progress</strong>.',
        details: 'We are currently processing your request and will notify you when it\'s ready.',
      },
      REJECTED: {
        message: 'Your request has been <strong>rejected</strong>.',
        details: 'Unfortunately, we are unable to fulfill your request at this time. Please contact the administration office for more information.',
      },
    };

    const config = statusConfig[status] || {
      message: `Your request status has been updated to <strong>${status}</strong>.`,
      details: 'Please check your request details for more information.',
    };

    const statusColors = {
      COMPLETED: schoolColors.secondary,
      IN_PROGRESS: '#3b82f6',
      REJECTED: '#dc2626',
    };
    const statusColor = statusColors[status] || schoolColors.textLight;
    
    const content = `
      <h2 style="color: ${statusColor}; margin-top: 0;">Request Status Update</h2>
      <p>Dear ${name},</p>
      <p>${config.message}</p>
      <div class="highlight">
        <p style="margin-top: 0;"><strong>Request Information:</strong></p>
        <p><strong>Request Type:</strong> ${requestType}</p>
        <p><strong>Request ID:</strong> <span style="font-family: monospace; background: ${schoolColors.lightGray}; padding: 4px 8px; border-radius: 4px;">${requestId}</span></p>
        <p style="margin-bottom: 0;"><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: 600;">${status}</span></p>
      </div>
      <p>${config.details}</p>
      <p>If you have any questions, please contact our administration office at <a href="mailto:yorkcastle.high.san@moey.gov.jm" style="color: ${schoolColors.secondary}; text-decoration: none;">yorkcastle.high.san@moey.gov.jm</a> or call us at <a href="tel:+1876975-2217" style="color: ${schoolColors.secondary}; text-decoration: none;">+1 876 975-2217</a>.</p>
      <p>Best regards,<br><strong>York Castle High School</strong><br><span style="color: ${schoolColors.textLight}; font-size: 14px;">Administration Office</span></p>
    `;

    return {
      subject: `Request Update - ${requestType} - York Castle High School`,
      html: baseTemplate(content, 'Request Status Update'),
      text: `Request Status Update\n\nDear ${name},\n\n${config.message}\n\nRequest Type: ${requestType}\nRequest ID: ${requestId}\nStatus: ${status}\n\n${config.details}\n\nBest regards,\nYork Castle High School`,
    };
  },

  /**
   * Welcome email for new users
   */
  welcome: (name, email, role) => {
    const content = `
      <h2 style="color: ${schoolColors.secondary}; margin-top: 0;">Welcome to York Castle High School Portal</h2>
      <p>Dear ${name},</p>
      <p>Welcome to the York Castle High School administrative portal! We're excited to have you join our team.</p>
      <div class="highlight">
        <p style="margin-top: 0;"><strong>Your Account Details:</strong></p>
        <p><strong>Email:</strong> ${email}</p>
        <p style="margin-bottom: 0;"><strong>Role:</strong> <span style="text-transform: capitalize;">${role}</span></p>
      </div>
      <p>You can now access the admin dashboard and manage school resources. Please keep your login credentials secure and do not share them with anyone.</p>
      <p>If you have any questions or need assistance, please contact the system administrator.</p>
      <p>Best regards,<br><strong>York Castle High School</strong><br><span style="color: ${schoolColors.textLight}; font-size: 14px;">IT Department</span></p>
    `;

    return {
      subject: 'Welcome to York Castle High School Portal',
      html: baseTemplate(content, 'Welcome'),
      text: `Welcome to York Castle High School\n\nDear ${name},\n\nWelcome to the York Castle High School portal!\n\nYour Account:\nEmail: ${email}\nRole: ${role}\n\nBest regards,\nYork Castle High School`,
    };
  },

  /**
   * Invitation email for newly created users
   */
  invitation: (name, email, role, authMethod, loginUrl) => {
    const isOAuth = authMethod === 'GOOGLE';
    const loginInstructions = isOAuth
      ? `
        <div class="highlight">
          <p style="margin-top: 0;"><strong>Sign In with Google:</strong></p>
          <p>Your account has been set up to use Google Sign-In. Please use your Google account with the email <strong>${email}</strong> to sign in.</p>
          <p><strong>Authorized Domains:</strong></p>
          <ul style="margin-top: 8px;">
            <li>@moeschools.edu.jm</li>
            <li>@yorkcastlehighschool.org</li>
          </ul>
          <p style="margin-bottom: 0; color: ${schoolColors.textLight}; font-size: 14px;"><em>Make sure you're using a Google account from one of these domains.</em></p>
        </div>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" class="button" style="display: inline-block;">Sign In with Google</a>
        </p>
      `
      : `
        <div class="highlight">
          <p style="margin-top: 0;"><strong>Your Account Details:</strong></p>
          <p><strong>Email:</strong> ${email}</p>
          <p style="margin-bottom: 0;"><strong>Role:</strong> <span style="text-transform: capitalize;">${role}</span></p>
        </div>
        <p>You can now sign in to the portal using your email and password.</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${loginUrl}" class="button" style="display: inline-block;">Sign In to Portal</a>
        </p>
        <p style="color: ${schoolColors.textLight}; font-size: 14px;"><em>If you need to reset your password, please contact the system administrator.</em></p>
      `;

    const content = `
      <h2 style="color: ${schoolColors.secondary}; margin-top: 0;">You've Been Invited to York Castle High School Portal</h2>
      <p>Dear ${name},</p>
      <p>An account has been created for you on the York Castle High School administrative portal. You can now access the dashboard and manage school resources.</p>
      ${loginInstructions}
      <p>If you have any questions or need assistance, please contact the system administrator at <a href="mailto:yorkcastle.high.san@moey.gov.jm" style="color: ${schoolColors.secondary}; text-decoration: none;">yorkcastle.high.san@moey.gov.jm</a>.</p>
      <p>Best regards,<br><strong>York Castle High School</strong><br><span style="color: ${schoolColors.textLight}; font-size: 14px;">IT Department</span></p>
    `;

    const textContent = isOAuth
      ? `You've Been Invited to York Castle High School Portal\n\nDear ${name},\n\nAn account has been created for you on the York Castle High School administrative portal.\n\nSign In with Google:\nYour account has been set up to use Google Sign-In. Please use your Google account with the email ${email} to sign in.\n\nMake sure you're using a Google account from one of these domains:\n- @moeschools.edu.jm\n- @yorkcastlehighschool.org\n\nSign in at: ${loginUrl}\n\nBest regards,\nYork Castle High School`
      : `You've Been Invited to York Castle High School Portal\n\nDear ${name},\n\nAn account has been created for you on the York Castle High School administrative portal.\n\nYour Account:\nEmail: ${email}\nRole: ${role}\n\nSign in at: ${loginUrl}\n\nBest regards,\nYork Castle High School`;

    return {
      subject: 'Invitation to York Castle High School Portal',
      html: baseTemplate(content, 'Account Invitation'),
      text: textContent,
    };
  },

  /**
   * Sixth Form interview invitation - sent in bulk to selected applicants for
   * the single fixed interview session. Content mirrors the notice shown on
   * sixth-form-application.html's closed-applications screen.
   */
  sixthFormInterviewInvitation: (name) => {
    const documents = [
      'Copy of your birth certificate',
      'Copy of your TRN',
      'Copy of your SRN',
      'Copy of your CSEC results',
      'Two passport-sized photographs',
      'Your last two school reports',
      'Two recommendation letters (from a Principal, Teacher, Justice of the Peace, or Minister of Religion)',
    ];

    const content = `
      <h2 style="color: ${schoolColors.secondary}; margin-top: 0;">You're Invited to Interview</h2>
      <p>Dear ${name},</p>
      <p>Congratulations — you have been invited to interview for the Sixth Form Programme at York Castle High School.</p>
      <div class="highlight">
        <p style="margin-top: 0;"><strong>Date:</strong> Tuesday, August 25, 2026</p>
        <p><strong>Time:</strong> 8:30 a.m.</p>
        <p style="margin-bottom: 0;"><strong>Location:</strong> York Castle High School, Brown's Town, St. Ann</p>
      </div>
      <p><strong>Please bring the following documents to your interview:</strong></p>
      <ul style="margin-top: 8px;">
        ${documents.map((d) => `<li>${d}</li>`).join('\n        ')}
      </ul>
      <div class="highlight" style="border-left-color: #f59e0b;">
        <p style="margin: 0;">A non-refundable processing fee of <strong>J$2,000</strong> is payable on the day of the interview.</p>
      </div>
      <p>If you have any questions, please contact our admissions office at <a href="mailto:yorkcastle.high.san@moey.gov.jm" style="color: ${schoolColors.secondary}; text-decoration: none;">yorkcastle.high.san@moey.gov.jm</a> or call us at <a href="tel:+1876975-2217" style="color: ${schoolColors.secondary}; text-decoration: none;">+1 876 975-2217</a>.</p>
      <p>We look forward to meeting you.</p>
      <p>Best regards,<br><strong>York Castle High School</strong><br><span style="color: ${schoolColors.textLight}; font-size: 14px;">Admissions Office</span></p>
    `;

    const textDocs = documents.map((d) => `- ${d}`).join('\n');

    return {
      subject: 'Sixth Form Interview Invitation - York Castle High School',
      html: baseTemplate(content, 'Interview Invitation'),
      text: `You're Invited to Interview\n\nDear ${name},\n\nYou have been invited to interview for the Sixth Form Programme at York Castle High School.\n\nDate: Tuesday, August 25, 2026\nTime: 8:30 a.m.\nLocation: York Castle High School, Brown's Town, St. Ann\n\nPlease bring:\n${textDocs}\n\nA non-refundable processing fee of J$2,000 is payable on the day of the interview.\n\nWe look forward to meeting you.\n\nBest regards,\nYork Castle High School`,
    };
  },
};





