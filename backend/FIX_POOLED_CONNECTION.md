# Fix: "prepared statement already exists" Error

## Problem

You're getting this error:
```
ERROR: prepared statement "s0" already exists
```

This happens because you're using a **pooled connection** (port 6543) for Prisma migrations, but migrations require a **direct connection** (port 5432).

## Solution

### Use Direct Connection for Migrations

Prisma migrations **must** use the direct connection, not the pooled connection.

### Step 1: Get Direct Connection String

1. Go to: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh/settings/database
2. Scroll to **"Connection string"** section
3. Click **"URI"** tab (NOT "Connection pooling")
4. Copy the connection string

It should look like:
```
postgresql://postgres:[YOUR-PASSWORD]@db.lmixjefkbejoibldpioh.supabase.co:5432/postgres
```

**Note:** Port is `5432` (direct), not `6543` (pooled)

### Step 2: Update .env File

Edit `backend/.env` and update `DATABASE_URL`:

```env
# For migrations - use direct connection (port 5432)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.lmixjefkbejoibldpioh.supabase.co:5432/postgres
```

### Step 3: Run Migrations Again

```bash
cd backend
npm run db:migrate
```

## Connection Types Explained

### Direct Connection (Port 5432) ✅ For Migrations
```
postgresql://postgres:[PASSWORD]@db.lmixjefkbejoibldpioh.supabase.co:5432/postgres
```
- **Use for:** `prisma migrate deploy`, `prisma db pull`, `prisma studio`
- **Why:** Supports prepared statements needed by Prisma migrations

### Pooled Connection (Port 6543) ✅ For App Runtime
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```
- **Use for:** Application runtime (Express server)
- **Why:** Better for handling many concurrent connections
- **Note:** Does NOT support prepared statements (can't use for migrations)

## Recommended Setup

### Option 1: Use Direct Connection for Everything (Simplest)

```env
# Use direct connection for both migrations and app
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.lmixjefkbejoibldpioh.supabase.co:5432/postgres
```

✅ Works for migrations and app runtime
✅ Simplest setup

### Option 2: Use Different Connections (Advanced)

```env
# Direct connection for migrations
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.lmixjefkbejoibldpioh.supabase.co:5432/postgres

# Pooled connection for app (optional - set in code)
DATABASE_URL_POOLED=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```

Then in your code, use `DATABASE_URL` for Prisma and `DATABASE_URL_POOLED` for app connections.

## Quick Fix Commands

```bash
cd backend

# 1. Update .env with direct connection (port 5432)
# Edit .env file manually

# 2. Test connection
npm run db:test

# 3. Run migrations
npm run db:migrate

# 4. Seed database
npm run db:seed
```

## Verify Connection Type

After updating `.env`, check which connection you're using:

```bash
npm run db:test
```

The output will show:
- ✅ Direct connection: `db.lmixjefkbejoibldpioh.supabase.co:5432`
- ⚠️ Pooled connection: `aws-0-[REGION].pooler.supabase.com:6543`

## Your Project Links

- **Database Settings**: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh/settings/database
- **Dashboard**: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh

