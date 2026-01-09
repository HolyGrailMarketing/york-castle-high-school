/**
 * Test script to verify email configuration and send a test email
 */

import dotenv from 'dotenv';
import { initEmailService, sendInvitationEmail, isEmailConfigured } from '../src/services/emailService.js';

dotenv.config({ path: './.env' });

async function testEmail() {
  console.log('📧 Testing Email Configuration...\n');

  // Initialize email service
  initEmailService();

  // Check if configured
  if (!isEmailConfigured()) {
    console.error('❌ Email service is NOT configured!');
    console.error('\nPlease set the following environment variables in backend/.env:');
    console.error('  - RESEND_API_KEY (get from https://resend.com/api-keys)');
    console.error('  - RESEND_FROM_EMAIL (verified email address in Resend)');
    process.exit(1);
  }

  console.log('✅ Email service is configured\n');

  // Check environment variables
  console.log('Environment Variables:');
  console.log(`  RESEND_API_KEY: ${process.env.RESEND_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`  RESEND_FROM_EMAIL: ${process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || '❌ Missing'}`);
  console.log('');

  // Get test email from command line or use default
  const testEmail = process.argv[2] || process.env.TEST_EMAIL || 'test@example.com';
  const testName = process.argv[3] || 'Test User';
  const loginUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';

  console.log(`Sending test invitation email to: ${testEmail}`);
  console.log(`Login URL: ${loginUrl}/admin/login\n`);

  try {
    await sendInvitationEmail(
      testEmail,
      testName,
      'STUDENT',
      'EMAIL',
      `${loginUrl}/admin/login`
    );
    console.log('✅ Test email sent successfully!');
    console.log(`\nCheck the inbox for: ${testEmail}`);
  } catch (error) {
    console.error('❌ Failed to send test email:');
    console.error(`   Error: ${error.message}`);
    if (error.response?.data) {
      console.error(`   Details:`, JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

testEmail().catch(console.error);
