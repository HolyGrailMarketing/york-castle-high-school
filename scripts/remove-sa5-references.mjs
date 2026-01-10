#!/usr/bin/env node

/**
 * Script to remove all sa5.push references from HTML files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Get all HTML files
function getAllHtmlFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    try {
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        // Skip node_modules, admin-dashboard, backend, and dist directories
        if (file !== 'node_modules' && 
            file !== 'admin-dashboard' && 
            file !== 'backend' && 
            file !== 'dist' && 
            !file.startsWith('.')) {
          getAllHtmlFiles(filePath, fileList);
        }
      } else if (file.endsWith('.html')) {
        fileList.push(filePath);
      }
    } catch (error) {
      // Skip files we can't access
      if (error.code !== 'EACCES' && error.code !== 'EPERM') {
        console.warn(`Warning: Could not access ${filePath}: ${error.message}`);
      }
    }
  });
  
  return fileList;
}

// Remove sa5 references from HTML content
function removeSa5References(content) {
  let modified = false;
  let result = content;
  const originalLength = result.length;

  // Remove sa5.push blocks - handle all variations
  // Use a more comprehensive pattern that matches from <script> to </script>
  // including any whitespace/newlines and the entire sa5.push call with its content
  
  // Pattern 1: getMembershipRoutingConfig - matches complete script blocks
  const pattern1 = /<script>\s*\n?\s*window\.sa5\.push\(\[['"]getMembershipRoutingConfig['"][\s\S]*?}\)\];?\s*<\/script>/gi;
  let newResult = result.replace(pattern1, '');
  if (newResult.length !== result.length) {
    result = newResult;
    modified = true;
  }

  // Pattern 2: getMembershipConfig - matches complete script blocks
  const pattern2 = /<script>\s*\n?\s*window\.sa5\.push\(\[['"]getMembershipConfig['"][\s\S]*?}\)\];?\s*<\/script>/gi;
  newResult = result.replace(pattern2, '');
  if (newResult.length !== result.length) {
    result = newResult;
    modified = true;
  }

  // Pattern 3: More general - any script tag containing window.sa5.push with any content before it
  const pattern3 = /<script>[\s\S]*?window\.sa5\.push\(\[['"]getMembership(?:Routing)?Config['"][\s\S]*?}\)\];?\s*<\/script>/gi;
  newResult = result.replace(pattern3, '');
  if (newResult.length !== result.length) {
    result = newResult;
    modified = true;
  }

  // Pattern 3: Remove Sygnal Attributes comments (standalone or before script)
  const commentPattern = /<!--\s*Sygnal Attributes 5[^>]*-->/gi;
  if (commentPattern.test(result)) {
    result = result.replace(commentPattern, '');
    modified = true;
  }

  // Pattern 4: Remove standalone window.sa5 initialization (if any)
  const initPattern = /window\.sa5\s*=\s*window\.sa5\s*\|\|\s*\[\];?/gi;
  if (initPattern.test(result)) {
    result = result.replace(initPattern, '');
    modified = true;
  }

  // Pattern 5: Catch any remaining sa5.push calls that might not be in script tags
  const standalonePattern = /window\.sa5\.push\(\[['"]getMembership(?:Routing)?Config['"][\s\S]*?}\)\];?/gi;
  if (standalonePattern.test(result)) {
    result = result.replace(standalonePattern, '');
    modified = true;
  }

  // Clean up empty script tags (multiple variations)
  result = result.replace(/<script>\s*<\/script>/gi, '');
  result = result.replace(/<script>\n\s*<\/script>/gi, '');
  result = result.replace(/<script>\s*\n\s*<\/script>/gi, '');
  result = result.replace(/<script>\s*\n\s*\n\s*<\/script>/gi, '');
  result = result.replace(/<script>\s*[\s\n]*<\/script>/gi, '');

  // Clean up multiple blank lines (4 or more consecutive newlines -> 2)
  result = result.replace(/\n{4,}/g, '\n\n');

  // Clean up trailing whitespace before closing tags
  result = result.replace(/\s+\n\s*<\/script>/g, '\n</script>');
  result = result.replace(/\s+\n\s*<\/head>/g, '\n</head>');
  result = result.replace(/\s+\n\s*<\/body>/g, '\n</body>');

  modified = modified || result.length !== originalLength;
  return { content: result, modified };
}

// Main execution
const htmlFiles = getAllHtmlFiles(projectRoot);
console.log(`Found ${htmlFiles.length} HTML files to process...\n`);

let processedCount = 0;
let skippedCount = 0;
const errors = [];

htmlFiles.forEach(file => {
  try {
    const content = fs.readFileSync(file, 'utf8');
    const { content: newContent, modified } = removeSa5References(content);

    if (modified) {
      fs.writeFileSync(file, newContent, 'utf8');
      processedCount++;
      console.log(`✓ Processed: ${path.relative(projectRoot, file)}`);
    } else {
      skippedCount++;
    }
  } catch (error) {
    errors.push({ file, error: error.message });
    console.error(`✗ Error processing ${path.relative(projectRoot, file)}: ${error.message}`);
  }
});

console.log(`\n${'='.repeat(60)}`);
console.log(`Summary:`);
console.log(`  Processed: ${processedCount} files`);
console.log(`  Skipped (no changes): ${skippedCount} files`);
console.log(`  Errors: ${errors.length} files`);

if (errors.length > 0) {
  console.log(`\nErrors:`);
  errors.forEach(({ file, error }) => {
    console.log(`  - ${path.relative(projectRoot, file)}: ${error}`);
  });
}

console.log(`\nCompleted!`);
