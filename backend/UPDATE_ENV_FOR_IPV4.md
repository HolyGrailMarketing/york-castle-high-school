# Update .env for IPv4 Compatibility

## Current Issue

Your direct connection shows "Not IPv4 compatible" in Supabase Dashboard. You need to use the **Session Pooler** instead.

## Solution: Use Session Pooler

The Session Pooler is IPv4-compatible and supports prepared statements (needed for Prisma migrations).

## Update Your .env File

### Current (Transaction Pooler - doesn't work for migrations):
```env
DATABASE_URL=postgresql://postgres.lmixjefkbejoibldpioh:ElOwJ56BtU3XSP56@aws-0-us-west-2.pooler.supabase.com:6543/postgres
```

### Update To (Session Pooler - works for migrations):
```env
# Session Pooler (IPv4 compatible, supports prepared statements)
DATABASE_URL=postgresql://postgres.lmixjefkbejoibldpioh:ElOwJ56BtU3XSP56@aws-0-us-west-2.pooler.supabase.com:5432/postgres?pgbouncer=true
```

## Key Changes

1. **Port**: Change from `6543` → `5432`
2. **Add parameter**: `?pgbouncer=true` at the end

## How to Get Session Pooler Connection String

1. Go to: https://supabase.com/dashboard/project/lmixjefkbejoibldpioh/settings/database
2. Scroll to **"Connection Pooling"** section
3. Look for **"Session mode"** (not Transaction mode)
4. Copy that connection string
5. It should have port `5432` and include `?pgbouncer=true`

## After Updating

```bash
cd backend
npm run db:test
npm run db:migrate
```

## Why This Works

- ✅ **IPv4 compatible** - Works on IPv4-only networks
- ✅ **Supports prepared statements** - Required for Prisma migrations
- ✅ **Session mode** - Maintains connection state

## Connection Types

| Type | Port | IPv4 | Prepared Statements | Use For |
|------|------|------|---------------------|---------|
| Direct | 5432 | ❌ No | ✅ Yes | Migrations (if IPv6) |
| **Session Pooler** | **5432** | ✅ **Yes** | ✅ **Yes** | **Migrations (IPv4)** ✅ |
| Transaction Pooler | 6543 | ✅ Yes | ❌ No | App runtime only |

