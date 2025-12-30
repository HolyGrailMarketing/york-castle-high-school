# Supabase Database Migration Guide

This guide will help you migrate your York Castle High School database to Supabase.

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. A Supabase project created
3. Your current database backup (if migrating from an existing database)

## Quick Start Options

### Option A: Using Supabase CLI (Recommended)

**📖 For detailed CLI instructions, see [SUPABASE_CLI_GUIDE.md](./SUPABASE_CLI_GUIDE.md)**

Quick setup with CLI:
```bash
# 1. Install Supabase CLI
brew install supabase/tap/supabase  # macOS
# or download from: https://github.com/supabase/cli/releases

# 2. Login to Supabase
supabase login

# 3. Link your project
cd backend
supabase link --project-ref your-project-ref

# 4. Deploy migrations
npx prisma migrate deploy
```

### Option B: Manual Setup (Without CLI)

Follow the steps below for manual setup without the CLI.

## Step 1: Create a Supabase Project

1. Go to https://supabase.com and sign in
2. Click **"New Project"**
3. Fill in the project details:
   - **Name**: York Castle High School (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose the closest region to your users
   - **Pricing Plan**: Free tier is sufficient for development
4. Click **"Create new project"**
5. Wait for the project to be provisioned (2-3 minutes)

## Step 2: Get Your Supabase Connection String

1. In your Supabase project dashboard, go to **Settings** → **Database**
2. Scroll down to **"Connection string"**
3. Select **"URI"** tab
4. Copy the connection string. It will look like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
5. Replace `[YOUR-PASSWORD]` with the database password you set when creating the project

### Alternative: Using Connection Pooling (Recommended for Production)

For better performance and connection management, use the connection pooler:

1. In **Settings** → **Database**, find **"Connection pooling"**
2. Copy the **"Session mode"** connection string (for migrations)
3. Or use **"Transaction mode"** for application connections

The pooled connection string looks like:
```
postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

**Note**: Use the regular connection string for migrations, and the pooled connection string for your application in production.

## Step 3: Update Environment Variables

1. Open `backend/.env` file
2. Update the `DATABASE_URL` with your Supabase connection string:

```env
# Supabase Database Connection
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

**Important**: 
- Replace `[YOUR-PASSWORD]` with your actual database password
- Replace `[PROJECT-REF]` with your actual project reference ID
- URL-encode special characters in your password if needed (e.g., `@` becomes `%40`)

### Example:
```env
DATABASE_URL=postgresql://postgres:MySecurePass123!@db.abcdefghijklmnop.supabase.co:5432/postgres
```

## Step 4: Install Dependencies (if not already done)

```bash
cd backend
npm install
```

## Step 5: Generate Prisma Client

```bash
cd backend
npx prisma generate
```

## Step 6: Run Database Migrations

This will create all the necessary tables in your Supabase database:

```bash
cd backend
npx prisma migrate deploy
```

Or if you want to create a new migration:

```bash
npx prisma migrate dev --name init
```

**Note**: The `migrate deploy` command is recommended for production/Supabase as it applies existing migrations without creating new ones.

## Step 7: Seed the Database (Optional)

If you want to populate the database with initial data:

```bash
cd backend
npm run prisma:seed
```

This will create:
- Default admin user (email: `admin@yorkcastle.edu.jm`, password: `admin123`)
- Sample data for testing

**⚠️ Security Warning**: Change the default admin password immediately after seeding!

## Step 8: Verify the Connection

Test that your application can connect to Supabase:

```bash
cd backend
npx prisma db pull
```

If this succeeds without errors, your connection is working!

## Step 9: Test Your Application

1. Start your backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. Check the logs for "Database connection successful"

3. Test the API endpoints or login to the admin dashboard

## Migrating Existing Data (If Applicable)

If you have an existing database with data that needs to be migrated:

### Option 1: Using the Migration Script (Easiest)

We've provided a migration script to automate the process:

1. **Add both connection strings to `.env`**:
   ```env
   # Your current/old database
   OLD_DATABASE_URL=postgresql://user:password@localhost:5432/yorkcastle
   
   # Your new Supabase database
   DATABASE_URL=postgresql://postgres:password@db.projectref.supabase.co:5432/postgres
   ```

2. **Run the migration script**:
   ```bash
   cd backend
   npm run migrate:supabase
   ```

   Or directly:
   ```bash
   node scripts/migrate-to-supabase.js
   ```

The script will:
- Create a backup of your old database
- Restore it to Supabase
- Verify the migration was successful

**Note**: Requires PostgreSQL client tools (`pg_dump` and `pg_restore`) to be installed.

### Option 2: Using pg_dump and pg_restore (Manual)

1. **Export from your current database**:
   ```bash
   # From your local PostgreSQL
   pg_dump -h localhost -U your_username -d yorkcastle -F c -f backup.dump
   ```

2. **Import to Supabase**:
   ```bash
   # Get your Supabase connection details from the dashboard
   pg_restore -h db.[PROJECT-REF].supabase.co \
              -U postgres \
              -d postgres \
              --no-owner \
              --no-acl \
              backup.dump
   ```

   You'll be prompted for the database password.

### Option 2: Using Prisma Migrate (For Schema Only)

If you only need to migrate the schema (not data):

1. The migrations you ran in Step 6 already created the schema
2. You can manually export/import data using SQL or Prisma Studio

### Option 3: Using Prisma Studio (For Small Datasets)

1. **Export from old database**:
   ```bash
   # Set DATABASE_URL to old database
   npx prisma studio
   ```
   Manually copy data from Prisma Studio

2. **Import to Supabase**:
   ```bash
   # Set DATABASE_URL to Supabase
   npx prisma studio
   ```
   Manually paste data into Prisma Studio

## Supabase-Specific Considerations

### Connection Pooling

For production, use Supabase's connection pooler to handle many concurrent connections:

```env
# Use this for your application (not for migrations)
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Important**: 
- Use the regular connection string for migrations (`migrate deploy`)
- Use the pooled connection string for your application runtime
- The pooler uses port `6543` instead of `5432`

### Row Level Security (RLS)

Supabase has Row Level Security enabled by default. Since you're using Prisma, you may want to:

1. **Disable RLS** (if you're handling security in your application):
   ```sql
   -- Run this in Supabase SQL Editor
   ALTER TABLE "User" DISABLE ROW LEVEL SECURITY;
   ALTER TABLE "Application" DISABLE ROW LEVEL SECURITY;
   -- ... repeat for all tables
   ```

2. **Or configure RLS policies** if you want to use Supabase's built-in security features

### Database Extensions

Supabase comes with many PostgreSQL extensions pre-installed. If you need specific ones:

1. Go to **Database** → **Extensions** in Supabase dashboard
2. Enable the extensions you need (e.g., `pg_trgm` for text search, `uuid-ossp` for UUID generation)

### Backups

Supabase automatically backs up your database:
- **Free tier**: Daily backups (7-day retention)
- **Pro tier**: Point-in-time recovery with longer retention

You can also create manual backups from the dashboard.

## Troubleshooting

### Connection Timeout

If you're getting connection timeouts:
- Check your firewall settings
- Verify the connection string is correct
- Try using the connection pooler instead
- Check Supabase project status in the dashboard

### Authentication Failed

- Verify your database password is correct
- URL-encode special characters in the password
- Check that your IP is not blocked (Supabase allows all IPs by default)

### Migration Errors

If migrations fail:
- Check that you're using the regular connection string (not pooled) for migrations
- Verify all environment variables are set correctly
- Check Supabase logs in the dashboard
- Ensure you have the latest Prisma migrations

### SSL Connection Issues

Supabase requires SSL connections. Prisma handles this automatically, but if you encounter SSL errors:

1. Add `?sslmode=require` to your connection string:
   ```
   DATABASE_URL=postgresql://...?sslmode=require
   ```

2. Or use the Supabase connection string format which includes SSL by default

## Production Checklist

Before going to production with Supabase:

- [ ] Use connection pooling for your application
- [ ] Set up proper environment variables (don't commit `.env` to git)
- [ ] Configure CORS origins in Supabase dashboard
- [ ] Set up database backups (automatic on Pro tier)
- [ ] Review and configure RLS policies if needed
- [ ] Monitor database usage and performance
- [ ] Set up alerts for database issues
- [ ] Test failover and backup restoration
- [ ] Update all default passwords
- [ ] Review security settings in Supabase dashboard

## Next Steps

After successful migration:

1. **Update your deployment configuration** to use the Supabase connection string
2. **Test all functionality** thoroughly
3. **Monitor performance** using Supabase dashboard metrics
4. **Set up monitoring** and alerts
5. **Document** the new database connection for your team

## Additional Resources

- **[Supabase CLI Guide](./SUPABASE_CLI_GUIDE.md)** - Complete guide for using Supabase CLI
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)
- [Prisma with Supabase](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-supabase)
- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/security)

## Support

If you encounter issues:
1. Check Supabase project logs in the dashboard
2. Review Prisma migration logs
3. Check application logs for connection errors
4. Consult Supabase community forums

