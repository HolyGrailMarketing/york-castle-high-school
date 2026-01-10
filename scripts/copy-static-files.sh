#!/bin/bash
# Copy static files to public directory for Vercel deployment

# Don't use set -e since we want to continue even if some copies fail
set +e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "Current directory: $(pwd)"
echo "Project root: $PROJECT_ROOT"

# Create public directory
mkdir -p public
echo "Created public directory"

# Copy admin dashboard build output to public/admin (so Vercel serves it directly)
if [ -d "admin-dashboard/dist" ]; then
  echo "Copying admin dashboard build output to public/admin..."
  mkdir -p public/admin
  cp -r admin-dashboard/dist/. public/admin/ 2>&1
  [ $? -eq 0 ] && echo "✓ Admin dashboard copied to public/admin" || echo "✗ Failed to copy admin dashboard"
else
  echo "✗ admin-dashboard/dist not found - admin dashboard may not be built"
fi

# Copy static HTML files
echo "Copying HTML files..."
if [ -f "index.html" ]; then
  cp index.html public/ 2>&1
  [ $? -eq 0 ] && echo "✓ index.html copied" || echo "✗ Failed to copy index.html"
fi

for html_file in *.html; do
  if [ -f "$html_file" ]; then
    cp "$html_file" public/ 2>&1
  fi
done
echo "✓ HTML files copied"

# Copy static asset directories (only if they exist)
echo "Copying asset directories..."
if [ -d "css" ]; then
  cp -r css public/ 2>&1
  [ $? -eq 0 ] && echo "✓ css/ copied" || echo "✗ Failed to copy css/"
else
  echo "✗ css/ directory not found"
fi

if [ -d "js" ]; then
  cp -r js public/ 2>&1
  [ $? -eq 0 ] && echo "✓ js/ copied" || echo "✗ Failed to copy js/"
else
  echo "✗ js/ directory not found"
fi

if [ -d "images" ]; then
  cp -r images public/ 2>&1
  [ $? -eq 0 ] && echo "✓ images/ copied" || echo "✗ Failed to copy images/"
else
  echo "✗ images/ directory not found"
fi

if [ -d "fonts" ]; then
  cp -r fonts public/ 2>&1
  [ $? -eq 0 ] && echo "✓ fonts/ copied" || echo "✗ Failed to copy fonts/"
else
  echo "✗ fonts/ directory not found"
fi

if [ -d "videos" ]; then
  cp -r videos public/ 2>&1
  [ $? -eq 0 ] && echo "✓ videos/ copied" || echo "✗ Failed to copy videos/"
else
  echo "✗ videos/ directory not found"
fi

if [ -d "documents" ]; then
  cp -r documents public/ 2>&1
  [ $? -eq 0 ] && echo "✓ documents/ copied" || echo "✗ Failed to copy documents/"
else
  echo "✗ documents/ directory not found"
fi

# Verify what was copied
echo ""
echo "=== Verification Summary ==="
echo "Directories in public/:"
find public -maxdepth 1 -type d ! -path public | sed 's|public/||' || echo "No directories found"
echo ""
echo "File count in public/: $(find public -type f | wc -l | tr -d ' ')"
echo ""
echo "Checking key directories:"
[ -d "public/css" ] && echo "✓ public/css exists ($(find public/css -type f | wc -l | tr -d ' ') files)" || echo "✗ public/css MISSING"
[ -d "public/js" ] && echo "✓ public/js exists ($(find public/js -type f | wc -l | tr -d ' ') files)" || echo "✗ public/js MISSING"
[ -d "public/images" ] && echo "✓ public/images exists ($(find public/images -type f | wc -l | tr -d ' ') files)" || echo "✗ public/images MISSING"
[ -d "public/videos" ] && echo "✓ public/videos exists ($(find public/videos -type f | wc -l | tr -d ' ') files)" || echo "✗ public/videos MISSING"
[ -d "public/admin" ] && echo "✓ public/admin exists ($(find public/admin -type f | wc -l | tr -d ' ') files)" || echo "✗ public/admin MISSING"
echo ""
echo "Sample files in public/:"
ls -1 public/ | head -15
if [ -d "public/admin" ]; then
  echo ""
  echo "Admin dashboard files in public/admin/:"
  ls -1 public/admin/ | head -10
fi
echo ""
echo "=== Build script completed ==="
