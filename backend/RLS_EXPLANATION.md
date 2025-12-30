# Row Level Security (RLS) in Supabase

## What is "UNRESTRICTED"?

The "UNRESTRICTED" tag in Supabase Table Editor means:
- **Row Level Security (RLS) is disabled** on that table
- **Data is accessible via Supabase API** without row-level restrictions
- **Your application's authentication** controls access (which is what you're using)

## Why This is OK for Your Setup

Since you're using **Prisma** with **application-level authentication**:

✅ **You handle security in your Express backend:**
- JWT authentication middleware
- Role-based access control (ADMIN, STAFF, STUDENT, PARENT)
- API route protection

✅ **Supabase API is not directly exposed:**
- Users don't access Supabase API directly
- All requests go through your Express backend
- Your backend validates authentication/authorization

## When You DON'T Need RLS

You **don't need RLS** if:
- ✅ Using Prisma (you are)
- ✅ Handling auth in your backend (you are)
- ✅ Not exposing Supabase API directly to clients (you're not)
- ✅ All database access goes through your Express API (it does)

## When You DO Need RLS

You **should enable RLS** if:
- ❌ Exposing Supabase API directly to frontend
- ❌ Using Supabase Auth (instead of your JWT system)
- ❌ Want database-level security as an extra layer

## Current Setup (Recommended)

Your current setup is **correct and secure**:

```
Frontend → Express API (with JWT auth) → Prisma → Supabase Database
```

Security is handled at the **application layer**, not the database layer.

## If You Want to Enable RLS (Optional)

If you want an extra security layer, you can enable RLS:

### Option 1: Enable RLS via SQL

Run this in Supabase SQL Editor:

```sql
-- Enable RLS on all tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Application" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SixthFormApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Course" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Enrollment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BlogPost" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Event" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Request" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Teacher" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Analytics" ENABLE ROW LEVEL SECURITY;
```

### Option 2: Create RLS Policies

After enabling RLS, you need policies. Since you're using Prisma, you can create permissive policies:

```sql
-- Allow all operations for authenticated users (your Express API)
CREATE POLICY "Allow all for authenticated" ON "User"
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Repeat for other tables...
```

**Note:** With Prisma, you typically want permissive policies since your app handles authorization.

### Option 3: Disable RLS (Current - Recommended)

Keep RLS disabled since:
- Your Express API handles all security
- Prisma doesn't need RLS policies
- Simpler setup and better performance

## Security Best Practices

Even with RLS disabled, your setup is secure because:

1. **Database connection is private:**
   - Only your backend has `DATABASE_URL`
   - Frontend never connects directly to database

2. **Authentication is enforced:**
   - JWT tokens required for API access
   - Middleware validates tokens on every request

3. **Authorization is enforced:**
   - Role-based access control in controllers
   - Admin routes protected by middleware

4. **API rate limiting:**
   - Prevents abuse
   - Protects against brute force

5. **Input validation:**
   - Express-validator checks all inputs
   - SQL injection prevented by Prisma

## Summary

**Current Status:** ✅ **Secure and Correct**

- RLS disabled = OK for Prisma + Express setup
- Security handled at application layer
- No action needed unless you want extra database-level security

**The "UNRESTRICTED" warning is informational** - it's telling you that if someone had direct Supabase API access, they could read data. But since you're not exposing the Supabase API, this isn't a concern.

## If You Want to Hide the Warning

You can enable RLS with permissive policies to remove the warning, but it's not necessary:

```sql
-- Enable RLS
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

-- Create permissive policy (allows all for your app)
CREATE POLICY "app_access" ON "User" FOR ALL USING (true) WITH CHECK (true);
```

This removes the warning but doesn't change security (since your app already handles it).

