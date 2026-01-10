#!/bin/bash

# Script to apply header UI improvements to all HTML files

# List of files already updated
UPDATED_FILES=("index.html" "contact-us.html" "blog.html" "teachers.html")

# Function to check if file is already updated
is_updated() {
    local filename=$(basename "$1")
    for updated in "${UPDATED_FILES[@]}"; do
        if [ "$filename" = "$updated" ]; then
            return 0
        fi
    done
    return 1
}

# Function to update HTML structure
update_html() {
    local file="$1"
    echo "Updating HTML structure in $file"

    # Update the navigation HTML structure
    sed -i '' 's|<a href="tel:+1876975-2217" class="top-nav-link w-inline-block">|<div class="contact-info-section">\
              <a href="tel:+1876975-2217" class="top-nav-link w-inline-block">|g' "$file"

    sed -i '' 's|<a href="mailto:yorkcastle.high.san@moey.gov.jm" class="top-nav-link w-inline-block">|              <div class="contact-divider">|</div>\
              <a href="mailto:yorkcastle.high.san@moey.gov.jm" class="top-nav-link w-inline-block">|g' "$file"

    sed -i '' 's|<button class="user-log-in-log-out top-nav-link" data-wf-user-logout="Log out" data-wf-user-login="Log in" type="button">Log out</button>|            </div>\
            <div class="login-section">\
              <button class="user-log-in-log-out top-nav-link login-button" data-wf-user-logout="Log out" data-wf-user-login="Log in" type="button">Log out</button>\
            </div>|g' "$file"
}

# Function to add CSS styles
add_css() {
    local file="$1"
    echo "Adding CSS styles to $file"

    # Add CSS before closing </style> tag
    sed -i '' 's|  .btn:focus-visible { outline: 2px solid #d3ba1c; outline-offset: 2px; }|  .btn:focus-visible { outline: 2px solid #d3ba1c; outline-offset: 2px; }

  /* Improved Header UI Styles */
  .top-nav-menu {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }

  .contact-info-section {
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .contact-divider {
    color: rgba(255, 255, 255, 0.6);
    font-weight: bold;
    margin: 0 5px;
  }

  .login-section {
    margin-left: auto;
  }

  .login-button {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 20px;
    padding: 6px 16px;
    transition: all 0.3s ease;
    font-weight: 500;
  }

  .login-button:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.5);
    transform: translateY(-1px);
  }

  /* Enhanced responsive design */
  @media (max-width: 768px) {
    .contact-info-section {
      flex-direction: column;
      gap: 8px;
      align-items: flex-start;
    }

    .contact-divider {
      display: none;
    }

    .top-nav-menu {
      flex-direction: column;
      gap: 10px;
      text-align: center;
    }

    .login-section {
      margin-left: 0;
    }
  }|g' "$file"
}

# Process all HTML files
for file in *.html; do
    if [ -f "$file" ] && ! is_updated "$file"; then
        echo "Processing $file..."
        update_html "$file"
        add_css "$file"
        echo "Completed $file"
    fi
done

echo "All HTML files have been updated!"