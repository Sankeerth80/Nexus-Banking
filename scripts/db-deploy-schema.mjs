import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const { Pool } = pg;

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is missing.');
    process.exit(1);
  }

  console.log('Connecting to Neon PostgreSQL database...');
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });

  try {
    // Check if the Customer table exists
    const checkTableResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Customer'
      );
    `);

    const tableExists = checkTableResult.rows[0]?.exists;

    if (!tableExists) {
      console.log('Database tables do not exist. Initializing database from migration.sql...');
      const migrationSqlPath = resolve('database/prisma/migrations/20260617133000_init/migration.sql');
      const migrationSql = readFileSync(migrationSqlPath, 'utf8');

      // Run migration SQL statements (split by semicolon, filtering out empty ones)
      // Note: we can run the file as a single transaction or multiple commands
      await pool.query(migrationSql);
      console.log('Migration SQL executed successfully.');
    } else {
      console.log('Database tables already exist. Skipping full migration initialization.');
    }

    // Add security and auth columns to Customer table if they do not exist
    console.log('Verifying and adding auth columns to Customer table...');
    await pool.query(`
      ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
      ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "twoFactorSecret" TEXT;
      ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN DEFAULT false;
      ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN DEFAULT false;
    `);

    // Add security and auth columns to Employee table if they do not exist
    console.log('Verifying and adding auth columns to Employee table...');
    await pool.query(`
      ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
      ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "twoFactorSecret" TEXT;
      ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" BOOLEAN DEFAULT false;
      ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN DEFAULT false;
    `);

    // Add customerId relation to AuditLog table if they do not exist
    console.log('Verifying and adding customerId to AuditLog table...');
    await pool.query(`
      ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
    `);
    try {
      await pool.query(`
        ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_customerId_fkey" 
        FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      `);
    } catch (err) {
      // ignore
    }

    // Verify and update CustomerStatus enum
    console.log('Verifying and updating CustomerStatus enum...');
    try {
      await pool.query(`ALTER TYPE "CustomerStatus" ADD VALUE 'PENDING';`);
    } catch (err) {
      // ignore
    }
    try {
      await pool.query(`ALTER TYPE "CustomerStatus" ADD VALUE 'FROZEN';`);
    } catch (err) {
      // ignore
    }

    // Verify and create KycRequest table
    console.log('Verifying and creating KycRequest table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "KycRequest" (
        "id" TEXT NOT NULL,
        "customerId" TEXT NOT NULL,
        "idType" TEXT NOT NULL,
        "idNumber" TEXT NOT NULL,
        "idDocUrl" TEXT,
        "photoUrl" TEXT,
        "signatureUrl" TEXT,
        "documentStatus" TEXT NOT NULL DEFAULT 'PENDING',
        "documentComment" TEXT,
        "documentReviewedBy" TEXT,
        "riskStatus" TEXT NOT NULL DEFAULT 'PENDING',
        "riskComment" TEXT,
        "riskReviewedBy" TEXT,
        "complianceStatus" TEXT NOT NULL DEFAULT 'PENDING',
        "complianceComment" TEXT,
        "complianceReviewedBy" TEXT,
        "branchStatus" TEXT NOT NULL DEFAULT 'PENDING',
        "branchComment" TEXT,
        "branchApprovedBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "KycRequest_pkey" PRIMARY KEY ("id")
      );
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "KycRequest_customerId_key" ON "KycRequest"("customerId");
    `);
    try {
      await pool.query(`
        ALTER TABLE "KycRequest" ADD CONSTRAINT "KycRequest_customerId_fkey" 
        FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `);
    } catch (err) {
      // ignore
    }

    console.log('Database schema successfully deployed and updated!');
  } catch (error) {
    console.error('Database deployment failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
