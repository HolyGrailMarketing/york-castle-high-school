# Database Setup Guide

## The Issue

You're getting a 500 error because the database connection is failing. The `.env` file is pointing to a Supabase database that's not accessible.

## Quick Fix Options

### Option 1: Use Local PostgreSQL (Recommended for Development)

1. **Install PostgreSQL** (if not installed):
   ```bash
   # macOS
   brew install postgresql
   brew services start postgresql
   
   # Ubuntu/Debian
   sudo apt-get install postgresql
   sudo systemctl start postgresql
   ```

2. **Create Database**:
   ```bash
   psql -U postgres
   CREATE DATABASE yorkcastle;
   \q
   ```

3. **Update `.env` file** in `backend/.env`:
   ```env
   DATABASE_URL=postgresql://your_username:your_password@localhost:5432/yorkcastle
   ```
   
   Or if no password:
   ```env
   DATABASE_URL=postgresql://localhost:5432/yorkcastle
   ```

4. **Run Migrations**:
   ```bash
   cd backend
   npm run prisma:migrate
   npm run prisma:seed
   ```

5. **Restart Backend**:
   ```bash
   # Stop current server (Ctrl+C or pkill)
   npm run dev
   ```

### Option 2: Use Supabase (Cloud Database) - Recommended for Production

**📖 For detailed Supabase migration instructions, see [SUPABASE_MIGRATION.md](../SUPABASE_MIGRATION.md)**

Quick setup:

1. **Create a Supabase project** at https://supabase.com
   - Sign up/login to Supabase
   - Click "New Project"
   - Choose a name, strong password, and region
   - Wait for provisioning (2-3 minutes)

2. **Get your Supabase connection string**:
   - Go to **Settings** → **Database** in your Supabase dashboard
   - Scroll to **"Connection string"** section
   - Select **"URI"** tab
   - Copy the connection string
   - Replace `[YOUR-PASSWORD]` with your actual database password

3. **Update `.env` file** in `backend/.env`:
   ```env
   # Direct connection (for migrations)
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   
   # Or use connection pooler (for production application)
   # DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
   ```
   
   **Important**: 
   - Replace `[YOUR-PASSWORD]` with your database password
   - Replace `[PROJECT-REF]` with your project reference ID
   - URL-encode special characters in password if needed

4. **Install dependencies and generate Prisma client**:
   ```bash
   cd backend
   npm install
   npx prisma generate
   ```

5. **Run Migrations**:
   ```bash
   # Use migrate deploy for Supabase (applies existing migrations)
   npx prisma migrate deploy
   
   # Or if you need to create a new migration:
   npx prisma migrate dev --name init
   ```

6. **Seed the database** (optional):
   ```bash
   npm run prisma:seed
   ```
   This creates a default admin user (email: `admin@yorkcastle.edu.jm`, password: `admin123`)

7. **Verify connection**:
   ```bash
   npx prisma db pull
   ```

8. **Restart Backend**:
   ```bash
   npm run dev
   ```

**Supabase Tips**:
- Use direct connection (`:5432`) for migrations
- Use connection pooler (`:6543`) for production application
- Supabase automatically handles SSL connections
- Free tier includes daily backups
- Check Supabase dashboard for connection issues

### Option 3: Use SQLite (Quick Testing - Not Recommended for Production)

1. **Update `backend/prisma/schema.prisma`**:
   ```prisma
   datasource db {
     provider = "sqlite"
     url      = "file:./dev.db"
   }
   ```

2. **Update `.env`**:
   ```env
   DATABASE_URL="file:./dev.db"
   ```

3. **Run Migrations**:
   ```bash
   cd backend
   npm run prisma:generate
   npm run prisma:migrate
   npm run prisma:seed
   ```

## Verify Database Connection

After setting up, test the connection:

```bash
cd backend
npx prisma db pull
```

If this succeeds, your database is connected!

## After Database Setup

1. **Restart the backend server**
2. **Try logging in again** at http://localhost:5173
3. **Default credentials**:
   - Email: `admin@yorkcastle.edu.jm`
   - Password: `admin123`

## Troubleshooting

### Local PostgreSQL Issues

**"Can't reach database server"**
- Check PostgreSQL is running: `pg_isready`
- Verify DATABASE_URL in `.env` is correct
- Check firewall/network settings

**"Database does not exist"**
- Create the database: `CREATE DATABASE yorkcastle;`

**"Authentication failed"**
- Check username/password in DATABASE_URL
- Verify PostgreSQL user permissions

### Supabase Issues

**"Connection timeout"**
- Verify your connection string is correct
- Check Supabase project status in dashboard
- Try using connection pooler instead of direct connection
- Check if your IP is blocked (unlikely, Supabase allows all IPs by default)

**"Authentication failed"**
- Verify database password is correct
- URL-encode special characters in password (e.g., `@` → `%40`)
- Check that you're using the correct connection string format

**"Migration errors"**
- Ensure you're using direct connection (`:5432`) for migrations, not pooled (`:6543`)
- Check Supabase logs in the dashboard
- Verify all environment variables are set correctly
- Try running `npx prisma generate` before migrations

**"SSL connection required"**
- Supabase requires SSL, but Prisma handles this automatically
- If issues persist, add `?sslmode=require` to connection string
- Or use the Supabase-provided connection string format

**For more Supabase troubleshooting, see [SUPABASE_MIGRATION.md](../SUPABASE_MIGRATION.md)**

