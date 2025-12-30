#!/bin/zsh

# Supabase CLI Setup Script for York Castle High School
# Run this script to set up Supabase CLI

set -e

echo "🚀 Supabase CLI Setup for York Castle High School"
echo "=================================================="
echo ""

# Check if Supabase CLI is installed
if command -v supabase &> /dev/null; then
    echo "✅ Supabase CLI is already installed"
    supabase --version
    echo ""
else
    echo "📦 Installing Supabase CLI..."
    
    # Check for Homebrew
    if command -v brew &> /dev/null; then
        echo "Using Homebrew to install..."
        brew install supabase/tap/supabase
    else
        echo "❌ Homebrew not found. Please install Supabase CLI manually:"
        echo "   Visit: https://github.com/supabase/cli/releases"
        exit 1
    fi
    
    echo "✅ Supabase CLI installed"
    supabase --version
    echo ""
fi

# Check if user is logged in
echo "🔐 Checking Supabase login status..."
if supabase projects list &> /dev/null 2>&1; then
    echo "✅ Already logged in to Supabase"
    echo ""
    echo "Your projects:"
    supabase projects list
else
    echo "⚠️  Not logged in. Please login:"
    echo "   Run: supabase login"
    echo ""
    echo "This will open your browser to authenticate."
    read "?Press Enter to continue with login, or Ctrl+C to cancel..."
    supabase login
fi

echo ""
echo "📋 Next Steps:"
echo "=============="
echo ""
echo "1. Link to your Supabase project:"
echo "   cd backend"
echo "   supabase link --project-ref YOUR-PROJECT-REF"
echo ""
echo "2. Or start local Supabase for development:"
echo "   cd backend"
echo "   supabase start"
echo ""
echo "3. Deploy your Prisma migrations:"
echo "   cd backend"
echo "   npx prisma migrate deploy"
echo "   npm run prisma:seed"
echo ""
echo "📖 For more information, see:"
echo "   - SUPABASE_CLI_GUIDE.md (complete guide)"
echo "   - SUPABASE_MIGRATION.md (migration guide)"
echo ""





