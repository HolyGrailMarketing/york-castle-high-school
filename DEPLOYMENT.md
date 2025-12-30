# Deployment Guide - York Castle High School

This guide explains how to deploy the entire application as a **single deployment** where the backend serves everything.

## Architecture

In production, everything runs from a single Node.js server:

- **`/`** → Static HTML pages (homepage, etc.)
- **`/admin`** → Admin Dashboard (React SPA)
- **`/api/*`** → Backend API endpoints
- **`/uploads`** → Uploaded files
- **`/css`, `/js`, `/images`, etc.** → Static assets

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database (local or remote)
- Environment variables configured

## Deployment Steps

### 1. Prepare Environment

```bash
# Set production environment
export NODE_ENV=production

# Or create a .env file in backend/
cd backend
cp .env.example .env
# Edit .env with production values
```

### 2. Install Dependencies

```bash
# From project root
npm run setup
```

### 3. Set Up Database

```bash
# Generate Prisma client
cd backend
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed database (optional, remove in production)
npm run prisma:seed
```

### 4. Build Admin Dashboard

```bash
# From project root
npm run build:production

# This creates admin-dashboard/dist/ with production build
```

### 5. Configure Environment Variables

Create `backend/.env` file with the following variables:

```env
# Required Variables
NODE_ENV=production
PORT=3000

# Database (Required)
DATABASE_URL=postgresql://user:password@host:5432/database

# JWT Secret (Required - at least 32 characters)
# Generate with: openssl rand -base64 32
JWT_SECRET=your-strong-secret-key-here-minimum-32-characters

# CORS Origins (Required for production)
# Comma-separated list of allowed origins
CORS_ORIGIN=https://yourschool.edu.jm,https://www.yourschool.edu.jm

# Email Configuration (Optional but recommended)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
SMTP_FROM=noreply@yourschool.edu.jm

# Logging (Optional)
LOG_LEVEL=info
```

**Important**: The application will validate all required environment variables on startup and exit with clear error messages if any are missing or invalid.

### 6. Start Production Server

```bash
# From project root
npm run start:production

# Or from backend directory
cd backend
NODE_ENV=production npm start
```

### 7. Using a Process Manager (PM2 - Recommended)

The project includes an `ecosystem.config.js` file for easy PM2 management:

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2 using ecosystem config
pm2 start ecosystem.config.js --env production

# Or start directly
cd backend
pm2 start src/server.js --name york-castle-api --env production

# Save PM2 configuration
pm2 save

# Set up PM2 to start on system boot
pm2 startup

# Monitor
pm2 monit

# View logs
pm2 logs york-castle-api
```

The ecosystem config includes:
- Cluster mode for production (2 instances)
- Automatic restarts
- Memory limits
- Logging configuration
- Watch mode for development

### 8. Using a Reverse Proxy (Nginx)

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name yourschool.edu.jm;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourschool.edu.jm;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    # Proxy to Node.js server
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Access Points

After deployment:

- **Homepage**: `https://yourschool.edu.jm/`
- **Admin Dashboard**: `https://yourschool.edu.jm/admin`
- **API**: `https://yourschool.edu.jm/api/*`
- **API Docs**: `https://yourschool.edu.jm/api-docs`

## Development vs Production

### Development Mode

- Backend runs on `http://localhost:3000`
- Admin Dashboard runs separately on `http://localhost:5173`
- Uses Vite dev server with hot reload

### Production Mode

- Single server on `http://localhost:3000` (or configured port)
- Admin Dashboard built and served from `/admin`
- All static files served from root
- No separate frontend server needed

## Security Features

The application includes the following security features:

### Rate Limiting
- **Authentication endpoints**: 5 requests per 15 minutes per IP
- **Public request submissions**: 5 requests per hour per IP
- **Admin endpoints**: 50 requests per 15 minutes per IP
- **General API**: 100 requests per 15 minutes per IP

### Security Headers
- Content Security Policy (CSP)
- XSS Protection
- Frame Options
- HSTS (HTTP Strict Transport Security)
- All configured via Helmet middleware

### Environment Validation
- Validates all required environment variables on startup
- Checks JWT secret strength
- Validates database connection string format
- Provides clear error messages for missing configuration

## Security Checklist

- [ ] Change default admin password
- [ ] Use strong `JWT_SECRET` (at least 32 characters) - **Validated on startup**
- [ ] Enable HTTPS
- [ ] Configure proper CORS origins - **Validated on startup**
- [ ] Rate limiting is **automatically enabled**
- [ ] Security headers are **automatically enabled**
- [ ] Configure firewall rules
- [ ] Set up database backups
- [ ] Remove seed data from production
- [ ] Set `NODE_ENV=production` - **Validated on startup**
- [ ] Review file upload size limits (currently 10MB)
- [ ] Configure email service for notifications

