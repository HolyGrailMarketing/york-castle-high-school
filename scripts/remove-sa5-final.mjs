#!/usr/bin/env node

/**
 * Final script to remove all sa5.push references from HTML files
 * Uses a simple line-by-line approach for reliability
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
    }
  });
  
  return fileList;
}

// Remove sa5 references using line-by-line processing
function removeSa5References(content) {
  const lines = content.split('\n');
  const newLines = [];
  let inSa5Script = false;
  let sa5ScriptStarted = false;
  let braceCount = 0;
  let parenCount = 0;
  let skipUntilScriptClose = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this line starts a script with sa5.push
    if (line.includes('<script>') && !inSa5Script) {
      // Look ahead to see if next non-empty line has sa5.push
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (lines[j].trim() && lines[j].includes('window.sa5.push')) {
          inSa5Script = true;
          sa5ScriptStarted = true;
          skipUntilScriptClose = true;
          break;
        }
      }
    }
    
    // Check if this line contains sa5.push (might be on same line as script tag)
    if (line.includes('window.sa5.push') && !inSa5Script) {
      inSa5Script = true;
      sa5ScriptStarted = true;
      skipUntilScriptClose = true;
    }
    
    // Skip comments related to Sygnal Attributes
    if (line.includes('Sygnal Attributes 5') || line.includes('Sygnal Attributes')) {
      continue;
    }
    
    // Skip lines that are part of sa5 script block
    if (inSa5Script) {
      // Count braces and parentheses to find the end
      if (line.includes('{')) braceCount += (line.match(/{/g) || []).length;
      if (line.includes('}')) braceCount -= (line.match(/}/g) || []).length;
      if (line.includes('(')) parenCount += (line.match(/\(/g) || []).length;
      if (line.includes(')')) parenCount -= (line.match(/\)/g) || []).length;
      
      // Check if we've reached the closing script tag
      if (line.includes('</script>') && skipUntilScriptClose) {
        // Reset counters and flags
        inSa5Script = false;
        sa5ScriptStarted = false;
        skipUntilScriptClose = false;
        braceCount = 0;
        parenCount = 0;
        continue; // Skip the closing script tag
      }
      
      // If we're inside a sa5 script but haven't found closing tag yet, skip the line
      if (skipUntilScriptClose) {
        continue;
      }
      
      // If brace/paren counts are balanced and we see a semicolon or closing paren, might be end
      if (sa5ScriptStarted && braceCount === 0 && parenCount === 0 && 
          (line.includes(';') || line.includes('})]'))) {
        // Check if next non-empty line is </script>
        for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
          if (lines[j].trim()) {
            if (lines[j].includes('</script>')) {
              // We'll skip the next few lines including the closing script tag
              skipUntilScriptClose = true;
            }
            break;
          }
        }
      }
      continue;
    }
    
    // Check for standalone window.sa5 initialization
    if (line.includes('window.sa5 = window.sa5 || []')) {
      continue; // Skip this line
    }
    
    // Keep the line if it's not part of sa5 script
    newLines.push(line);
  }
  
  // Clean up multiple consecutive blank lines
  const cleaned = newLines.join('\n')
    .replace(/\n{4,}/g, '\n\n\n')  // Max 3 consecutive newlines
    .replace(/<script>\s*<\/script>/gi, '')  // Empty script tags
    .replace(/<script>\s*\n\s*<\/script>/gi, '')  // Empty script tags with newlines
    .trim();
  
  return cleaned;
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
    
    // Only process if file contains sa5 references
    if (!content.includes('window.sa5.push') && !content.includes('Sygnal Attributes')) {
      skippedCount++;
      return;
    }
    
    const newContent = removeSa5References(content);
    
    if (newContent !== content) {
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
