#!/usr/bin/env node

/**
 * Script to remove Webflow membership library references from all HTML files
 * and add backend authentication scripts where needed
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get all HTML files in the project root (excluding node_modules and admin-dashboard/dist)
function getAllHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    // Skip node_modules, admin-dashboard, backend, and dist directories
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'admin-dashboard' && file !== 'backend' && file !== 'dist' && !file.startsWith('.')) {
        getAllHtmlFiles(filePath, fileList);
      }
    } else if (file.endsWith('.html')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Remove webflow-membership references from HTML file
function removeWebflowMembership(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Remove webflow-membership CSS link
  const cssPattern = /<link[^>]*href="https:\/\/cdn\.jsdelivr\.net\/gh\/sygnaltech\/webflow-util@[^"]*\/dist\/css\/webflow-membership\.css"[^>]*>/g;
  if (cssPattern.test(content)) {
    content = content.replace(cssPattern, '');
    modified = true;
  }

  // Remove webflow-membership.js script
  const jsPattern = /<script[^>]*src="https:\/\/cdn\.jsdelivr\.net\/gh\/sygnaltech\/webflow-util@[^"]*\/dist\/nocode\/webflow-membership\.js"[^>]*><\/script>/g;
  if (jsPattern.test(content)) {
    content = content.replace(jsPattern, '');
    modified = true;
  }

  // Remove sa5 configuration scripts (multi-line) - handle various formats
  // Pattern 1: Complete block with comment and script tag
  const sa5Pattern1 = /<!--\s*Sygnal Attributes 5[^>]*-->\s*<script>[\s\S]*?window\.sa5\.push\(\[['"]getMembership(?:Routing)?Config['"][\s\S]*?}\)\];?\s*<\/script>/gi;
  if (sa5Pattern1.test(content)) {
    content = content.replace(sa5Pattern1, '');
    modified = true;
  }

  // Pattern 2: Script tag with sa5.push and comment
  const sa5Pattern2 = /<!--\s*Sygnal Attributes 5[^>]*-->\s*<script>\s*[\s\S]*?window\.sa5\.push\(\[['"]getMembership(?:Routing)?Config['"][\s\S]*?}\)\];?\s*<\/script>/gi;
  if (sa5Pattern2.test(content)) {
    content = content.replace(sa5Pattern2, '');
    modified = true;
  }

  // Pattern 3: Script tag with sa5.push inside (without window.sa5 initialization)
  const sa5Pattern3 = /<script>\s*[\s\S]*?window\.sa5\.push\(\[['"]getMembership(?:Routing)?Config['"][\s\S]*?}\)\];?\s*<\/script>/gi;
  if (sa5Pattern3.test(content)) {
    content = content.replace(sa5Pattern3, '');
    modified = true;
  }

  // Pattern 4: getMembershipConfig blocks (without Routing)
  const sa5Pattern4 = /<script>\s*[\s\S]*?window\.sa5\.push\(\[['"]getMembershipConfig['"][\s\S]*?}\)\];?\s*<\/script>/gi;
  if (sa5Pattern4.test(content)) {
    content = content.replace(sa5Pattern4, '');
    modified = true;
  }

  // Pattern 5: Standalone window.sa5.push (if not inside script tag)
  const sa5Pattern5 = /window\.sa5\.push\(\[['"]getMembership(?:Routing)?Config['"][\s\S]*?}\)\];?/gi;
  const hasSa5Push = sa5Pattern5.test(content);
  if (hasSa5Push) {
    // Check if it's in a script tag context - if not, we need to remove the script tag too
    // Remove any remaining sa5.push calls (they should be in script tags but handle edge cases)
    content = content.replace(/window\.sa5\.push\(\[['"]getMembership(?:Routing)?Config['"][\s\S]*?}\)\];?/gi, '');
    modified = true;
  }

  // Remove standalone sa5 initialization
  const sa5InitPattern = /window\.sa5\s*=\s*window\.sa5\s*\|\|\s*\[\];?/gi;
  if (sa5InitPattern.test(content)) {
    content = content.replace(sa5InitPattern, '');
    modified = true;
  }

  // Clean up orphaned script tags and comments
  content = content.replace(/<!--\s*Sygnal Attributes 5[^>]*-->/gi, '');
  content = content.replace(/<script>\s*<\/script>/gi, '');
  content = content.replace(/<script>\s*\n\s*<\/script>/gi, '');
  content = content.replace(/<script>\s*\n\s*\n\s*<\/script>/gi, '');

  // Clean up multiple consecutive newlines (but keep at least one)
  content = content.replace(/\n{4,}/g, '\n\n\n');

  // Check if file has logout button
  const hasLogoutButton = /user-log-in-log-out/.test(content);
  const needsAuthJs = hasLogoutButton && !/log-in\.html|sign-up\.html/.test(filePath);
  const hasAuthJs = /js\/auth\.js/.test(content);

  // Add auth.js if needed
  if (needsAuthJs && !hasAuthJs) {
    // Add auth.js before closing body tag
    content = content.replace(/<\/body>/i, '  <script src="js/auth.js"></script>\n</body>');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }

  return false;
}

// Main execution
const projectRoot = process.cwd();
const htmlFiles = getAllHtmlFiles(projectRoot);

console.log(`Found ${htmlFiles.length} HTML files to process...`);

let processedCount = 0;
htmlFiles.forEach(file => {
  try {
    if (removeWebflowMembership(file)) {
      processedCount++;
      console.log(`✓ Processed: ${path.relative(projectRoot, file)}`);
    }
  } catch (error) {
    console.error(`✗ Error processing ${file}:`, error.message);
  }
});

console.log(`\nCompleted! Processed ${processedCount} files.`);
