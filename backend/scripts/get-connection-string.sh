#!/bin/zsh

# Get Supabase Connection String
# Project: lmixjefkbejoibldpioh

PROJECT_REF="lmixjefkbejoibldpioh"
PROJECT_URL="https://lmixjefkbejoibldpioh.supabase.co"

echo "🔗 Supabase Connection Setup"
echo "============================="
echo ""
echo "Project: $PROJECT_REF"
echo "URL: $PROJECT_URL"
echo ""

echo "📋 To get your connection string:"
echo ""
echo "1. Go to Supabase Dashboard:"
echo "   https://supabase.com/dashboard/project/$PROJECT_REF/settings/database"
echo ""
echo "2. Scroll to 'Connection string' section"
echo ""
echo "3. Select 'URI' tab (not 'Connection pooling')"
echo ""
echo "4. Copy the connection string"
echo ""
echo "5. It should look like:"
echo "   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres"
echo ""
echo "   OR for direct connection:"
echo "   postgresql://postgres:[YOUR-PASSWORD]@db.$PROJECT_REF.supabase.co:5432/postgres"
echo ""
echo "6. Update your backend/.env file:"
echo "   DATABASE_URL=<paste-connection-string-here>"
echo ""
echo "📝 Important Notes:"
echo "==================="
echo ""
echo "• For migrations: Use direct connection (port 5432)"
echo "• For app runtime: Can use pooled connection (port 6543)"
echo "• Replace [YOUR-PASSWORD] with your actual database password"
echo "• URL-encode special characters in password if needed"
echo ""
echo "🔧 After updating .env, test connection:"
echo "   cd backend"
echo "   npm run db:test"
echo ""



