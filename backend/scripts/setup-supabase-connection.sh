#!/bin/zsh

# Script to connect to Supabase project using CLI
# Project: lmixjefkbejoibldpioh

set -e

PROJECT_REF="lmixjefkbejoibldpioh"
BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$BACKEND_DIR/.env"

echo "🔗 Setting up Supabase connection for project: $PROJECT_REF"
echo ""

# Check if logged in
echo "📋 Checking Supabase login status..."
if ! ./node_modules/.bin/supabase projects list &> /dev/null 2>&1; then
    echo "⚠️  Not logged in. Please login first:"
    echo ""
    echo "   Run: npx supabase login"
    echo "   This will open your browser to authenticate."
    echo ""
    read "?Press Enter after you've logged in, or Ctrl+C to cancel..."
else
    echo "✅ Already logged in"
    echo ""
fi

# Link the project
echo "🔗 Linking to Supabase project..."
echo "   Project Ref: $PROJECT_REF"
echo "   You'll be prompted for your database password."
echo "   Get it from: https://supabase.com/dashboard/project/$PROJECT_REF/settings/database"
echo ""

./node_modules/.bin/supabase link --project-ref "$PROJECT_REF"

echo ""
echo "✅ Project linked successfully!"
echo ""

# Get connection info from Supabase
echo "📋 Getting connection information..."
echo ""

# Read the config file to get connection details
CONFIG_FILE="$BACKEND_DIR/.supabase/config.toml"
if [ -f "$CONFIG_FILE" ]; then
    echo "✅ Supabase config found"
    
    # Extract database URL from config (if available)
    DB_URL=$(grep -E "^db_url|database_url" "$CONFIG_FILE" 2>/dev/null | head -1 | cut -d'"' -f2 || echo "")
    
    if [ -n "$DB_URL" ]; then
        echo "   Found database URL in config"
    fi
else
    echo "⚠️  Config file not found at: $CONFIG_FILE"
fi

echo ""
echo "📝 Next steps:"
echo "=============="
echo ""
echo "1. Get your connection string from Supabase Dashboard:"
echo "   https://supabase.com/dashboard/project/$PROJECT_REF/settings/database"
echo ""
echo "2. Update your .env file with the DATABASE_URL:"
echo "   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.$PROJECT_REF.supabase.co:5432/postgres"
echo ""
echo "3. Deploy your database schema:"
echo "   npm run db:generate"
echo "   npm run db:migrate"
echo "   npm run db:seed"
echo ""




