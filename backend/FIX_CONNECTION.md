# Fix Database Connection Issue

## Error: "Can't reach database server"

This usually means one of these issues:

## 🔴 Most Common: Project is Paused

**Free tier Supabase projects pause after 1 week of inactivity.**

### Fix:
1. Go to: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh
2. If you see "Project Paused" or "Restore" button, click it
3. Wait 1-2 minutes for project to restore
4. Try connection test again: `npm run db:test`

## 🔴 Check Connection String

### Verify your DATABASE_URL in `.env`:

```env
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.lmixjefkbejoibldpioh.supabase.co:5432/postgres
```

### Get correct connection string:
1. Go to: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh/settings/database
2. Click **"URI"** tab (not "Connection string")
3. Copy the connection string
4. Replace `[YOUR-PASSWORD]` with your actual database password
5. Update `backend/.env` file

### Password URL Encoding:
If your password has special characters, encode them:
- `@` → `%40`
- `#` → `%23`
- `%` → `%25`
- `&` → `%26`
- `+` → `%2B`
- `=` → `%3D`

## 🔴 Check IP Restrictions

Supabase might be blocking your IP address.

### Fix:
1. Go to: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh/settings/database
2. Scroll to **"Connection Pooling"** section
3. Check **"Allowed IPs"**
4. Add your IP or set to `0.0.0.0/0` (allows all IPs - less secure)

## 🔴 Try Connection Pooler

If direct connection (port 5432) fails, try the pooler:

### Update DATABASE_URL:
```env
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
```

**Note:** For migrations, use direct connection (5432). For app runtime, pooler (6543) is fine.

## Quick Test Commands

```bash
cd backend

# Test connection
npm run db:test

# Or use Prisma directly
npx prisma db pull --force

# Or test with psql (if installed)
psql "postgresql://postgres:[PASSWORD]@db.lmixjefkbejoibldpioh.supabase.co:5432/postgres" -c "SELECT version();"
```

## Verify Project Status

```bash
# Login to Supabase CLI
npx supabase login

# List projects (shows status)
npx supabase projects list

# Check specific project
npx supabase projects api-keys --project-ref lmixjefkbejoibldpioh
```

## Still Not Working?

1. **Check Supabase Dashboard:**
   - Is project active? (not paused)
   - Is database running? (green status)

2. **Test Network:**
   ```bash
   ping db.lmixjefkbejoibldpioh.supabase.co
   telnet db.lmixjefkbejoibldpioh.supabase.co 5432
   ```

3. **Reset Database Password:**
   - Dashboard → Settings → Database
   - Click "Reset database password"
   - Update `.env` with new password

4. **Check Firewall:**
   - Ensure port 5432 is not blocked
   - Try from different network

## Your Project Links

- **Dashboard**: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh
- **Database Settings**: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh/settings/database
- **Table Editor**: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh/editor



