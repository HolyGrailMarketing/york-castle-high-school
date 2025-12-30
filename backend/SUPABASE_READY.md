# ✅ Supabase CLI Ready!

Supabase CLI is installed and configured in this project.

## Installation Status

- ✅ Supabase CLI version: **2.70.5**
- ✅ Installed as dev dependency
- ✅ npm scripts configured

## Quick Commands

All commands should be run from the `backend` directory:

```bash
cd backend
```

### Authentication

```bash
# Login to Supabase (opens browser)
npm run supabase:link

# Or use npx directly
npx supabase login
```

### Local Development

```bash
# Start local Supabase (Docker required)
npm run supabase:start

# Check status
npm run supabase:status

# Open Supabase Studio (local)
npm run supabase:studio

# Stop local Supabase
npm run supabase:stop
```

### Link to Remote Project

```bash
# Link to your Supabase project
npx supabase link --project-ref YOUR-PROJECT-REF

# Find your project ref in:
# Supabase Dashboard → Settings → General → Reference ID
```

### Database Operations

```bash
# Pull schema from remote Supabase
npm run supabase:db:pull

# Push migrations to remote Supabase
npm run supabase:db:push

# Reset local database
npm run supabase:db:reset
```

### Prisma Integration

```bash
# Generate Prisma client
npm run db:generate

# Deploy migrations to Supabase
npm run db:migrate

# Seed database
npm run db:seed
```

## Next Steps

1. **Login to Supabase:**
   ```bash
   cd backend
   npx supabase login
   ```

2. **Link your project:**
   ```bash
   npx supabase link --project-ref YOUR-PROJECT-REF
   ```

3. **Deploy your schema:**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

## Documentation

- **SUPABASE_CLI_GUIDE.md** - Complete CLI guide
- **SUPABASE_MIGRATION.md** - Migration instructions
- **SUPABASE_QUICK_START.md** - Quick reference

## Troubleshooting

If `npx` commands fail, you can use the direct path:
```bash
./node_modules/.bin/supabase --version
```

For permission issues with npm, run commands directly:
```bash
./node_modules/.bin/supabase login
./node_modules/.bin/supabase link --project-ref YOUR-PROJECT-REF
```