## Troubleshooting

### Admin Dashboard Not Loading

1. Check that build was successful: `ls admin-dashboard/dist/`
2. Verify `NODE_ENV=production` is set
3. Check server logs for errors
4. Verify `/admin` route is configured in server.js

### Static Files Not Loading

1. Check file paths are correct
2. Verify static file middleware is configured
3. Check file permissions

### API Calls Failing

1. Verify CORS is configured correctly
2. Check API base URL in admin dashboard
3. Verify JWT tokens are being sent

### Database Connection Issues

1. Verify `DATABASE_URL` in `.env`
2. Check database is accessible
3. Run `npm run prisma:generate` to regenerate client

## Monitoring

### Health Check

The server includes an enhanced health check endpoint at `/health`:

```bash
curl http://localhost:3000/health
```

The health check returns:
- Server status and uptime
- Database connectivity and response time
- Memory usage
- System information (platform, CPU, Node version)
- Environment information

### Logging

The application uses structured logging with Winston:

**Log Files** (in `backend/logs/`):
- `combined.log` - All logs
- `error.log` - Error logs only
- `exceptions.log` - Uncaught exceptions
- `rejections.log` - Unhandled promise rejections

**Log Levels**:
- `error` - Errors only
- `warn` - Warnings and errors
- `info` - Informational messages (production default)
- `debug` - Detailed debugging (development default)

**Request Logging**:
- All API requests are logged with:
  - Request method, path, status code
  - Response time
  - User ID (if authenticated)
  - IP address
  - Request ID for tracing

**Viewing Logs**:

```bash
# If using PM2
pm2 logs york-castle-api

# Direct log files
tail -f backend/logs/combined.log
tail -f backend/logs/error.log

# Monitor with PM2
pm2 monit
```

### Error Tracking

All errors are logged with:
- Error ID for support reference
- Stack traces
- Request context
- User information (if available)

Error IDs are included in API error responses for support tracking.

## Backup Strategy

1. **Database Backups**: 
   - Use the production migration script which creates backups automatically
   - Set up automated PostgreSQL backups (daily recommended)
   - Backup command: `pg_dump -h <host> -U <user> -d <database> > backup.sql`

2. **File Uploads**: Backup `backend/uploads/` directory regularly

3. **Environment Variables**: Store `.env` securely (use secrets management in production)

4. **Log Files**: Rotate log files regularly (Winston handles this automatically with max size limits)

### Production Migration Script

For safe database migrations in production:

```bash
cd backend
NODE_ENV=production node scripts/migrate-production.js
```

This script:
- Validates production environment
- Creates database backup before migration
- Runs migrations safely
- Verifies migration success
- Provides rollback instructions if needed

## Updates

To update the application:

```bash
# Pull latest code
git pull

# Install new dependencies
npm run setup

# Run migrations if schema changed (use production script for safety)
cd backend
NODE_ENV=production node scripts/migrate-production.js

# Or use standard migration (development)
npm run db:migrate

# Rebuild admin dashboard
npm run build:production

# Restart server
pm2 restart york-castle-api

# Or if using ecosystem config
pm2 restart ecosystem.config.js
```

## Performance Optimizations

The application includes several performance optimizations:

1. **Response Compression**: Gzip compression enabled for all responses
2. **Static File Caching**: Cache headers set for static assets (1 year in production)
3. **Database Connection Pooling**: Configured via Prisma
4. **Cluster Mode**: PM2 runs multiple instances in production for load distribution

## Email Service

The application includes a comprehensive email template system:

**Available Templates**:
- Application status updates (approved, rejected, waitlisted)
- Request confirmations
- Request status updates
- Welcome emails for new users

**Email Configuration**:
- Validates SMTP settings on startup
- Tests connection before accepting emails
- Logs all email sending attempts
- Gracefully handles email failures

**Using Email Templates**:
```javascript
import { sendApplicationStatusEmail, sendRequestConfirmationEmail } from './services/emailService.js';

// Send application status update
await sendApplicationStatusEmail(email, name, 'APPROVED', applicationId);

// Send request confirmation
await sendRequestConfirmationEmail(email, name, 'Transcript', requestId);
```

## Support

For issues or questions, check:
- `README.md` - General information
- `SETUP.md` - Setup instructions
- `IMPLEMENTATION_SUMMARY.md` - Feature list

