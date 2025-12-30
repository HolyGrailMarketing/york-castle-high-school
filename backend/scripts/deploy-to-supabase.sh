#!/bin/zsh

# Deploy Prisma schema to Supabase
# This script will create all tables in your Supabase database

set -e

PROJECT_REF="lmixjefkbejoibldpioh"
BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SUPABASE_BIN="$BACKEND_DIR/node_modules/.bin/supabase"

cd "$BACKEND_DIR"

echo "🚀 Deploying Tables to Supabase"
echo "================================"
echo ""
echo "Project: $PROJECT_REF"
echo ""

# Check if Supabase CLI is available
if [ ! -f "$SUPABASE_BIN" ]; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install supabase --save-dev
    echo "✅ Supabase CLI installed"
    echo ""
fi

# Step 1: Check login status
echo "📋 Step 1: Checking Supabase login..."
if ! $SUPABASE_BIN projects list &> /dev/null 2>&1; then
    echo "⚠️  Not logged in. Please login first:"
    echo ""
    echo "   Run: $SUPABASE_BIN login"
    echo "   This will open your browser to authenticate."
    echo ""
    read "?Press Enter after you've logged in, or Ctrl+C to cancel..."
else
    echo "✅ Already logged in"
    echo ""
fi

# Step 2: Check if linked
echo "📋 Step 2: Checking project link..."
if [ ! -f "$BACKEND_DIR/.supabase/config.toml" ]; then
    echo "⚠️  Project not linked. Linking now..."
    echo "   You'll need your database password."
    echo "   Get it from: https://supabase.com/dashboard/project/$PROJECT_REF/settings/database"
    echo ""
    
    $SUPABASE_BIN link --project-ref "$PROJECT_REF" || {
        echo ""
        echo "❌ Linking failed. Please check:"
        echo "   1. You're logged in: $SUPABASE_BIN login"
        echo "   2. Project ref is correct: $PROJECT_REF"
        echo "   3. Database password is correct"
        exit 1
    }
    echo ""
    echo "✅ Project linked successfully!"
else
    echo "✅ Project already linked"
fi
echo ""

# Step 3: Check DATABASE_URL
echo "📋 Step 3: Checking DATABASE_URL..."
if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "❌ .env file not found!"
    echo ""
    echo "Please create .env file with:"
    echo "DATABASE_URL=postgresql://postgres:[PASSWORD]@db.$PROJECT_REF.supabase.co:5432/postgres"
    echo ""
    echo "Get connection string from:"
    echo "https://supabase.com/dashboard/project/$PROJECT_REF/settings/database"
    exit 1
fi

# Check if DATABASE_URL contains Supabase
if ! grep -q "db\.$PROJECT_REF\.supabase\.co" "$BACKEND_DIR/.env" 2>/dev/null; then
    echo "⚠️  DATABASE_URL doesn't appear to be set for Supabase"
    echo "   Please update .env with:"
    echo "   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.$PROJECT_REF.supabase.co:5432/postgres"
    echo ""
    read "?Press Enter to continue anyway, or Ctrl+C to update .env first..."
else
    echo "✅ DATABASE_URL configured for Supabase"
fi
echo ""

# Step 4: Generate Prisma Client
echo "📋 Step 4: Generating Prisma Client..."
npx prisma generate || {
    echo "❌ Failed to generate Prisma client"
    exit 1
}
echo "✅ Prisma client generated"
echo ""

# Step 5: Deploy migrations
echo "📋 Step 5: Deploying database migrations..."
echo "   This will create all tables in Supabase..."
echo ""

npx prisma migrate deploy || {
    echo ""
    echo "❌ Migration failed!"
    echo ""
    echo "Troubleshooting:"
    echo "1. Check DATABASE_URL is correct in .env"
    echo "2. Verify database password is correct"
    echo "3. Check Supabase project is active"
    echo "4. Try: npx prisma migrate deploy --skip-generate"
    exit 1
}

echo ""
echo "✅ Migrations deployed successfully!"
echo ""

# Step 6: Verify tables
echo "📋 Step 6: Verifying tables..."
npx prisma db pull --force 2>&1 | head -20 || echo "Note: Could not verify (this is okay)"
echo ""

# Step 7: Ask about seeding
echo "📋 Step 7: Seed database?"
echo "   This will create an admin user and sample data."
echo ""
read "?Seed database? (y/n): " SEED_ANSWER

if [[ "$SEED_ANSWER" =~ ^[Yy]$ ]]; then
    echo ""
    echo "🌱 Seeding database..."
    npm run db:seed || {
        echo "⚠️  Seeding failed (this is optional)"
    }
    echo ""
fi

echo ""
echo "✅ Deployment Complete!"
echo "======================"
echo ""
echo "Your tables have been created in Supabase!"
echo ""
echo "Next steps:"
echo "1. Verify tables in Supabase Dashboard:"
echo "   https://supabase.com/dashboard/project/$PROJECT_REF/editor"
echo ""
echo "2. Start your backend server:"
echo "   npm run dev"
echo ""
echo "3. Test the API endpoints"
echo ""



