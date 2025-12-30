#!/bin/zsh

# Setup GitHub Repository Script
# This script initializes git and prepares for GitHub

set -e

PROJECT_DIR="/Users/dannielfrancis/york-castle-high-school"

cd "$PROJECT_DIR"

echo "🚀 Setting up GitHub Repository"
echo "================================"
echo ""

# Check if already a git repository
if [ -d ".git" ]; then
    echo "⚠️  Git repository already initialized"
    echo ""
    git status --short | head -10
    echo ""
    read "?Continue anyway? (y/n): " CONTINUE
    if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
        exit 0
    fi
else
    echo "📦 Initializing git repository..."
    git init
    echo "✅ Git repository initialized"
    echo ""
fi

# Check .gitignore
if [ -f ".gitignore" ]; then
    echo "✅ .gitignore found"
    
    # Check if .env is ignored
    if git check-ignore -q backend/.env 2>/dev/null; then
        echo "✅ .env files are properly ignored"
    else
        echo "⚠️  Warning: .env files may not be ignored"
    fi
else
    echo "⚠️  .gitignore not found"
fi
echo ""

# Stage all files
echo "📋 Staging files..."
git add .
echo "✅ Files staged"
echo ""

# Show what will be committed
echo "📝 Files to be committed:"
git status --short | head -20
echo ""

# Check for sensitive files
echo "🔒 Checking for sensitive files..."
SENSITIVE_FILES=$(git ls-files | grep -E '\.(env|key|secret|pem)$' || true)
if [ -n "$SENSITIVE_FILES" ]; then
    echo "⚠️  WARNING: Found potentially sensitive files:"
    echo "$SENSITIVE_FILES"
    echo ""
    read "?Continue anyway? (y/n): " CONTINUE
    if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
        echo "❌ Aborted. Please update .gitignore and try again."
        exit 1
    fi
else
    echo "✅ No sensitive files found"
fi
echo ""

# Create initial commit
echo "💾 Creating initial commit..."
git commit -m "Initial commit: York Castle High School web application

- Backend API (Node.js/Express) with Prisma ORM
- Admin Dashboard (React/TypeScript)
- Database migrations and Supabase integration
- Production-ready configuration
- Authentication and authorization
- Request management system
- User management system"

echo ""
echo "✅ Initial commit created!"
echo ""

# Check if remote exists
if git remote | grep -q origin; then
    echo "📡 Remote 'origin' already exists:"
    git remote -v
    echo ""
    read "?Update remote? (y/n): " UPDATE_REMOTE
    if [[ "$UPDATE_REMOTE" =~ ^[Yy]$ ]]; then
        read "?Enter GitHub repository URL: " REPO_URL
        git remote set-url origin "$REPO_URL"
        echo "✅ Remote updated"
    fi
else
    echo "📡 No remote repository configured"
    echo ""
    echo "Next steps:"
    echo "1. Create repository on GitHub: https://github.com/new"
    echo "2. Run: git remote add origin https://github.com/YOUR_USERNAME/york-castle-high-school.git"
    echo "3. Run: git push -u origin main"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Summary:"
echo "   - Git repository: ✅ Initialized"
echo "   - Initial commit: ✅ Created"
echo "   - Remote: $(git remote | grep -q origin && echo '✅ Configured' || echo '⚠️  Not configured')"
echo ""
echo "🔗 Next: Create repository on GitHub and push your code"
echo "   See: CREATE_GITHUB_REPO.md for detailed instructions"

