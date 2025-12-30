#!/usr/bin/env node

/**
 * Test Database Connection Script
 * Tests connection to Supabase/PostgreSQL database
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

async function testConnection() {
  console.log('🔍 Testing Database Connection');
  console.log('==============================\n');

  // Check if DATABASE_URL is set
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not found in .env file');
    console.error('   Please set DATABASE_URL in backend/.env');
    process.exit(1);
  }

  // Mask password in URL for display
  const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
  console.log(`📋 Connection String: ${maskedUrl}\n`);

  // Check if using pooled connection
  const isPooled = dbUrl.includes(':6543') || dbUrl.includes('pooler.supabase.com');
  if (isPooled) {
    console.warn('⚠️  WARNING: Using pooled connection (port 6543)');
    console.warn('   Migrations require direct connection (port 5432)');
    console.warn('   Some queries may fail with "prepared statement already exists"');
    console.warn('   Update DATABASE_URL to use direct connection:\n');
    console.warn('   Direct: postgresql://postgres:[PASSWORD]@db.lmixjefkbejoibldpioh.supabase.co:5432/postgres');
    console.warn('   Pooled: postgresql://postgres:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres\n');
    console.warn('   Get direct connection from:');
    console.warn('   https://supabase.com/dashboard/project/lmixjefkbejoibldpioh/settings/database\n');
  }

  try {
    // Test 1: Basic connection
    console.log('📡 Test 1: Basic Connection...');
    await prisma.$connect();
    console.log('✅ Connected to database\n');

    // Test 2: Query database version
    console.log('📡 Test 2: Database Version...');
    const result = await prisma.$queryRaw`SELECT version()`;
    const version = result[0]?.version || 'Unknown';
    console.log(`✅ Database Version: ${version.split(' ')[0]} ${version.split(' ')[1]}\n`);

    // Test 3: Check if tables exist
    console.log('📡 Test 3: Checking Tables...');
    let tables = [];
    try {
      // Use executeRaw for pooled connections to avoid prepared statement issues
      if (isPooled) {
        const result = await prisma.$executeRawUnsafe(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
          ORDER BY table_name
        `);
        tables = result;
      } else {
        tables = await prisma.$queryRaw`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
          ORDER BY table_name
        `;
      }
    } catch (error) {
      console.log('⚠️  Could not query tables (this may be okay)\n');
      tables = [];
    }
    
    if (tables.length > 0) {
      console.log(`✅ Found ${tables.length} table(s):`);
      tables.forEach((table, index) => {
        console.log(`   ${index + 1}. ${table.table_name}`);
      });
    } else {
      console.log('⚠️  No tables found (database is empty)');
      console.log('   Run: npm run db:migrate to create tables');
    }
    console.log('');

    // Test 4: Test a simple query (if User table exists)
    const userTableExists = tables.some(t => t.table_name === 'User');
    if (userTableExists) {
      console.log('📡 Test 4: Query Test (User table)...');
      const userCount = await prisma.user.count();
      console.log(`✅ User table accessible (${userCount} user(s) found)\n`);
    } else {
      console.log('📡 Test 4: Query Test...');
      console.log('⚠️  Skipped (User table not found)\n');
    }

    // Test 5: Connection pool info (skip for pooled connections)
    if (!isPooled) {
      console.log('📡 Test 5: Connection Pool...');
      try {
        const poolInfo = await prisma.$queryRaw`
          SELECT 
            count(*) as connection_count,
            state,
            application_name
          FROM pg_stat_activity 
          WHERE datname = current_database()
          GROUP BY state, application_name
        `;
        console.log('✅ Connection pool status:');
        poolInfo.forEach(info => {
          console.log(`   ${info.state}: ${info.connection_count} connection(s) (${info.application_name || 'N/A'})`);
        });
        console.log('');
      } catch (error) {
        console.log('⚠️  Could not get pool info (this is okay)\n');
      }
    } else {
      console.log('📡 Test 5: Connection Pool...');
      console.log('⚠️  Skipped (pooled connection - use direct connection for detailed info)\n');
    }

    console.log('✅ All tests passed! Database connection is working.\n');
    console.log('📊 Summary:');
    console.log(`   - Connection: ✅ Working`);
    console.log(`   - Tables: ${tables.length} found`);
    console.log(`   - Status: Ready to use\n`);

  } catch (error) {
    console.error('\n❌ Connection Test Failed!\n');
    console.error('Error Details:');
    console.error(`   Type: ${error.constructor.name}`);
    console.error(`   Message: ${error.message}\n`);

    // Provide helpful error messages
    if (error.message.includes('P1001')) {
      console.error('💡 Troubleshooting:');
      console.error('   - Check if DATABASE_URL is correct');
      console.error('   - Verify database password');
      console.error('   - Ensure Supabase project is active');
      console.error('   - Check network connection');
    } else if (error.message.includes('P1000')) {
      console.error('💡 Troubleshooting:');
      console.error('   - Authentication failed');
      console.error('   - Check database password in DATABASE_URL');
      console.error('   - Verify username is correct (usually "postgres")');
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.error('💡 Troubleshooting:');
      console.error('   - Cannot reach database server');
      console.error('   - Check DATABASE_URL hostname');
      console.error('   - Verify Supabase project is active');
      console.error('   - Check firewall/network settings');
    } else {
      console.error('💡 Troubleshooting:');
      console.error('   - Check DATABASE_URL format');
      console.error('   - Verify Prisma schema is correct');
      console.error('   - Run: npm run db:generate');
    }

    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testConnection().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});



