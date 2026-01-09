# Environment Variables Documentation

This file documents all environment variables required for the York Castle High School backend.

## Creating .env File

Copy this content to create your `backend/.env` file:

```env
# ============================================
# REQUIRED VARIABLES
# ============================================

# Node Environment
# Options: development, production, test
NODE_ENV=development

# Server Port
# Default: 3000
PORT=3000

# Database Connection
# PostgreSQL connection string
# Format: postgresql://user:password@host:port/database

# Local PostgreSQL Example:
# DATABASE_URL=postgresql://user:password@localhost:5432/yorkcastle

# Supabase Example (Direct Connection - for migrations):
# DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres

# Supabase Example (Connection Pooler - for production application):
# DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true

# Note: Replace [YOUR-PASSWORD], [PROJECT-REF], and [REGION] with your actual Supabase values
# Get these from: Supabase Dashboard → Settings → Database → Connection string
DATABASE_URL=postgresql://user:password@localhost:5432/yorkcastle

# JWT Secret Key
# IMPORTANT: Use a strong, random string (at least 32 characters)
# Generate with: openssl rand -base64 32
# In production, use a secure secret management system
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars

# ============================================
# OPTIONAL VARIABLES
# ============================================

# CORS Origins
# Comma-separated list of allowed origins for CORS
# In production, specify your actual domain(s)
# Example: https://yourschool.edu.jm,https://www.yourschool.edu.jm
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

# ============================================
# EMAIL CONFIGURATION (Optional - Resend)
# ============================================
# Configure these if you want email notifications to work
# Leave empty if email features are not needed
# Sign up at https://resend.com to get your API key

# Resend API Key
# Get your API key from: https://resend.com/api-keys
# Example: re_1234567890abcdef
RESEND_API_KEY=

# Resend From Email Address
# Must be a verified domain in your Resend account
# Example: noreply@yorkcastlehighschool.org
# Alternative: You can use EMAIL_FROM instead
RESEND_FROM_EMAIL=noreply@yorkcastlehighschool.org

# Alternative From Email (if RESEND_FROM_EMAIL is not set)
EMAIL_FROM=noreply@yorkcastlehighschool.org

# Frontend/App URL (for invitation emails and OAuth callbacks)
# This should match your production domain
# Example: https://yorkcastlehighschool.org
FRONTEND_URL=https://yorkcastlehighschool.org
# or
APP_URL=https://yorkcastlehighschool.org

# ============================================
# LOGGING (Optional)
# ============================================

# Log Level
# Options: error, warn, info, debug
# Default: info (production), debug (development)
LOG_LEVEL=debug

# ============================================
# PRODUCTION RECOMMENDATIONS
# ============================================
# 
# 1. Change default admin password immediately
# 2. Use strong JWT_SECRET (32+ characters, random)
# 3. Enable HTTPS and configure proper CORS origins
# 4. Set up database backups
# 5. Configure email service for notifications
# 6. Set NODE_ENV=production
# 7. Review and adjust rate limiting if needed
# 8. Set up monitoring and alerting
# 9. Configure proper file upload limits
# 10. Use environment variable management (e.g., AWS Secrets Manager)
```

## Variable Descriptions

### Required Variables

- **NODE_ENV**: Environment mode. Must be `development`, `production`, or `test`
- **PORT**: Server port number (default: 3000)
- **DATABASE_URL**: PostgreSQL connection string. Must start with `postgresql://`
  - **Local**: `postgresql://user:password@localhost:5432/database`
  - **Supabase (Direct)**: `postgresql://postgres:password@db.projectref.supabase.co:5432/postgres`
  - **Supabase (Pooled)**: `postgresql://postgres.projectref:password@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true`
  - **Note**: Use direct connection for migrations, pooled connection for application runtime
- **JWT_SECRET**: Secret key for JWT tokens. Must be at least 32 characters in production

### Optional Variables

- **CORS_ORIGIN**: Comma-separated list of allowed origins for CORS
- **RESEND_API_KEY**: Resend API key for sending emails (get from https://resend.com/api-keys)
- **RESEND_FROM_EMAIL**: Verified email address to send from (must be verified in Resend, e.g., `noreply@yorkcastlehighschool.org`)
- **EMAIL_FROM**: Alternative from email address (used if RESEND_FROM_EMAIL is not set)
- **FRONTEND_URL** or **APP_URL**: Production URL for invitation emails and OAuth callbacks (e.g., `https://yorkcastlehighschool.org`)
- **LOG_LEVEL**: Logging level (error, warn, info, debug)

## Validation

The application validates all required environment variables on startup. If any are missing or invalid, the server will exit with a clear error message.

## Supabase Migration

If migrating to Supabase, see `SUPABASE_MIGRATION.md` in the project root for detailed instructions.

Quick steps:
1. Get connection string from Supabase Dashboard → Settings → Database
2. Update `DATABASE_URL` in `.env`
3. Run `npx prisma migrate deploy` to apply migrations
4. Run `npm run prisma:seed` to seed initial data (optional)

## Security Notes

1. Never commit `.env` files to version control
2. Use strong, random values for `JWT_SECRET` in production
3. Store production secrets in a secure secrets management system
4. Rotate secrets regularly
5. Use different values for development and production
6. URL-encode special characters in database passwords if needed
7. For Supabase: Use connection pooler for production, direct connection for migrations

