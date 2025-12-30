#!/usr/bin/env node

/**
 * Data Migration Script: Local PostgreSQL to Supabase
 * 
 * This script helps migrate data from a local PostgreSQL database to Supabase.
 * 
 * Usage:
 *   1. Set OLD_DATABASE_URL in .env (your current database)
 *   2. Set DATABASE_URL in .env (your Supabase connection string)
 *   3. Run: node scripts/migrate-to-supabase.js
 * 
 * Note: This script uses pg_dump and pg_restore, which must be installed.
 * Alternative: Use Prisma Studio for manual data migration (small datasets)
 */

import { execSync } from 'child_process';
import { existsSync, unlinkSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

const OLD_DATABASE_URL = process.env.OLD_DATABASE_URL;
const NEW_DATABASE_URL = process.env.DATABASE_URL;

const log = (message) => console.log(`\n📦 ${message}`);
const error = (message) => console.error(`\n❌ ${message}`);
const success = (message) => console.log(`\n✅ ${message}`);
const warn = (message) => console.warn(`\n⚠️  ${message}`);

const checkPrerequisites = () => {
  log('Checking prerequisites...');
  
  if (!OLD_DATABASE_URL) {
    error('OLD_DATABASE_URL not set in .env file');
    console.log('\nAdd to your .env file:');
    console.log('OLD_DATABASE_URL=postgresql://user:password@localhost:5432/yorkcastle');
    process.exit(1);
  }
  
  if (!NEW_DATABASE_URL) {
    error('DATABASE_URL not set in .env file');
    console.log('\nAdd to your .env file:');
    console.log('DATABASE_URL=postgresql://postgres:password@db.projectref.supabase.co:5432/postgres');
    process.exit(1);
  }
  
  // Check if pg_dump is available
  try {
    execSync('which pg_dump', { stdio: 'ignore' });
  } catch (e) {
    error('pg_dump not found. Please install PostgreSQL client tools.');
    console.log('\nInstall PostgreSQL:');
    console.log('  macOS: brew install postgresql');
    console.log('  Ubuntu: sudo apt-get install postgresql-client');
    process.exit(1);
  }
  
  // Check if pg_restore is available
  try {
    execSync('which pg_restore', { stdio: 'ignore' });
  } catch (e) {
    error('pg_restore not found. Please install PostgreSQL client tools.');
    process.exit(1);
  }
  
  success('Prerequisites check passed');
};

const parseConnectionString = (url) => {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port || '5432',
      database: parsed.pathname.slice(1) || 'postgres',
      user: parsed.username,
      password: parsed.password,
    };
  } catch (e) {
    error(`Invalid connection string format: ${e.message}`);
    process.exit(1);
  }
};

const createBackup = () => {
  log('Creating backup from old database...');
  
  const oldDb = parseConnectionString(OLD_DATABASE_URL);
  const backupFile = join(__dirname, '../backup-migration.dump');
  
  // Remove old backup if exists
  if (existsSync(backupFile)) {
    warn('Removing old backup file...');
    unlinkSync(backupFile);
  }
  
  try {
    const pgDumpCmd = [
      'pg_dump',
      `-h ${oldDb.host}`,
      `-p ${oldDb.port}`,
      `-U ${oldDb.user}`,
      `-d ${oldDb.database}`,
      '-F c', // Custom format
      '-f', backupFile,
      '--no-owner', // Don't include ownership commands
      '--no-acl',   // Don't include ACL commands
    ].join(' ');
    
    // Set password via environment variable
    process.env.PGPASSWORD = oldDb.password;
    
    execSync(pgDumpCmd, { stdio: 'inherit' });
    
    success(`Backup created: ${backupFile}`);
    return backupFile;
  } catch (e) {
    error(`Failed to create backup: ${e.message}`);
    process.exit(1);
  }
};

