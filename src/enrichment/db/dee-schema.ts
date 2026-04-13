// ============================================================
// DEE DATABASE SCHEMA
// Deep Enrichment Engine (DEE) - Database Migration
// Extends leads table and creates enrichment_audit table
// ============================================================

import { getPool } from '@/lib/db/client';

/**
 * Initialize DEE database schema.
 * Adds new columns to leads table and creates enrichment_audit table.
 * Safe to run multiple times (idempotent).
 */
export async function initDeeSchema(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Add new columns to leads table (idempotent with IF NOT EXISTS)
    await client.query(`
      ALTER TABLE leads
      ADD COLUMN IF NOT EXISTS deep_enrichment_json TEXT,
      ADD COLUMN IF NOT EXISTS verified_emails TEXT,
      ADD COLUMN IF NOT EXISTS verified_phones TEXT,
      ADD COLUMN IF NOT EXISTS verified_socials TEXT,
      ADD COLUMN IF NOT EXISTS confidence_scores TEXT,
      ADD COLUMN IF NOT EXISTS deep_enriched_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS enrichment_status TEXT;
    `);

    // Create enrichment_audit table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS enrichment_audit (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        field_name TEXT NOT NULL,
        value TEXT NOT NULL,
        source TEXT NOT NULL,
        confidence REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        raw_snippet TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create indexes for enrichment_audit table (idempotent)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_lead_id ON enrichment_audit(lead_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_field ON enrichment_audit(field_name);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_confidence ON enrichment_audit(confidence DESC);
    `);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Check if DEE schema has been initialized
 * @returns true if all DEE columns and tables exist
 */
export async function isDeeSchemaInitialized(): Promise<boolean> {
  const pool = getPool();

  try {
    // Check if enrichment_audit table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'enrichment_audit'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      return false;
    }

    // Check if required DEE columns exist in leads table
    const columnCheck = await pool.query(`
      SELECT
        EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'leads' AND column_name = 'verified_emails'
        ) AS has_verified_emails,
        EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'leads' AND column_name = 'deep_enrichment_json'
        ) AS has_deep_enrichment_json,
        EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_name = 'leads' AND column_name = 'enrichment_status'
        ) AS has_enrichment_status;
    `);

    return Boolean(
      columnCheck.rows[0].has_verified_emails &&
      columnCheck.rows[0].has_deep_enrichment_json &&
      columnCheck.rows[0].has_enrichment_status
    );
  } catch {
    return false;
  }
}

/**
 * Drop DEE schema (for testing/reset purposes)
 * WARNING: This will delete all enrichment data
 */
export async function dropDeeSchema(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Drop enrichment_audit table
    await client.query(`
      DROP TABLE IF EXISTS enrichment_audit;
    `);

    // Drop columns from leads table
    await client.query(`
      ALTER TABLE leads
      DROP COLUMN IF NOT EXISTS deep_enrichment_json,
      DROP COLUMN IF NOT EXISTS verified_emails,
      DROP COLUMN IF NOT EXISTS verified_phones,
      DROP COLUMN IF NOT EXISTS verified_socials,
      DROP COLUMN IF NOT EXISTS confidence_scores,
      DROP COLUMN IF NOT EXISTS deep_enriched_at,
      DROP COLUMN IF NOT EXISTS enrichment_status;
    `);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
