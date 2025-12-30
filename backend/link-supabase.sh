#!/bin/zsh
# Quick script to link Supabase project

echo "🔗 Linking to Supabase project: lmixjefkbejoibldpioh"
echo ""

# Check if logged in
if ! npx supabase projects list &> /dev/null 2>&1; then
    echo "⚠️  Not logged in. Logging in now..."
    npx supabase login
    echo ""
fi

echo "Linking project..."
npx supabase link --project-ref lmixjefkbejoibldpioh

echo ""
echo "✅ Done! Next steps:"
echo "1. Update DATABASE_URL in .env file"
echo "2. Run: npm run db:generate"
echo "3. Run: npm run db:migrate"
echo "4. Run: npm run db:seed (optional)"
