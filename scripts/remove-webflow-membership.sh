#!/bin/bash

# Script to remove Webflow membership library references from all HTML files
# and update logout buttons to use backend authentication

echo "Removing Webflow membership library references..."

# Find all HTML files
find . -type f -name "*.html" | while read -r file; do
  echo "Processing: $file"
  
  # Remove webflow-membership CSS link
  sed -i '' '/<link rel="stylesheet" href="https:\/\/cdn\.jsdelivr\.net\/gh\/sygnaltech\/webflow-util@.*\/dist\/css\/webflow-membership\.css">/d' "$file"
  
  # Remove webflow-membership.js script
  sed -i '' '/<script defer="" src="https:\/\/cdn\.jsdelivr\.net\/gh\/sygnaltech\/webflow-util@.*\/dist\/nocode\/webflow-membership\.js"><\/script>/d' "$file"
  
  # Remove sa5 configuration scripts
  sed -i '' '/window\.sa5 = window\.sa5 || \[\];/d' "$file"
  sed -i '' '/window\.sa5\.push(\['getMembershipRoutingConfig'/,/}\]);/d' "$file"
  sed -i '' '/window\.sa5\.push(\['getMembershipConfig'/,/}\]);/d' "$file"
  sed -i '' '/<!--  Sygnal Attributes 5 | Memberships | Config  -->/d' "$file"
  
  # Check if file has logout button and doesn't already have auth.js
  if grep -q "user-log-in-log-out" "$file" && ! grep -q "js/auth.js" "$file" && ! grep -q "log-in.html\|sign-up.html" "$file"; then
    # Add auth.js script before closing body tag (if not present)
    if ! grep -q "js/auth.js" "$file"; then
      # Add auth.js before closing body tag
      sed -i '' 's|</body>|  <script src="js/auth.js"></script>\n</body>|' "$file"
      echo "  ✓ Added auth.js to $file"
    fi
  fi
  
  echo "  ✓ Processed $file"
done

echo "Webflow membership removal completed!"