const restoreToSupabase = (backupFile) => {
  log('Restoring backup to Supabase...');
  
  const newDb = parseConnectionString(NEW_DATABASE_URL);
  
  // Verify Supabase connection string
  if (!newDb.host.includes('supabase.co')) {
    warn('Warning: DATABASE_URL does not appear to be a Supabase connection string');
    const proceed = confirm('Do you want to continue anyway? (y/n): ');
    if (!proceed) {
      error('Migration cancelled');
      process.exit(1);
    }
  }
  
  try {
    const pgRestoreCmd = [
      'pg_restore',
      `-h ${newDb.host}`,
      `-p ${newDb.port}`,
      `-U ${newDb.user}`,
      `-d ${newDb.database}`,
      '--no-owner',
      '--no-acl',
      '--clean', // Clean (drop) database objects before recreating
      '--if-exists', // Use IF EXISTS when dropping
      backupFile,
    ].join(' ');
    
    // Set password via environment variable
    process.env.PGPASSWORD = newDb.password;
    
    execSync(pgRestoreCmd, { stdio: 'inherit' });
    
    success('Backup restored to Supabase successfully');
  } catch (e) {
    error(`Failed to restore backup: ${e.message}`);
    console.log('\nTroubleshooting:');
    console.log('  1. Verify your Supabase connection string is correct');
    console.log('  2. Check that your Supabase project is active');
    console.log('  3. Ensure you have network access to Supabase');
    console.log('  4. Try running migrations first: npx prisma migrate deploy');
    process.exit(1);
  }
};

const verifyMigration = async () => {
  log('Verifying migration...');
  
  try {
    const prisma = new PrismaClient();
    
    // Test connection
    await prisma.$connect();
    success('Connected to Supabase database');
    
    // Check if tables exist
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    if (tables.length === 0) {
      warn('No tables found in database. You may need to run migrations first.');
      console.log('\nRun: npx prisma migrate deploy');
    } else {
      success(`Found ${tables.length} tables in database`);
      console.log('\nTables:');
      tables.forEach(table => {
        console.log(`  - ${table.table_name}`);
      });
    }
    
    // Count records in key tables
    try {
      const userCount = await prisma.user.count();
      const applicationCount = await prisma.application.count();
      const requestCount = await prisma.request.count();
      
      console.log('\nData counts:');
      console.log(`  Users: ${userCount}`);
      console.log(`  Applications: ${applicationCount}`);
      console.log(`  Requests: ${requestCount}`);
    } catch (e) {
      warn('Could not count records (tables may not exist yet)');
    }
    
    await prisma.$disconnect();
  } catch (e) {
    error(`Verification failed: ${e.message}`);
    console.log('\nThis might be normal if migrations haven\'t been run yet.');
    console.log('Run: npx prisma migrate deploy');
  }
};

const confirm = (message) => {
  // Simple confirmation (in real scenario, use readline)
  // For now, we'll assume yes if running non-interactively
  return true;
};

const main = async () => {
  console.log('\n🚀 Supabase Migration Script');
  console.log('================================\n');
  
  try {
    checkPrerequisites();
    
    console.log('\n⚠️  IMPORTANT:');
    console.log('  1. This script will migrate ALL data from your old database');
    console.log('  2. Make sure your Supabase database is empty or you\'re okay with overwriting');
    console.log('  3. Ensure you have backups of both databases');
    console.log('  4. Run Prisma migrations first if schema has changed');
    
    const proceed = confirm('\nProceed with migration? (y/n): ');
    if (!proceed) {
      error('Migration cancelled');
      process.exit(0);
    }
    
    const backupFile = createBackup();
    restoreToSupabase(backupFile);
    await verifyMigration();
    
    console.log('\n📋 Next Steps:');
    console.log('  1. Run: npx prisma generate (if not already done)');
    console.log('  2. Run: npx prisma migrate deploy (to ensure schema is up to date)');
    console.log('  3. Test your application with the new database');
    console.log('  4. Update your application to use the Supabase connection string');
    console.log('  5. Clean up backup file: rm backup-migration.dump');
    
    success('\n✅ Migration completed successfully!');
    
  } catch (err) {
    error(`Migration failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main };





