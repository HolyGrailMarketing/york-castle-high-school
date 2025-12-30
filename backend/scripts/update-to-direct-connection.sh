#!/bin/zsh

# Helper script to update DATABASE_URL to direct connection

PROJECT_REF="lmixjefkbejoibldpioh"
BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$BACKEND_DIR/.env"

echo "🔧 Update to Direct Connection"
echo "=============================="
echo ""

if [ ! -f "$ENV_FILE" ]; then
    echo "❌ .env file not found at: $ENV_FILE"
    exit 1
fi

echo "📋 Current DATABASE_URL:"
grep "^DATABASE_URL=" "$ENV_FILE" | head -1 | sed 's/:[^:@]*@/:****@/g' || echo "   Not found"
echo ""

echo "📝 To update to direct connection:"
echo ""
echo "1. Go to: https://supabase.com/dashboard/project/$PROJECT_REF/settings/database"
echo ""
echo "2. Scroll to 'Connection string' section"
echo ""
echo "3. Click 'URI' tab (NOT 'Connection pooling')"
echo ""
echo "4. Copy the connection string"
echo ""
echo "5. It should look like:"
echo "   postgresql://postgres:[PASSWORD]@db.$PROJECT_REF.supabase.co:5432/postgres"
echo ""
echo "6. Edit $ENV_FILE and update DATABASE_URL"
echo ""
echo "7. Make sure port is 5432 (direct), not 6543 (pooled)"
echo ""

# Check if already using direct connection
if grep -q "db\.$PROJECT_REF\.supabase\.co:5432" "$ENV_FILE" 2>/dev/null; then
    echo "✅ Already using direct connection (port 5432)"
elif grep -q ":6543\|pooler\.supabase\.com" "$ENV_FILE" 2>/dev/null; then
    echo "⚠️  Currently using pooled connection (port 6543)"
    echo "   Update to direct connection for migrations"
else
    echo "⚠️  Could not determine connection type"
fi
echo ""

