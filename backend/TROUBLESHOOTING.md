# Troubleshooting Guide - York Castle High School Backend

This guide consolidates common issues and solutions for the York Castle High School application backend.

## Database Connection Issues

### "Can't reach database server" Error

**Most Common Cause**: Supabase project is paused (free tier pauses after 1 week of inactivity).

#### Solution:
1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/[PROJECT-ID]
2. If you see "Project Paused" or "Restore" button, click it
3. Wait 1-2 minutes for project to restore
4. Test connection: `npm run db:test`

### Connection String Issues

#### Verify DATABASE_URL in `.env`:
```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

#### Get correct connection string:
1. Dashboard → Settings → Database
2. Click "URI" tab (not "Connection string")
3. Copy the connection string
4. Replace `[YOUR-PASSWORD]` with actual database password
5. Update `backend/.env` file

#### URL Encoding for Special Characters:
- `@` → `%40`
- `#` → `%23`
- `%` → `%25`
- `&` → `%26`
- `+` → `%2B`
- `=` → `%3D`

### IP Restrictions

Supabase might block your IP address.

#### Fix:
1. Dashboard → Settings → Database
2. Scroll to "Connection Pooling" section
3. Check "Allowed IPs"
4. Add your IP or set to `0.0.0.0/0` (allows all IPs - less secure)

### Try Connection Pooler

If direct connection (port 5432) fails, use the pooler:

```env
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Note**: Use direct connection (5432) for migrations, pooler (6543) for app runtime.

## Testing Database Connection

```bash
cd backend

# Test connection
npm run db:test

# Or use Prisma directly
npx prisma db pull --force

# Or test with psql (if installed)
psql "DATABASE_URL" -c "SELECT version();"
```

## Supabase CLI Issues

### Login and Project Linking

```bash
# Login to Supabase CLI
npx supabase login

# Link project
npx supabase link --project-ref [PROJECT-REF]

# List projects (shows status)
npx supabase projects list

# Check project API keys
npx supabase projects api-keys --project-ref [PROJECT-REF]
```

## Environment Variables

### Required Variables

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=your-very-secure-secret-key-here
PORT=3000
CORS_ORIGIN=https://yourschool.edu.jm
```

### Email Configuration (Optional)

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
SMTP_FROM=noreply@yourschool.edu.jm
```

## Network Testing

### Basic Connectivity Tests

```bash
# Ping database host
ping db.[PROJECT-REF].supabase.co

# Test port connectivity
telnet db.[PROJECT-REF].supabase.co 5432
```

## Password Reset

If connection issues persist:
1. Dashboard → Settings → Database
2. Click "Reset database password"
3. Update `.env` with new password
4. Restart application

## Firewall and Network Issues

- Ensure port 5432 (direct) or 6543 (pooler) is not blocked
- Try from different network if possible
- Check VPN/proxy settings

## Migration Issues

### For Production Deployments

Use the production migration script:
```bash
cd backend
NODE_ENV=production node scripts/migrate-production.js
```

This script:
- Creates database backup before migration
- Runs migrations safely
- Verifies success
- Provides rollback instructions if needed

## Performance Issues

### Slow Queries

1. Check database indexes
2. Use connection pooling (port 6543)
3. Monitor query execution plans
4. Consider query optimization

### Memory Usage

- Monitor heap usage in production
- Configure appropriate memory limits
- Check for memory leaks

## Vercel Deployment Issues

### Environment Variables

Ensure all required environment variables are set in Vercel dashboard.

### Cold Start Optimization

- Reduce bundle size
- Lazy load heavy dependencies
- Use connection pooling

### API Timeouts

- Use shorter timeout values for serverless
- Implement request retry logic
- Optimize database queries

## Logging

### Log Levels

- `error` - Errors only
- `warn` - Warnings and errors
- `info` - Informational messages (production default)
- `debug` - Detailed debugging (development default)

### Log Files (Non-Serverless)

- `backend/logs/combined.log` - All logs
- `backend/logs/error.log` - Error logs only
- `backend/logs/exceptions.log` - Uncaught exceptions
- `backend/logs/rejections.log` - Unhandled promise rejections

### Viewing Logs

```bash
# Direct log files
tail -f backend/logs/combined.log
tail -f backend/logs/error.log

# If using PM2
pm2 logs york-castle-api
```

## File Upload Issues

### Upload Directory

- Ensure `backend/uploads/` directory exists
- Check file permissions
- Verify disk space availability

### File Size Limits

- Default max file size: 10MB
- Check multer configuration in `middleware/upload.js`
- Adjust limits based on requirements

## Email Service Issues

### SMTP Configuration

- Verify SMTP credentials in environment variables
- Test connection: `npm run test:email`
- Check spam folders
- Verify SMTP server allows connections

### Template Issues

- Check email templates in `services/emailTemplates.js`
- Verify HTML/CSS compatibility
- Test with different email clients

## Rate Limiting

### Current Limits

- Auth endpoints: 5 requests per 15 minutes per IP
- Public requests: 5 requests per hour per IP
- Admin endpoints: 50 requests per 15 minutes per IP
- General API: 100 requests per 15 minutes per IP

### Rate Limit Errors

If hitting rate limits:
- Implement exponential backoff
- Cache responses when possible
- Consider upgrading to Redis-based rate limiting

## Security Issues

### CORS Errors

- Verify `CORS_ORIGIN` environment variable
- Check browser console for specific errors
- Ensure origins match deployment domain

### JWT Issues

- Verify `JWT_SECRET` is set and strong (min 32 characters)
- Check token expiration times
- Validate token signing/verification

## Backup and Recovery

### Database Backups

- Use Supabase automated backups
- Export data regularly: `pg_dump`
- Store backups securely

### Application Backups

- Backup `backend/uploads/` directory
- Store environment variables securely
- Keep migration history intact

## Support

For persistent issues:
1. Check application logs
2. Verify environment configuration
3. Test with minimal setup
4. Contact support with specific error messages and reproduction steps