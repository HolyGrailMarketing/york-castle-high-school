/**
 * Production Migration Script
 * 
 * Safely runs database migrations in production
 * - Creates backup before migration
 * - Validates environment
 * - Provides rollback instructions
 * 
 * Usage:
 *   NODE_ENV=production node scripts/migrate-production.js
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '../');

const prisma = new PrismaClient();

const log = (message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
};

const error = (message) => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR: ${message}`);
};

const validateEnvironment = () => {
  if (process.env.NODE_ENV !== 'production') {
    error('This script should only be run in production environment');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    error('DATABASE_URL is not set');
    process.exit(1);
  }

  log('Environment validation passed');
};

const createBackup = async () => {
  log('Creating database backup...');
  
  const backupDir = path.join(projectRoot, 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `backup-${timestamp}.sql`);

  try {
    // Extract connection details from DATABASE_URL
    const dbUrl = new URL(process.env.DATABASE_URL);
    const dbName = dbUrl.pathname.slice(1);
    const dbHost = dbUrl.hostname;
    const dbPort = dbUrl.port || 5432;
    const dbUser = dbUrl.username;
    const dbPass = dbUrl.password;

    // Create pg_dump command
    const pgDumpCmd = `PGPASSWORD="${dbPass}" pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -F c -f "${backupFile}"`;

    execSync(pgDumpCmd, { stdio: 'inherit' });
    
    log(`Backup created: ${backupFile}`);
    return backupFile;
  } catch (err) {
    error(`Backup failed: ${err.message}`);
    log('Continuing without backup (not recommended for production)');
    return null;
  }
};

const runMigrations = async () => {
  log('Running database migrations...');
  
  try {
    // Use Prisma migrate deploy for production (no prompt)
    execSync('npx prisma migrate deploy', {
      cwd: projectRoot,
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' },
    });
    
    log('Migrations completed successfully');
  } catch (err) {
    error(`Migration failed: ${err.message}`);
    throw err;
  }
};

const verifyMigration = async () => {
  log('Verifying migration...');
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    log('Database connection verified');
    
    // Check migration status
    const migrations = await prisma.$queryRaw`
      SELECT * FROM "_prisma_migrations" 
      ORDER BY finished_at DESC 
      LIMIT 5
    `;
    
    log(`Latest migrations: ${migrations.length} found`);
  } catch (err) {
    error(`Verification failed: ${err.message}`);
    throw err;
  }
};

const main = async () => {
  try {
    log('Starting production migration process...');
    
    validateEnvironment();
    
    const backupFile = await createBackup();
    
    if (backupFile) {
      log(`\n⚠️  IMPORTANT: Backup saved to ${backupFile}`);
      log('If migration fails, restore using:');
      log(`  PGPASSWORD="<password>" pg_restore -h <host> -p <port> -U <user> -d <database> "${backupFile}"\n`);
    }
    
    await runMigrations();
    await verifyMigration();
    
    log('\n✅ Migration completed successfully!');
    log('Next steps:');
    log('  1. Restart your application server');
    log('  2. Monitor logs for any issues');
    log('  3. Test critical functionality');
    
  } catch (err) {
    error(`Migration process failed: ${err.message}`);
    log('\n❌ Migration failed!');
    log('If you created a backup, restore it before trying again.');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

main();





