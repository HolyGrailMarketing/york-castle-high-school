# Create Tables in Supabase

This guide will help you deploy your Prisma schema to Supabase and create all database tables.

## Quick Start

If you're already linked to Supabase and have `DATABASE_URL` configured:

```bash
cd backend

# Generate Prisma client
npm run db:generate

# Deploy migrations (creates all tables)
npm run db:migrate

# Seed database (optional - creates admin user)
npm run db:seed
```

## Full Setup (First Time)

If you haven't linked to Supabase yet:

### Option 1: Automated Script (Recommended)

```bash
cd backend
npm run deploy:supabase
```

This script will:
1. Check if you're logged in to Supabase CLI
2. Link your project (if not already linked)
3. Verify DATABASE_URL is configured
4. Generate Prisma client
5. Deploy all migrations (create tables)
6. Optionally seed the database

### Option 2: Manual Steps

#### Step 1: Login to Supabase CLI

```bash
cd backend
npx supabase login
```

This opens your browser for authentication.

#### Step 2: Link Your Project

```bash
npx supabase link --project-ref lmixjefkbejoibldpioh
```

You'll be prompted for your database password. Get it from:
- https://supabase.com/dashboard/project/lmixjefkbejoibldpioh/settings/database

#### Step 3: Update DATABASE_URL

Edit `backend/.env` and add/update:

```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.lmixjefkbejoibldpioh.supabase.co:5432/postgres
```

Get the connection string from:
- https://supabase.com/dashboard/project/lmixjefkbejoibldpioh/settings/database
- Select the "URI" tab
- Copy the connection string

#### Step 4: Deploy Tables

```bash
# Generate Prisma client
npm run db:generate

# Deploy migrations (creates all tables)
npm run db:migrate

# Seed database (optional)
npm run db:seed
```

## Tables That Will Be Created

Your Prisma schema includes these tables:

1. **User** - User accounts (admin, staff, student, parent)
2. **Application** - Regular school applications
3. **SixthFormApplication** - Sixth form applications
4. **Course** - Course/subject catalog
5. **Enrollment** - Student course enrollments
6. **BlogPost** - Blog posts
7. **Event** - School events
8. **Document** - Document library
9. **Request** - Document/device/lab requests
10. **Teacher** - Teacher profiles
11. **Analytics** - Analytics tracking

Plus all indexes and foreign key relationships.

## Verify Tables

After deployment, verify tables in Supabase Dashboard:

1. Go to: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh/editor
2. You should see all tables listed in the left sidebar
3. Click on any table to view its structure

## Troubleshooting

### "Access token not provided"
- Run: `npx supabase login`
- Complete browser authentication

### "Project not found"
- Verify project ref: `lmixjefkbejoibldpioh`
- Check you're logged in: `npx supabase projects list`

### "Connection refused" or "Migration failed"
- Verify DATABASE_URL is correct in `.env`
- Check database password is correct
- Ensure Supabase project is active
- Try: `npx prisma migrate deploy --skip-generate`

### "Table already exists"
- If tables already exist, Prisma will skip creating them
- To reset: Drop tables in Supabase Dashboard, then re-run migrations

### "Foreign key constraint failed"
- Make sure all migrations run in order
- Check that referenced tables exist

## Next Steps

After tables are created:

1. **Start your backend server:**
   ```bash
   npm run dev
   ```

2. **Test API endpoints:**
   - Register a user: `POST /api/auth/register`
   - Login: `POST /api/auth/login`
   - Check health: `GET /api/health`

3. **Access Prisma Studio** (optional):
   ```bash
   npm run prisma:studio
   ```

## Your Supabase Project

- **Project Ref**: `lmixjefkbejoibldpioh`
- **Dashboard**: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh
- **Table Editor**: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh/editor
- **Database Settings**: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh/settings/database



