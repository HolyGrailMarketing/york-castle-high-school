# Create GitHub Repository

## Step 1: Initialize Git Repository

Run these commands in your terminal:

```bash
cd /Users/dannielfrancis/york-castle-high-school

# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: York Castle High School web application"
```

## Step 2: Create Repository on GitHub

### Option A: Using GitHub Web Interface (Recommended)

1. **Go to GitHub**: https://github.com/new
2. **Repository name**: `york-castle-high-school` (or your preferred name)
3. **Description**: "York Castle High School - Web application with admin dashboard"
4. **Visibility**: Choose Public or Private
5. **DO NOT** initialize with README, .gitignore, or license (you already have these)
6. Click **"Create repository"**

### Option B: Using GitHub CLI

If you have GitHub CLI installed:

```bash
# Login to GitHub (if not already)
gh auth login

# Create repository
gh repo create york-castle-high-school \
  --public \
  --description "York Castle High School - Web application with admin dashboard" \
  --source=. \
  --remote=origin \
  --push
```

## Step 3: Connect Local Repository to GitHub

After creating the repository on GitHub, you'll see instructions. Run these commands:

```bash
# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/york-castle-high-school.git

# Or if using SSH:
# git remote add origin git@github.com:YOUR_USERNAME/york-castle-high-school.git

# Rename default branch to main (if needed)
git branch -M main

# Push to GitHub
git push -u origin main
```

## Step 4: Verify

Check that everything is pushed:

```bash
git remote -v
git status
```

Visit your repository: `https://github.com/YOUR_USERNAME/york-castle-high-school`

## Important: Before Pushing

Make sure these sensitive files are NOT committed:

✅ **Already in .gitignore:**
- `.env` files
- `node_modules/`
- `backend/logs/`
- `backend/.supabase/` (Supabase config)

⚠️ **Double-check these are NOT in your commit:**
```bash
# Check what will be committed
git status

# Make sure .env files are not listed
git check-ignore -v backend/.env admin-dashboard/.env
```

## Quick Setup Script

You can also run this all-in-one script:

```bash
#!/bin/zsh
cd /Users/dannielfrancis/york-castle-high-school

# Initialize git
git init

# Add all files
git add .

# Initial commit
git commit -m "Initial commit: York Castle High School web application

- Backend API (Node.js/Express)
- Admin Dashboard (React/TypeScript)
- Database migrations (Prisma)
- Supabase integration
- Production-ready configuration"

echo ""
echo "✅ Git repository initialized!"
echo ""
echo "Next steps:"
echo "1. Create repository on GitHub: https://github.com/new"
echo "2. Run: git remote add origin https://github.com/YOUR_USERNAME/york-castle-high-school.git"
echo "3. Run: git push -u origin main"
```

## Repository Structure

Your repository will include:

```
york-castle-high-school/
├── backend/              # Express API
│   ├── src/
│   ├── prisma/
│   └── package.json
├── admin-dashboard/      # React Admin Dashboard
│   ├── src/
│   └── package.json
├── public/              # Public HTML pages
├── README.md
├── .gitignore
└── ...
```

## Recommended Repository Settings

After creating the repo, consider:

1. **Add topics/tags**: `education`, `school-management`, `nodejs`, `react`, `typescript`
2. **Add description**: "York Castle High School - Web application with admin dashboard"
3. **Enable Issues**: For bug tracking
4. **Add README**: Update with project description
5. **Add LICENSE**: Choose appropriate license (MIT, Apache, etc.)

## Troubleshooting

### "Repository already exists"
- The repository name is taken
- Choose a different name or use your username as prefix: `YOUR_USERNAME-york-castle-high-school`

### "Authentication failed"
- Use GitHub Personal Access Token instead of password
- Or set up SSH keys: https://docs.github.com/en/authentication/connecting-to-github-with-ssh

### "Permission denied"
- Check you have write access to the repository
- Verify your GitHub credentials

## Next Steps After Creating Repo

1. **Add collaborators** (if working in a team)
2. **Set up GitHub Actions** (for CI/CD)
3. **Add branch protection** (for main branch)
4. **Create issues** for tracking tasks
5. **Add project board** for project management

