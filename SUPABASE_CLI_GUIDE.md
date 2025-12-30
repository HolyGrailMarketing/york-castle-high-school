# Supabase CLI Guide

This guide shows you how to use the Supabase CLI to manage your database migrations and development workflow.

## Why Use Supabase CLI?

The Supabase CLI provides:
- **Local Development**: Run Supabase locally for testing
- **Migration Management**: Version-controlled database migrations
- **Schema Sync**: Push Prisma schema changes to Supabase
- **Database Management**: Easy database operations and backups
- **Type Safety**: Generate TypeScript types from your database

## Installation

### macOS
```bash
brew install supabase/tap/supabase
```

### Linux
```bash
# Download the latest release
wget -qO- https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar -xz
sudo mv supabase /usr/local/bin/
```

### Windows
```bash
# Using Scoop
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Or download from: https://github.com/supabase/cli/releases
```

### Verify Installation
```bash
supabase --version
```

## Setup Options

### Option 1: Link to Existing Supabase Project (Recommended)

If you already have a Supabase project:

1. **Login to Supabase**:
   ```bash
   supabase login
   ```
   This will open your browser to authenticate.

2. **Link your project**:
   ```bash
   cd backend
   supabase link --project-ref your-project-ref
   ```
   
   You can find your project ref in:
   - Supabase Dashboard → Settings → General → Reference ID
   - Or in your connection string: `db.[PROJECT-REF].supabase.co`

3. **Pull remote schema** (optional, to sync with remote):
   ```bash
   supabase db pull
   ```

### Option 2: Initialize New Supabase Project Locally

For local development:

1. **Initialize Supabase**:
   ```bash
   cd backend
   supabase init
   ```
   
   This creates a `supabase/` directory with:
   - `config.toml` - Supabase configuration
   - `migrations/` - Database migrations
   - `seed.sql` - Seed data

2. **Start local Supabase**:
   ```bash
   supabase start
   ```
   
   This starts:
   - PostgreSQL database (port 54322)
   - PostgREST API (port 54321)
   - GoTrue Auth (port 54324)
   - Storage (port 54325)
   - Realtime (port 54326)
   - Studio (port 54323)

3. **Get local connection string**:
   ```bash
   supabase status
   ```
   
   Copy the `DB URL` and update your `.env`:
   ```env
   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
   ```

## Working with Prisma + Supabase CLI

### Recommended Workflow

Since you're using Prisma, here's the best approach:

1. **Use Prisma for schema management** (as you're doing now)
2. **Use Supabase CLI for deployment and management**

### Setup for Prisma + Supabase

1. **Link to your Supabase project**:
   ```bash
   cd backend
   supabase link --project-ref your-project-ref
   ```

2. **Update `.env` with Supabase connection**:
   ```env
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

3. **Generate Prisma client**:
   ```bash
   npx prisma generate
   ```

4. **Apply migrations to Supabase**:
   ```bash
   # Option A: Use Prisma migrate (recommended)
   npx prisma migrate deploy
   
   # Option B: Use Supabase CLI to push schema
   supabase db push
   ```

## Common Supabase CLI Commands

### Database Operations

```bash
# Pull remote schema to local
supabase db pull

# Push local migrations to remote
supabase db push

# Reset database (⚠️ deletes all data)
supabase db reset

# Create a new migration
supabase migration new migration_name

# Apply migrations
supabase migration up

# Check migration status
supabase migration list
```

### Project Management

```bash
# Link to remote project
supabase link --project-ref your-project-ref

# Unlink from project
supabase unlink

# Get project status
supabase status

# List all projects
supabase projects list
```

### Local Development

```bash
# Start local Supabase
supabase start

# Stop local Supabase
supabase stop

# Restart local Supabase
supabase restart

# View logs
supabase logs
```

### Database Management

```bash
# Open Supabase Studio (web UI)
supabase studio

# Execute SQL query
supabase db execute "SELECT * FROM users;"

# Dump database
supabase db dump -f backup.sql

# Restore database
supabase db restore backup.sql
```

## Migration Workflow with Prisma

### Recommended Approach

Since you're using Prisma, here's the best workflow:

1. **Make schema changes in `prisma/schema.prisma`**

2. **Create Prisma migration**:
   ```bash
   npx prisma migrate dev --name your_migration_name
   ```

3. **Generate Prisma client**:
   ```bash
   npx prisma generate
   ```

4. **Deploy to Supabase**:
   ```bash
   # Set DATABASE_URL to Supabase
   npx prisma migrate deploy
   ```

### Alternative: Using Supabase Migrations

If you want to use Supabase migrations instead:

1. **Create migration from Prisma schema**:
   ```bash
   # Generate SQL from Prisma
   npx prisma migrate diff \
     --from-schema-datamodel prisma/schema.prisma \
     --to-schema-datasource prisma/schema.prisma \
     --script > supabase/migrations/$(date +%Y%m%d%H%M%S)_migration.sql
   ```

2. **Apply Supabase migration**:
   ```bash
   supabase db push
   ```

## Integration with Your Project

### Update package.json Scripts

Add these scripts to `backend/package.json`:

```json
{
  "scripts": {
    "supabase:start": "supabase start",
    "supabase:stop": "supabase stop",
    "supabase:status": "supabase status",
    "supabase:studio": "supabase studio",
    "supabase:link": "supabase link --project-ref",
    "supabase:db:pull": "supabase db pull",
    "supabase:db:push": "supabase db push",
    "supabase:db:reset": "supabase db reset",
    "db:migrate": "npx prisma migrate deploy",
    "db:generate": "npx prisma generate",
    "db:seed": "node prisma/seed.js"
  }
}
```

### Environment Setup

Create a `.supabase/config.toml` (or update if exists) to configure Supabase:

```toml
[project]
# Your project reference ID (from Supabase dashboard)
project_id = "your-project-ref"

[auth]
# Auth configuration
enabled = true

[db]
# Database configuration
port = 54322
```

## Deployment Workflow

### Development

1. **Local development with Supabase**:
   ```bash
   supabase start
   # Use local connection string in .env
   npm run dev
   ```

2. **Make schema changes in Prisma**

3. **Test locally**:
   ```bash
   npx prisma migrate dev
   npm run db:seed
   ```

### Production Deployment

1. **Link to production Supabase project**:
   ```bash
   supabase link --project-ref production-project-ref
   ```

2. **Deploy migrations**:
   ```bash
   # Update .env with production DATABASE_URL
   npx prisma migrate deploy
   ```

3. **Verify deployment**:
   ```bash
   supabase status
   ```

## Type Generation

Supabase CLI can generate TypeScript types from your database:

```bash
# Generate types
supabase gen types typescript --linked > types/supabase.ts
```

Then use in your code:
```typescript
import { Database } from './types/supabase'

const db: Database = // your database instance
```

## Troubleshooting

### "Project not found"
- Verify your project ref is correct
- Check you're logged in: `supabase login`
- List projects: `supabase projects list`

### "Connection refused"
- Check Supabase project is active in dashboard
- Verify connection string is correct
- Check firewall/network settings

### Migration conflicts
- Pull latest schema: `supabase db pull`
- Resolve conflicts manually
- Test locally first: `supabase start`

### Local Supabase won't start
- Check Docker is running (Supabase uses Docker)
- Free up ports: `supabase stop`
- Check logs: `supabase logs`

## Best Practices

1. **Always test migrations locally first**
2. **Use Prisma for schema management** (you're already doing this)
3. **Use Supabase CLI for deployment and management**
4. **Keep migrations in version control**
5. **Use connection pooling for production**
6. **Backup before major migrations**
7. **Test in staging before production**

## Next Steps

1. **Install Supabase CLI**: `brew install supabase/tap/supabase`
2. **Link your project**: `supabase link --project-ref your-ref`
3. **Test locally**: `supabase start`
4. **Deploy**: `npx prisma migrate deploy`

For more information, see:
- [Supabase CLI Docs](https://supabase.com/docs/reference/cli)
- [Prisma + Supabase Guide](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-supabase)





