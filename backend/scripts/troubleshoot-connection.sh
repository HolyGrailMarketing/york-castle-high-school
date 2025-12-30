#!/bin/zsh

# Troubleshoot Supabase Connection Issues

set -e

PROJECT_REF="lmixjefkbejoibldpioh"
BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SUPABASE_BIN="$BACKEND_DIR/node_modules/.bin/supabase"

cd "$BACKEND_DIR"

echo "🔧 Troubleshooting Supabase Connection"
echo "======================================="
echo ""

# Step 1: Check if Supabase project is active
echo "📋 Step 1: Checking Supabase project status..."
if $SUPABASE_BIN projects list &> /dev/null 2>&1; then
    echo "✅ Logged in to Supabase CLI"
    echo ""
    echo "Checking project status..."
    $SUPABASE_BIN projects list | grep -i "$PROJECT_REF" || echo "⚠️  Project not found in list"
else
    echo "⚠️  Not logged in. Run: npx supabase login"
fi
echo ""

# Step 2: Check connection string format
echo "📋 Step 2: Checking DATABASE_URL format..."
if [ -f "$BACKEND_DIR/.env" ]; then
    if grep -q "DATABASE_URL" "$BACKEND_DIR/.env"; then
        DB_URL=$(grep "^DATABASE_URL=" "$BACKEND_DIR/.env" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
        
        # Check format
        if [[ "$DB_URL" == postgresql://* ]]; then
            echo "✅ DATABASE_URL format looks correct"
            
            # Extract components
            if [[ "$DB_URL" == *"$PROJECT_REF"* ]]; then
                echo "✅ Project ref matches: $PROJECT_REF"
            else
                echo "⚠️  Project ref mismatch in connection string"
            fi
            
            # Check port
            if [[ "$DB_URL" == *":5432"* ]]; then
                echo "✅ Using direct connection port (5432)"
            elif [[ "$DB_URL" == *":6543"* ]]; then
                echo "⚠️  Using pooled connection (6543) - try direct (5432) for migrations"
            fi
        else
            echo "❌ DATABASE_URL format incorrect (should start with postgresql://)"
        fi
    else
        echo "❌ DATABASE_URL not found in .env"
    fi
else
    echo "❌ .env file not found"
fi
echo ""

# Step 3: Test network connectivity
echo "📋 Step 3: Testing network connectivity..."
HOST="db.$PROJECT_REF.supabase.co"
PORT="5432"

if command -v nc &> /dev/null; then
    if nc -z -v -w5 "$HOST" "$PORT" 2>&1 | grep -q "succeeded"; then
        echo "✅ Can reach $HOST:$PORT"
    else
        echo "❌ Cannot reach $HOST:$PORT"
        echo "   This could mean:"
        echo "   - Supabase project is paused (free tier)"
        echo "   - Network/firewall blocking connection"
        echo "   - Project is inactive"
    fi
else
    echo "⚠️  'nc' (netcat) not available, skipping network test"
    echo "   Try: ping $HOST"
fi
echo ""

# Step 4: Check Supabase Dashboard
echo "📋 Step 4: Manual Checks"
echo "========================"
echo ""
echo "1. Check if project is active:"
echo "   https://supabase.com/dashboard/project/$PROJECT_REF"
echo ""
echo "2. If project is paused, click 'Restore' to activate it"
echo ""
echo "3. Verify connection string:"
echo "   https://supabase.com/dashboard/project/$PROJECT_REF/settings/database"
echo "   - Use 'URI' tab for direct connection"
echo "   - Make sure password is correct"
echo ""
echo "4. Check IP restrictions:"
echo "   https://supabase.com/dashboard/project/$PROJECT_REF/settings/database"
echo "   - Under 'Connection Pooling' → 'Allowed IPs'"
echo "   - Make sure your IP is allowed (or set to 0.0.0.0/0 for all)"
echo ""

# Step 5: Common fixes
echo "📋 Step 5: Common Fixes"
echo "======================"
echo ""
echo "Fix 1: Activate paused project"
echo "   - Go to Supabase Dashboard"
echo "   - Click 'Restore' if project is paused"
echo ""
echo "Fix 2: Verify connection string"
echo "   Format: postgresql://postgres:[PASSWORD]@db.$PROJECT_REF.supabase.co:5432/postgres"
echo "   - Replace [PASSWORD] with your actual password"
echo "   - URL-encode special characters in password"
echo ""
echo "Fix 3: Check password"
echo "   - Reset password if needed:"
echo "   https://supabase.com/dashboard/project/$PROJECT_REF/settings/database"
echo ""
echo "Fix 4: Use connection pooler (if direct fails)"
echo "   Change port from :5432 to :6543"
echo "   Add ?pgbouncer=true to connection string"
echo ""



