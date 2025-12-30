#!/bin/zsh

# Push to GitHub using CLI
# This script will create a GitHub repo and push your code

set -e

PROJECT_DIR="/Users/dannielfrancis/york-castle-high-school"
REPO_NAME="york-castle-high-school"

cd "$PROJECT_DIR"

echo "🚀 Pushing to GitHub"
echo "===================="
echo ""

# Step 1: Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing git repository..."
    git init
    echo "✅ Git initialized"
    echo ""
else
    echo "✅ Git repository already initialized"
    echo ""
fi

# Step 2: Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed"
    echo ""
    echo "Install it with:"
    echo "  brew install gh  # macOS"
    echo "  # Or visit: https://cli.github.com/"
    echo ""
    echo "After installing, run:"
    echo "  gh auth login"
    echo ""
    exit 1
fi

echo "✅ GitHub CLI found"
echo ""

# Step 3: Check if logged in to GitHub
if ! gh auth status &> /dev/null; then
    echo "⚠️  Not logged in to GitHub"
    echo "   Running: gh auth login"
    echo ""
    gh auth login
    echo ""
else
    echo "✅ Logged in to GitHub"
    gh auth status
    echo ""
fi

# Step 4: Stage and commit files
echo "📋 Staging files..."
git add .
echo "✅ Files staged"
echo ""

# Check if there are changes to commit
if git diff --staged --quiet; then
    echo "⚠️  No changes to commit"
    if git log -1 &> /dev/null; then
        echo "✅ Already have commits"
    else
        echo "❌ No commits found. Creating initial commit..."
        git commit -m "Initial commit: York Castle High School web application

- Backend API (Node.js/Express) with Prisma ORM
- Admin Dashboard (React/TypeScript)
- Database migrations and Supabase integration
- Production-ready configuration
- Authentication and authorization
- Request management system
- User management system"
        echo "✅ Initial commit created"
    fi
else
    echo "💾 Creating commit..."
    git commit -m "Initial commit: York Castle High School web application

- Backend API (Node.js/Express) with Prisma ORM
- Admin Dashboard (React/TypeScript)
- Database migrations and Supabase integration
- Production-ready configuration
- Authentication and authorization
- Request management system
- User management system"
    echo "✅ Commit created"
fi
echo ""

# Step 5: Check if remote exists
if git remote | grep -q origin; then
    REMOTE_URL=$(git remote get-url origin)
    echo "📡 Remote 'origin' already exists: $REMOTE_URL"
    echo ""
    read "?Update and push to existing remote? (y/n): " PUSH_EXISTING
    if [[ "$PUSH_EXISTING" =~ ^[Yy]$ ]]; then
        echo ""
        echo "📤 Pushing to existing remote..."
        git branch -M main
        git push -u origin main
        echo ""
        echo "✅ Pushed to GitHub!"
        exit 0
    else
        echo "❌ Aborted"
        exit 1
    fi
fi

# Step 6: Create repository on GitHub
echo "🔨 Creating repository on GitHub..."
echo "   Name: $REPO_NAME"
echo ""

# Ask for visibility
read "?Repository visibility (public/private) [public]: " VISIBILITY
VISIBILITY=${VISIBILITY:-public}

# Ask for description
read "?Repository description [York Castle High School - Web application]: " DESCRIPTION
DESCRIPTION=${DESCRIPTION:-"York Castle High School - Web application with admin dashboard"}

echo ""
echo "📤 Creating repository and pushing code..."
echo ""

# Create repo and push
gh repo create "$REPO_NAME" \
  --${VISIBILITY} \
  --description "$DESCRIPTION" \
  --source=. \
  --remote=origin \
  --push

echo ""
echo "✅ Successfully pushed to GitHub!"
echo ""
echo "🔗 Repository URL:"
gh repo view --web "$REPO_NAME" 2>/dev/null || echo "   https://github.com/$(gh api user --jq .login)/$REPO_NAME"
echo ""

