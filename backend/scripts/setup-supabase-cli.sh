#!/bin/bash

# Supabase CLI Setup Script
# This script helps set up Supabase CLI for the project

set -e

echo "🚀 Supabase CLI Setup"
echo "===================="
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed."
    echo ""
    echo "Install it with:"
    echo "  macOS:   brew install supabase/tap/supabase"
    echo "  Linux:   wget -qO- https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar -xz && sudo mv supabase /usr/local/bin/"
    echo "  Windows: scoop install supabase"
    echo ""
    echo "Or download from: https://github.com/supabase/cli/releases"
    exit 1
fi

echo "✅ Supabase CLI is installed"
supabase --version
echo ""

# Check if user is logged in
if ! supabase projects list &> /dev/null; then
    echo "🔐 You need to login to Supabase"
    echo "Running: supabase login"
    supabase login
fi

echo ""
echo "📋 Available commands:"
echo ""
echo "  Link to project:     supabase link --project-ref YOUR-PROJECT-REF"
echo "  Start local:         supabase start"
echo "  Stop local:          supabase stop"
echo "  View status:         supabase status"
echo "  Open Studio:         supabase studio"
echo "  Push migrations:      supabase db push"
echo "  Pull schema:         supabase db pull"
echo ""
echo "Or use npm scripts:"
echo "  npm run supabase:start"
echo "  npm run supabase:stop"
echo "  npm run supabase:status"
echo "  npm run supabase:studio"
echo "  npm run supabase:link"
echo ""
echo "📖 For detailed instructions, see:"
echo "  - SUPABASE_CLI_GUIDE.md (complete CLI guide)"
echo "  - SUPABASE_MIGRATION.md (migration guide)"
echo ""





