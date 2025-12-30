# Fix: IPv4 Compatibility for Supabase Connection

## Problem

The direct connection (port 5432) shows "Not IPv4 compatible" in Supabase Dashboard. This means your network only supports IPv4, but the direct connection uses IPv6.

## Solution: Use Session Pooler

The **Session Pooler** is IPv4-compatible and supports prepared statements (needed for Prisma migrations), unlike the Transaction Pooler.

## Get Session Pooler Connection String

### Step 1: Open Connection Settings

1. Go to: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh/settings/database
2. Scroll to **"Connection Pooling"** section
3. Click **"Session mode"** (not Transaction mode)

### Step 2: Copy Session Pooler Connection String

The Session Pooler connection string looks like:
```
postgresql://postgres.lmixjefkbejoibldpioh:[YOUR-PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres?pgbouncer=true
```

**Key differences:**
- Port: `5432` (same as direct, but goes through pooler)
- Host: `aws-0-us-west-2.pooler.supabase.com` (pooler hostname)
- Username: `postgres.lmixjefkbejoibldpioh` (includes project ref)
- Parameter: `?pgbouncer=true` (enables session mode)

### Step 3: Update .env File

Edit `backend/.env` and update `DATABASE_URL`:

```env
# Session Pooler (IPv4 compatible, supports prepared statements)
DATABASE_URL=postgresql://postgres.lmixjefkbejoibldpioh:[YOUR-PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres?pgbouncer=true
```

**Important:** 
- Use port `5432` (not 6543)
- Include `?pgbouncer=true` parameter
- Username format: `postgres.[PROJECT-REF]`

## Connection Types Comparison

| Type | Port | IPv4 | Prepared Statements | Use For |
|------|------|------|---------------------|---------|
| **Direct** | 5432 | ❌ No | ✅ Yes | Migrations (if IPv6 available) |
| **Session Pooler** | 5432 | ✅ Yes | ✅ Yes | **Migrations (IPv4 networks)** ✅ |
| **Transaction Pooler** | 6543 | ✅ Yes | ❌ No | App runtime only |

## Why Session Pooler Works

- ✅ **IPv4 compatible** - Works on IPv4-only networks
- ✅ **Supports prepared statements** - Required for Prisma migrations
- ✅ **Session mode** - Maintains connection state (unlike transaction mode)

## Alternative: Use Transaction Pooler for App Only

If you want to use different connections:

```env
# For migrations - Session Pooler (IPv4 compatible)
DATABASE_URL=postgresql://postgres.lmixjefkbejoibldpioh:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres?pgbouncer=true

# For app runtime - Transaction Pooler (optional, better performance)
DATABASE_URL_POOLED=postgresql://postgres.lmixjefkbejoibldpioh:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true
```

## Test Connection

After updating `.env`:

```bash
cd backend
npm run db:test
```

## Run Migrations

```bash
npm run db:migrate
```

## Your Current Connection

You're currently using:
```
postgresql://postgres.lmixjefkbejoibldpioh:****@aws-0-us-west-2.pooler.supabase.com:6543/postgres
```

This is the **Transaction Pooler** (port 6543) which:
- ✅ Works for app runtime
- ❌ Does NOT support prepared statements
- ❌ Cannot be used for Prisma migrations

## Update To

Change to **Session Pooler**:
```
postgresql://postgres.lmixjefkbejoibldpioh:[PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres?pgbouncer=true
```

Key changes:
- Port: `6543` → `5432`
- Add parameter: `?pgbouncer=true`

## Quick Reference

**Session Pooler (for migrations):**
- Port: `5432`
- Host: `aws-0-[REGION].pooler.supabase.com`
- Username: `postgres.[PROJECT-REF]`
- Parameter: `?pgbouncer=true`

**Transaction Pooler (for app):**
- Port: `6543`
- Host: `aws-0-[REGION].pooler.supabase.com`
- Username: `postgres.[PROJECT-REF]`
- Parameter: `?pgbouncer=true`

## Links

- **Database Settings**: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh/settings/database
- **Connection Pooling Docs**: https://supabase.com/docs/guides/platform/connection-pooling

