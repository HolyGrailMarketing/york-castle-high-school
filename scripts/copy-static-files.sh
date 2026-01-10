#!/bin/bash
# Copy static files to public directory for Vercel deployment

set -e

cd "$(dirname "$0")/.."

# Create public directory
mkdir -p public

# Copy admin dashboard build output
cp -r admin-dashboard/dist/. public/ || true

# Copy static HTML files
cp index.html public/ 2>/dev/null || true
cp *.html public/ 2>/dev/null || true

# Copy static asset directories
cp -r css public/ 2>/dev/null || true
cp -r js public/ 2>/dev/null || true
cp -r images public/ 2>/dev/null || true
cp -r fonts public/ 2>/dev/null || true
cp -r videos public/ 2>/dev/null || true
cp -r documents public/ 2>/dev/null || true

echo "Static files copied to public directory"
