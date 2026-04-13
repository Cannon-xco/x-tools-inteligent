/**
 * Test setup hooks for integration tests
 * Uses same DATABASE_URL as the running dev server
 */
import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { Pool } from 'pg';

// Use same DATABASE_URL as dev server
const getDbUrl = () => process.env.DATABASE_URL || 
  'postgresql://xtools:xtools_password@localhost:5432/xtools';

let pool: Pool | null = null;

export async function getTestPool(): Promise<Pool> {
  if (!pool) {
    pool = new Pool({ connectionString: getDbUrl() });
  }
  return pool;
}

export async function initTestDatabase(): Promise<void> {
  // Schema already exists from dev setup
  // Just verify connection
  const p = await getTestPool();
  await p.query('SELECT 1');
}

export async function cleanTestDatabase(): Promise<void> {
  const p = await getTestPool();
  
  try {
    await p.query(`
      TRUNCATE TABLE deep_enrichment_jobs CASCADE;
      TRUNCATE TABLE enrichment_queue CASCADE;
      TRUNCATE TABLE leads CASCADE;
    `);
  } catch (e) {
    // Tables might not exist in test DB
    console.log('Tables might not exist yet');
  }
}

export async function closeTestPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// Global setup - no automatic init since tests run against live dev server DB
beforeAll(async () => {
  console.log('Integration tests will use DATABASE_URL:', getDbUrl().replace(/:[^:]+@/, ':***@'));
}, 30000);

afterEach(async () => {
  // Optionally clean - uncomment if you want to clean after each test
  // await cleanTestDatabase();
}, 10000);

afterAll(async () => {
  await closeTestPool();
}, 10000);
