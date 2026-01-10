#!/bin/bash

# Script to remove all reCAPTCHA references from HTML files

# Find all HTML files and remove reCAPTCHA script tags and divs
find . -name "*.html" -type f -not -path "./node_modules/*" -not -path "./admin-dashboard/node_modules/*" -not -path "./backend/node_modules/*" | while read file; do
  if grep -q "recaptcha\|g-recaptcha\|data-sitekey" "$file" 2>/dev/null; then
    echo "Processing: $file"
    
    # Remove reCAPTCHA script tag
    sed -i '' '/<script src="https:\/\/www\.google\.com\/recaptcha\/api\.js"/d' "$file"
    
    # Remove reCAPTCHA div elements
    sed -i '' '/data-sitekey="6Lc2ElokAAAAAFdueSXtGKUAws2kQH2C3aiDh6sB"/d' "$file"
    sed -i '' '/class="w-form-formrecaptcha g-recaptcha/d' "$file"
    
    # Remove empty wrapper divs that might have contained reCAPTCHA
    sed -i '' '/<div class="div-block-264">/,/<\/div>/d' "$file" 2>/dev/null || true
    sed -i '' '/<div class="div-block-269">/,/<\/div>/d' "$file" 2>/dev/null || true
    
    echo "  ✓ Removed reCAPTCHA from $file"
  fi
done

echo "reCAPTCHA removal complete!"
