#!/usr/bin/env node

/**
 * Import General Request Form CSV to Database
 * 
 * This script imports request data from a CSV file into the Request table.
 * Additional data is stored in the metadata JSON field.
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

/**
 * Parse CSV line handling quoted fields
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Parse date string in various formats
 */
function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '' || dateStr === 'N/A') {
    return null;
  }
  
  // Remove quotes and clean
  dateStr = dateStr.replace(/^"|"$/g, '').trim();
  
  // Handle dates with time (e.g., "01/08/2026 6:29:50 am")
  const timeMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(am|pm)?/i);
  if (timeMatch) {
    const [, month, day, year, hour, minute, second, ampm] = timeMatch;
    let h = parseInt(hour);
    if (ampm) {
      if (ampm.toLowerCase() === 'pm' && h !== 12) h += 12;
      if (ampm.toLowerCase() === 'am' && h === 12) h = 0;
    }
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${h.toString().padStart(2, '0')}:${minute}:${second}`);
  }
  
  // Try different date formats
  const formats = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})/, // MM/DD/YYYY
    /^(\d{1,2})-(\d{1,2})-(\d{4})/,   // MM-DD-YYYY
    /^(\d{4})-(\d{1,2})-(\d{1,2})/,   // YYYY-MM-DD
  ];
  
  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      if (format === formats[2]) {
        // YYYY-MM-DD
        return new Date(match[0]);
      } else {
        // MM/DD/YYYY or MM-DD-YYYY
        const [, month, day, year] = match;
        return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      }
    }
  }
  
  // Try direct Date parsing
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  
  return null;
}

/**
 * Map CSV request type to database RequestType
 */
function mapRequestType(csvType) {
  const typeMap = {
    'Transcript': 'DOCUMENT',
    'School Leaving Certificate': 'DOCUMENT',
    'Recommendation': 'DOCUMENT',
    'Progress Report': 'DOCUMENT',
    'Academic Status Letter': 'DOCUMENT',
    'Embassy Letter': 'DOCUMENT',
  };
  
  return typeMap[csvType] || 'GENERAL';
}

/**
 * Clean phone number
 */
function cleanPhone(phone) {
  if (!phone) return null;
  return phone.toString().replace(/[^\d+()-]/g, '').trim() || null;
}

/**
 * Import CSV file
 */
async function importCSV(filePath) {
  console.log('📥 Importing requests from CSV...\n');
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }
  
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    console.error('❌ CSV file is empty or has no data rows');
    process.exit(1);
  }
  
  // Parse header
  const headers = parseCSVLine(lines[0]);
  console.log(`📋 Found ${headers.length} columns`);
  console.log(`📊 Found ${lines.length - 1} data rows\n`);
  
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  
  // Process each row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    try {
      const values = parseCSVLine(line);
      
      // Create a map of column name to value
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      
      // Skip if essential fields are missing
      if (!row['First Name'] || !row['Last Name'] || !row['Request Type']) {
        skipped++;
        continue;
      }
      
      // Extract and map data
      const requestType = mapRequestType(row['Request Type']);
      const firstName = row['First Name'].replace(/^"|"$/g, '').trim();
      const middleName = row['Middle Name']?.replace(/^"|"$/g, '').trim() || null;
      const lastName = row['Last Name'].replace(/^"|"$/g, '').trim();
      const email = row['Email']?.replace(/^"|"$/g, '').trim() || null;
      const phone = cleanPhone(row['Phone Number']);
      
      // Create title
      const title = `${row['Request Type']} Request - ${firstName} ${lastName}`;
      
      // Create description
      const description = `Request for ${row['Request Type']}${row['Delivery Method'] ? ` via ${row['Delivery Method']}` : ''}${row['Number of Copies'] ? ` (${row['Number of Copies']} copy/copies)` : ''}`;
      
      // Build metadata object with all CSV data
      const metadata = {
        // Student information
        studentInfo: {
          firstName,
          middleName,
          lastName,
          dateOfBirth: row['Date of Birth'] ? parseDate(row['Date of Birth'])?.toISOString() : null,
          dateOfGraduation: row['Date of Graduation'] || null,
          email,
          phone,
          address: {
            street: row['Street Address']?.replace(/^"|"$/g, '') || null,
            town: row['Town']?.replace(/^"|"$/g, '') || null,
            parish: row['Parish']?.replace(/^"|"$/g, '') || null,
          },
        },
        // Request details
        requestDetails: {
          requestType: row['Request Type'],
          deliveryMethod: row['Delivery Method'] || null,
          numberOfCopies: row['Number of Copies'] || null,
          numberOfCopies2: row['Number Of Copies 2'] || null,
        },
        // Recipient information
        recipient: {
          name: row["Recipient's Name"]?.replace(/^"|"$/g, '') || null,
          address: row["Recipient's Address"]?.replace(/^"|"$/g, '') || null,
          phone: cleanPhone(row["Recipient's Number"]),
          fax: row["Recipient's Fax"]?.replace(/^"|"$/g, '') || null,
          email: row["Recipient's Email"]?.replace(/^"|"$/g, '') || null,
        },
        // Additional metadata
        submissionInfo: {
          submissionDate: row['Date'] ? parseDate(row['Date'])?.toISOString() : null,
          ipAddress: row['IP Address'] || null,
        },
      };
      
      // Try to find or create user if email exists
      let userId = null;
      if (email) {
        try {
          const user = await prisma.user.findUnique({
            where: { email },
          });
          if (user) {
            userId = user.id;
          }
        } catch (err) {
          // User doesn't exist, that's okay - request can be created without user
        }
      }
      
      // Create request
      const request = await prisma.request.create({
        data: {
          type: requestType,
          title,
          description,
          status: 'PENDING',
          userId,
          metadata,
          createdAt: (() => {
            const parsed = row['Date'] ? parseDate(row['Date']) : null;
            // If date parsing fails, use current date or a default date
            return parsed || new Date();
          })(),
        },
      });
      
      imported++;
      
      if (imported % 50 === 0) {
        console.log(`  ✓ Imported ${imported} requests...`);
      }
      
    } catch (error) {
      errors++;
      // Only log first few errors to avoid spam
      if (errors <= 5) {
        console.error(`  ❌ Error on row ${i + 1}: ${error.message}`);
      }
      // Continue processing even with errors
    }
  }
  
  console.log('\n✅ Import completed!');
  console.log(`   - Imported: ${imported}`);
  console.log(`   - Skipped: ${skipped}`);
  console.log(`   - Errors: ${errors}\n`);
}

// Main execution
const csvFilePath = process.argv[2] || '/Users/dannielfrancis/Downloads/general-request-form-2026-01-08.csv';

importCSV(csvFilePath)
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('❌ Import failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
