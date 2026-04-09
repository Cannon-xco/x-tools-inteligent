// ============================================================
// DATABASE CLIENT — PostgreSQL via pg
// Singleton pattern for Next.js server-side usage
// ============================================================

import { Pool, PoolClient } from 'pg';
import type { DbLead } from '@/types';

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    const connectionString = process.env.DATABASE_URL;
    
    _pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Initialize schema on first pool creation (only if on Railway/Backend)
    if (process.env.APP_MODE !== 'frontend') {
      initSchema(_pool).catch(err => {
        console.error('Failed to initialize PostgreSQL schema:', err);
      });
    }
  }
  return _pool;
}

async function initSchema(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id              SERIAL PRIMARY KEY,
        hash            TEXT UNIQUE NOT NULL,
        place_id        TEXT,
        name            TEXT NOT NULL,
        address         TEXT NOT NULL DEFAULT '',
        phone           TEXT,
        maps_url        TEXT,
        website         TEXT,
        rating          REAL,
        review_count    INTEGER,
        score           INTEGER,
        reasons         TEXT,
        enrichment_json TEXT,
        outreach_json   TEXT,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_leads_hash    ON leads(hash);
      CREATE INDEX IF NOT EXISTS idx_leads_score   ON leads(score DESC);
      CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_leads_name    ON leads(name);

      CREATE TABLE IF NOT EXISTS logs (
        id         SERIAL PRIMARY KEY,
        level      TEXT NOT NULL,
        message    TEXT NOT NULL,
        data       TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at DESC);
    `);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── CRUD helpers ─────────────────────────────────────────────

export async function upsertLead(lead: Omit<DbLead, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
  const pool = getPool();
  const query = `
    INSERT INTO leads (hash, place_id, name, address, phone, maps_url, website, rating, review_count, score, reasons, enrichment_json, outreach_json)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (hash) DO UPDATE SET
      score           = COALESCE(EXCLUDED.score, leads.score),
      reasons         = COALESCE(EXCLUDED.reasons, leads.reasons),
      enrichment_json = COALESCE(EXCLUDED.enrichment_json, leads.enrichment_json),
      outreach_json   = COALESCE(EXCLUDED.outreach_json, leads.outreach_json),
      updated_at      = CURRENT_TIMESTAMP
    RETURNING id
  `;
  const values = [
    lead.hash, lead.place_id, lead.name, lead.address, lead.phone, lead.maps_url, 
    lead.website, lead.rating, lead.review_count, lead.score, 
    lead.reasons ? JSON.stringify(lead.reasons) : null,
    lead.enrichment_json, lead.outreach_json
  ];
  const res = await pool.query(query, values);
  return res.rows[0].id;
}

export async function getLeads(limit = 200, offset = 0): Promise<DbLead[]> {
  const pool = getPool();
  const res = await pool.query(
    'SELECT * FROM leads ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return res.rows as DbLead[];
}

export async function getLeadById(id: number): Promise<DbLead | null> {
  const pool = getPool();
  const res = await pool.query('SELECT * FROM leads WHERE id = $1', [id]);
  return (res.rows[0] as DbLead) ?? null;
}

export async function updateLeadScore(id: number, score: number, reasons: string[]): Promise<void> {
  await getPool().query(
    'UPDATE leads SET score = $1, reasons = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
    [score, JSON.stringify(reasons), id]
  );
}

export async function updateLeadEnrichment(id: number, enrichmentJson: string): Promise<void> {
  await getPool().query(
    'UPDATE leads SET enrichment_json = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [enrichmentJson, id]
  );
}

export async function updateLeadOutreach(id: number, outreachJson: string): Promise<void> {
  await getPool().query(
    'UPDATE leads SET outreach_json = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [outreachJson, id]
  );
}

export async function deleteLeadById(id: number): Promise<void> {
  await getPool().query('DELETE FROM leads WHERE id = $1', [id]);
}

export async function deleteAllLeads(): Promise<void> {
  await getPool().query('DELETE FROM leads');
}

export async function getLeadsCount(): Promise<number> {
  const res = await getPool().query('SELECT COUNT(*) as count FROM leads');
  return parseInt(res.rows[0].count);
}

export async function insertLog(level: string, message: string, data?: unknown): Promise<void> {
  try {
    await getPool().query(
      'INSERT INTO logs (level, message, data) VALUES ($1, $2, $3)',
      [level, message, data ? JSON.stringify(data) : null]
    );
  } catch {
    // Non-fatal
  }
}

export async function getRecentLogs(limit = 100): Promise<Array<{
  id: number; level: string; message: string; data: string | null; created_at: string;
}>> {
  const res = await getPool().query(
    'SELECT * FROM logs ORDER BY created_at DESC LIMIT $1',
    [limit]
  );
  return res.rows;
}
