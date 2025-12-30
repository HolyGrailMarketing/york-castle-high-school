# Supabase Setup Steps for Your Project

Your Supabase Project: **lmixjefkbejoibldpioh**

## Step 1: Login to Supabase CLI

```bash
cd backend
npx supabase login
```

This will open your browser to authenticate.

## Step 2: Link Your Project

```bash
npx supabase link --project-ref lmixjefkbejoibldpioh
```

You'll be prompted for your database password. Get it from:
- Supabase Dashboard → Settings → Database → Database password

## Step 3: Get Your Connection String

1. Go to: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh/settings/database
2. Scroll to **"Connection string"** section
3. Select **"URI"** tab
4. Copy the connection string
5. It will look like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.lmixjefkbejoibldpioh.supabase.co:5432/postgres
   ```

## Step 4: Update Your .env File

Open `backend/.env` and update the `DATABASE_URL`:

```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.lmixjefkbejoibldpioh.supabase.co:5432/postgres
```

**Important**: 
- Replace `[YOUR-PASSWORD]` with your actual database password
- URL-encode special characters in password if needed (e.g., `@` becomes `%40`, `#` becomes `%23`)

### Example:
```env
DATABASE_URL=postgresql://postgres:MySecurePass123!@db.lmixjefkbejoibldpioh.supabase.co:5432/postgres
```

## Step 5: Generate Prisma Client

```bash
cd backend
npm run db:generate
```

## Step 6: Deploy Database Migrations

```bash
npm run db:migrate
```

This will create all tables in your Supabase database.

## Step 7: Seed the Database (Optional)

```bash
npm run db:seed
```

This creates:
- Default admin user (email: `admin@yorkcastle.edu.jm`, password: `admin123`)

**⚠️ Security Warning**: Change the default admin password immediately!

## Step 8: Verify Connection

```bash
npm run dev
```

Check that the server starts without database errors.

## Quick Commands Reference

```bash
# Check Supabase status
npm run supabase:status

# Open Supabase Studio (web interface)
npm run supabase:studio

# Pull latest schema changes
npm run supabase:db:pull

# Push migrations
npm run supabase:db:push
```

## Troubleshooting

### If linking fails:
- Make sure you're logged in: `npx supabase login`
- Verify your project ref is correct: `lmixjefkbejoibldpioh`
- Check your database password in Supabase Dashboard

### If connection fails:
- Verify your password is correct
- Check if special characters need URL encoding
- Ensure your IP is allowed (Supabase Dashboard → Settings → Database → Connection Pooling)

### If migrations fail:
- Make sure DATABASE_URL is set correctly in .env
- Try: `npx prisma migrate deploy --skip-generate`
- Check Supabase logs in the dashboard

## Your Supabase Dashboard

- **Project URL**: https://lmixjefkbejoibldpioh.supabase.co
- **Dashboard**: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh
- **Studio**: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh/editor




