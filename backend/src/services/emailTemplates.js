/**
 * Email Templates for York Castle High School
 * Provides HTML email templates for various notifications
 */

const schoolColors = {
  primary: '#8b0000', // Maroon
  secondary: '#d4af37', // Gold
  text: '#1f2937',
  light: '#f9fafb',
};

const baseTemplate = (content, title) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: ${schoolColors.text};
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f3f4f6;
    }
    .container {
      background-color: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      border-bottom: 3px solid ${schoolColors.secondary};
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .logo {
      font-size: 24px;
      font-weight: bold;
      color: ${schoolColors.primary};
      margin-bottom: 5px;
    }
    .subtitle {
      color: #6b7280;
      font-size: 14px;
    }
    .content {
      margin: 20px 0;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background: linear-gradient(135deg, ${schoolColors.primary}, #a52a2a);
      color: white;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
      font-weight: 600;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
      text-align: center;
    }
    .highlight {
      background-color: #fef3c7;
      padding: 15px;
      border-left: 4px solid ${schoolColors.secondary};
      margin: 20px 0;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">York Castle High School</div>
      <div class="subtitle">Excellence in Education</div>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>This is an automated message from York Castle High School.</p>
      <p>Please do not reply to this email.</p>
      <p>&copy; ${new Date().getFullYear()} York Castle High School. All rights reserved.</p>
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
      <h2 style="color: ${config.color};">${config.title}</h2>
      <p>Dear ${name},</p>
      <p>${config.message}</p>
      <div class="highlight">
        <p><strong>${config.details}</strong></p>
      </div>
      ${applicationId ? `<p><small>Application ID: ${applicationId}</small></p>` : ''}
      <p>If you have any questions, please contact our admissions office.</p>
      <p>Best regards,<br><strong>York Castle High School</strong></p>
    `;

    return {
      subject: `${config.title} - York Castle High School`,
      html: baseTemplate(content, config.title),
      text: `${config.title}\n\nDear ${name},\n\n${config.message}\n\n${config.details}\n\nBest regards,\nYork Castle High School`,
    };
  },

  /**
   * Request confirmation email
   */
  requestConfirmation: (name, requestType, requestId) => {
    const content = `
      <h2 style="color: ${schoolColors.primary};">Request Received</h2>
      <p>Dear ${name},</p>
      <p>We have received your request for <strong>${requestType}</strong>.</p>
      <div class="highlight">
        <p><strong>Request ID:</strong> ${requestId}</p>
        <p>Your request is being processed and you will be notified once it's completed.</p>
      </div>
      <p>If you have any questions about your request, please contact our administration office.</p>
      <p>Best regards,<br><strong>York Castle High School</strong></p>
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

    const content = `
      <h2 style="color: ${schoolColors.primary};">Request Status Update</h2>
      <p>Dear ${name},</p>
      <p>${config.message}</p>
      <div class="highlight">
        <p><strong>Request Type:</strong> ${requestType}</p>
        <p><strong>Request ID:</strong> ${requestId}</p>
        <p><strong>Status:</strong> ${status}</p>
      </div>
      <p>${config.details}</p>
      <p>Best regards,<br><strong>York Castle High School</strong></p>
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
      <h2 style="color: ${schoolColors.primary};">Welcome to York Castle High School</h2>
      <p>Dear ${name},</p>
      <p>Welcome to the York Castle High School portal!</p>
      <div class="highlight">
        <p><strong>Your Account Details:</strong></p>
        <p>Email: ${email}</p>
        <p>Role: ${role}</p>
      </div>
      <p>You can now access the admin dashboard and manage school resources.</p>
      <p>If you have any questions, please contact the system administrator.</p>
      <p>Best regards,<br><strong>York Castle High School</strong></p>
    `;

    return {
      subject: 'Welcome to York Castle High School Portal',
      html: baseTemplate(content, 'Welcome'),
      text: `Welcome to York Castle High School\n\nDear ${name},\n\nWelcome to the York Castle High School portal!\n\nYour Account:\nEmail: ${email}\nRole: ${role}\n\nBest regards,\nYork Castle High School`,
    };
  },
};





