#!/usr/bin/env node

/**
 * Remove Duplicate Requests
 * 
 * This script identifies and removes duplicate requests from the database.
 * Duplicates are identified by:
 * - Same name AND same email (from metadata or user)
 * 
 * The oldest record is kept, newer duplicates are deleted.
 */

import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

/**
 * Get email from request (from metadata or user)
 */
function getEmail(request) {
  if (request.user?.email) {
    return request.user.email.toLowerCase().trim();
  }
  if (request.metadata?.studentInfo?.email) {
    return request.metadata.studentInfo.email.toLowerCase().trim();
  }
  if (request.metadata?.email) {
    return request.metadata.email.toLowerCase().trim();
  }
  return null;
}

/**
 * Get name from request (from metadata or user)
 */
function getName(request) {
  // Try user name first
  if (request.user?.name) {
    return request.user.name.toLowerCase().trim();
  }
  
  // Try metadata studentInfo
  if (request.metadata?.studentInfo) {
    const s = request.metadata.studentInfo;
    const nameParts = [s.firstName, s.middleName, s.lastName]
      .filter(Boolean)
      .map(part => part?.toLowerCase().trim())
      .filter(Boolean);
    
    if (nameParts.length > 0) {
      return nameParts.join(' ').trim();
    }
  }
  
  // Try metadata name
  if (request.metadata?.name) {
    return request.metadata.name.toLowerCase().trim();
  }
  
  return null;
}

/**
 * Normalize name for comparison (remove extra spaces, handle variations)
 */
function normalizeName(name) {
  if (!name) return null;
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[^\w\s]/g, '') // Remove special characters
    .trim();
}

async function removeDuplicates() {
  console.log('🔍 Finding duplicate requests by name and email...\n');

  try {
    // Fetch all requests with user data
    const requests = await prisma.request.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc', // Process oldest first
      },
    });

    console.log(`📊 Total requests in database: ${requests.length}\n`);

    // Group by name + email
    const nameEmailGroups = new Map();

    requests.forEach((request) => {
      const email = getEmail(request);
      const name = getName(request);
      const normalizedName = normalizeName(name);
      
      // Only process if we have both name and email
      if (email && normalizedName) {
        const key = `${normalizedName}::${email}`;
        
        if (!nameEmailGroups.has(key)) {
          nameEmailGroups.set(key, []);
        }
        nameEmailGroups.get(key).push(request);
      }
    });

    // Find duplicates (groups with more than 1 request)
    const duplicateGroups = Array.from(nameEmailGroups.values())
      .filter(group => group.length > 1);

    console.log(`📋 Found ${duplicateGroups.length} duplicate groups (same name + email)\n`);

    // Collect IDs to delete (keep the oldest in each group)
    const idsToDelete = new Set();
    let totalDuplicates = 0;

    // Process duplicates
    duplicateGroups.forEach((group) => {
      // Sort by createdAt (oldest first)
      group.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      
      // Keep the first (oldest), mark others for deletion
      for (let i = 1; i < group.length; i++) {
        idsToDelete.add(group[i].id);
        totalDuplicates++;
      }
    });

    console.log(`🗑️  Found ${totalDuplicates} duplicate requests to delete\n`);

    if (idsToDelete.size === 0) {
      console.log('✅ No duplicates found. Database is clean!');
      return;
    }

    // Show sample of what will be deleted
    const sampleIds = Array.from(idsToDelete).slice(0, 10);
    const sampleRequests = await prisma.request.findMany({
      where: { id: { in: sampleIds } },
      include: { user: { select: { email: true, name: true } } },
    });

    console.log('📝 Sample duplicates to be deleted:');
    sampleRequests.forEach((req) => {
      const email = getEmail(req);
      const name = getName(req);
      console.log(`   - ID: ${req.id.substring(0, 8)}..., Name: ${name || 'N/A'}, Email: ${email || 'N/A'}, Type: ${req.type}, Created: ${new Date(req.createdAt).toLocaleString()}`);
    });
    console.log('');

    // Delete duplicates
    console.log('🗑️  Deleting duplicate requests...');
    const deleteResult = await prisma.request.deleteMany({
      where: {
        id: { in: Array.from(idsToDelete) },
      },
    });

    console.log(`✅ Successfully deleted ${deleteResult.count} duplicate requests\n`);

    // Verify final count
    const finalCount = await prisma.request.count();
    console.log(`📊 Final request count: ${finalCount}`);

  } catch (error) {
    console.error('❌ Error removing duplicates:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
removeDuplicates()
  .then(() => {
    console.log('\n✅ Duplicate removal completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Duplicate removal failed:', error);
    process.exit(1);
  });
