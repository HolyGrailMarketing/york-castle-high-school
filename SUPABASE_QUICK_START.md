# Supabase Quick Start Guide

Quick reference for migrating to Supabase. For detailed instructions, see [SUPABASE_MIGRATION.md](./SUPABASE_MIGRATION.md).

## 🚀 Quick Migration Steps

### Using Supabase CLI (Recommended)

```bash
# 1. Install CLI
brew install supabase/tap/supabase

# 2. Login
supabase login

# 3. Link project
cd backend
supabase link --project-ref your-project-ref

# 4. Deploy
npx prisma migrate deploy
npm run prisma:seed
```

**📖 Full CLI guide: [SUPABASE_CLI_GUIDE.md](./SUPABASE_CLI_GUIDE.md)**

### Manual Setup (Without CLI)

### 1. Create Supabase Project
- Go to https://supabase.com
- Create new project
- Save your database password

### 2. Get Connection String
- Supabase Dashboard → Settings → Database
- Copy "Connection string" (URI tab)
- Format: `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

### 3. Update Environment
Edit `backend/.env`:
```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

### 4. Run Migrations
```bash
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
```

### 5. Verify
```bash
npx prisma db pull
npm run dev
```

## 📦 Migrating Existing Data

If you have data in an existing database:

1. Add to `backend/.env`:
   ```env
   OLD_DATABASE_URL=postgresql://user:password@localhost:5432/yorkcastle
   DATABASE_URL=postgresql://postgres:password@db.projectref.supabase.co:5432/postgres
   ```

2. Run migration script:
   ```bash
   npm run migrate:supabase
   ```

## 🔗 Connection Types

**For Migrations** (use direct connection):
```
postgresql://postgres:password@db.projectref.supabase.co:5432/postgres
```

**For Production** (use connection pooler):
```
postgresql://postgres.projectref:password@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true
```

## ⚠️ Important Notes

- Use direct connection (`:5432`) for migrations
- Use pooled connection (`:6543`) for application runtime
- URL-encode special characters in passwords
- Supabase requires SSL (handled automatically by Prisma)

## 🆘 Troubleshooting

**Connection timeout?**
- Verify connection string
- Check Supabase project status
- Try connection pooler

**Migration errors?**
- Use direct connection (not pooled) for migrations
- Run `npx prisma generate` first
- Check Supabase logs in dashboard

For more help, see [SUPABASE_MIGRATION.md](./SUPABASE_MIGRATION.md)

