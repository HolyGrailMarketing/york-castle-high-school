# Fix Supabase Connection - Step by Step

## Quick Fix Commands

Run these commands in order from the `backend` directory:

### Step 1: Login to Supabase CLI

```bash
cd backend
npx supabase login
```

This will open your browser. Complete the authentication.

### Step 2: Link Your Project

```bash
npx supabase link --project-ref lmixjefkbejoibldpioh
```

You'll be prompted for your **database password**. Get it from:
- https://supabase.com/dashboard/project/lmixjefkbejoibldpioh/settings/database

### Step 3: Get Connection String

After linking, get your connection string:

1. Go to: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh/settings/database
2. Scroll to **"Connection string"** section
3. Select **"URI"** tab
4. Copy the connection string
5. It looks like: `postgresql://postgres:[PASSWORD]@db.lmixjefkbejoibldpioh.supabase.co:5432/postgres`

### Step 4: Update .env File

Open `backend/.env` and update the `DATABASE_URL`:

```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.lmixjefkbejoibldpioh.supabase.co:5432/postgres
```

**Important**: Replace `[YOUR-PASSWORD]` with your actual password. URL-encode special characters if needed:
- `@` → `%40`
- `#` → `%23`
- `%` → `%25`
- `&` → `%26`

### Step 5: Deploy Database

```bash
# Generate Prisma client
npm run db:generate

# Deploy migrations
npm run db:migrate

# Seed database (optional - creates admin user)
npm run db:seed
```

### Step 6: Verify Connection

```bash
npm run dev
```

Check that the server starts without database errors.

## All-in-One Script

Or run the automated script:

```bash
cd backend
./scripts/fix-supabase-connection.sh
```

## Troubleshooting

### "Access token not provided"
- Run: `npx supabase login`
- Complete browser authentication

### "Project not found"
- Verify project ref: `lmixjefkbejoibldpioh`
- Check you're logged in: `npx supabase projects list`

### "Connection refused"
- Verify password is correct
- Check connection string format
- Ensure IP is allowed (Supabase Dashboard → Settings → Database)

### "Migration failed"
- Check DATABASE_URL is correct in .env
- Try: `npx prisma migrate deploy --skip-generate`
- Check Supabase logs in dashboard

## Your Supabase Project

- **Project Ref**: `lmixjefkbejoibldpioh`
- **Dashboard**: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh
- **Database Settings**: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh/settings/database
- **API URL**: https://lmixjefkbejoibldpioh.supabase.co




