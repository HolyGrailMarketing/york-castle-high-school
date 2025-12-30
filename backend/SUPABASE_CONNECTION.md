# Supabase Connection Setup

## Your Project Details

- **Project Reference**: `lmixjefkbejoibldpioh`
- **Project URL**: https://lmixjefkbejoibldpioh.supabase.co
- **Dashboard**: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh

## Get Connection String

### Step 1: Open Database Settings

Go to: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh/settings/database

### Step 2: Get Connection String

1. Scroll to **"Connection string"** section
2. Click on **"URI"** tab (for direct connection)
3. Copy the connection string

### Step 3: Update .env File

Edit `backend/.env` and add/update:

```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.lmixjefkbejoibldpioh.supabase.co:5432/postgres
```

**Important:**
- Replace `[YOUR-PASSWORD]` with your actual database password
- If password has special characters, URL-encode them:
  - `@` → `%40`
  - `#` → `%23`
  - `%` → `%25`
  - `&` → `%26`

## Connection Types

### Direct Connection (Port 5432) - For Migrations
```
postgresql://postgres:[PASSWORD]@db.lmixjefkbejoibldpioh.supabase.co:5432/postgres
```
✅ Use this for: `prisma migrate deploy`, `prisma db pull`, etc.

### Pooled Connection (Port 6543) - For App Runtime
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```
✅ Use this for: Application runtime (better for many connections)

## Test Connection

After updating `.env`:

```bash
cd backend
npm run db:test
```

## Common Issues

### 1. Project is Paused
- Go to dashboard: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh
- Click "Restore" if project is paused
- Wait 1-2 minutes

### 2. Wrong Password
- Reset password: Dashboard → Settings → Database → "Reset database password"
- Update `.env` with new password

### 3. IP Restrictions
- Dashboard → Settings → Database → "Connection Pooling"
- Check "Allowed IPs" - add your IP or set to `0.0.0.0/0`

### 4. Connection String Format
- Make sure it starts with `postgresql://`
- Check hostname: `db.lmixjefkbejoibldpioh.supabase.co`
- Check port: `5432` (direct) or `6543` (pooled)

## Quick Links

- **Dashboard**: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh
- **Database Settings**: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh/settings/database
- **Table Editor**: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh/editor
- **API Settings**: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh/settings/api

## Next Steps

1. ✅ Get connection string from Supabase Dashboard
2. ✅ Update `backend/.env` with `DATABASE_URL`
3. ✅ Test connection: `npm run db:test`
4. ✅ Deploy tables: `npm run db:migrate`
5. ✅ Seed database: `npm run db:seed`



