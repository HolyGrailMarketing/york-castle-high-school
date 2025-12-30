#!/bin/zsh

# Fix Supabase connection using CLI
# This script will link to your Supabase project and help configure the connection

set -e

PROJECT_REF="lmixjefkbejoibldpioh"
BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$BACKEND_DIR/.env"
SUPABASE_BIN="$BACKEND_DIR/node_modules/.bin/supabase"

cd "$BACKEND_DIR"

echo "🔧 Fixing Supabase Connection"
echo "=============================="
echo ""
echo "Project: $PROJECT_REF"
echo ""

# Step 1: Check if logged in
echo "📋 Step 1: Checking login status..."
if ! $SUPABASE_BIN projects list &> /dev/null 2>&1; then
    echo "⚠️  Not logged in. Please login:"
    echo ""
    echo "   Run: $SUPABASE_BIN login"
    echo "   This will open your browser."
    echo ""
    read "?Press Enter after logging in, or Ctrl+C to cancel..."
else
    echo "✅ Already logged in"
    echo ""
fi

# Step 2: Link the project
echo "📋 Step 2: Linking to Supabase project..."
echo "   You'll need your database password."
echo "   Get it from: https://supabase.com/dashboard/project/$PROJECT_REF/settings/database"
echo ""

# Try to link (this will prompt for password)
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
echo ""

# Step 3: Get connection string from Supabase API
echo "📋 Step 3: Getting connection information..."

# Try to get connection info using Supabase CLI
CONNECTION_INFO=$($SUPABASE_BIN projects api-keys --project-ref "$PROJECT_REF" 2>/dev/null || echo "")

if [ -z "$CONNECTION_INFO" ]; then
    echo "⚠️  Could not automatically retrieve connection string."
    echo ""
    echo "📝 Please manually update your .env file:"
    echo ""
    echo "   1. Go to: https://supabase.com/dashboard/project/$PROJECT_REF/settings/database"
    echo "   2. Copy the connection string (URI tab)"
    echo "   3. Update DATABASE_URL in: $ENV_FILE"
    echo ""
    echo "   Format:"
    echo "   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.$PROJECT_REF.supabase.co:5432/postgres"
    echo ""
else
    echo "✅ Connection info retrieved"
fi

# Step 4: Check if .env exists and update
if [ -f "$ENV_FILE" ]; then
    echo ""
    echo "📋 Step 4: Checking .env file..."
    
    # Check if DATABASE_URL is already set to Supabase
    if grep -q "db\.$PROJECT_REF\.supabase\.co" "$ENV_FILE" 2>/dev/null; then
        echo "✅ DATABASE_URL already configured for Supabase"
    else
        echo "⚠️  DATABASE_URL needs to be updated"
        echo ""
        echo "   Please update $ENV_FILE with:"
        echo "   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.$PROJECT_REF.supabase.co:5432/postgres"
    fi
else
    echo ""
    echo "⚠️  .env file not found at: $ENV_FILE"
    echo "   Please create it with your DATABASE_URL"
fi

echo ""
echo "📋 Step 5: Next steps"
echo "===================="
echo ""
echo "1. Make sure DATABASE_URL is set in .env"
echo "2. Generate Prisma client:"
echo "   npm run db:generate"
echo ""
echo "3. Deploy migrations:"
echo "   npm run db:migrate"
echo ""
echo "4. Seed database (optional):"
echo "   npm run db:seed"
echo ""
echo "✅ Setup complete! Run the commands above to deploy your database."




