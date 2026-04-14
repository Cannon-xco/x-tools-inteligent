
// ============================================================
// DATABASE CLIENT — PostgreSQL via pg
// Singleton pattern for Next.js server-side usage
// ============================================================

import { Pool } from 'pg';
import type { DbLead } from '@/types';
import { initDeeSchema } from '@/enrichment/db/dee-schema';

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    const connectionString = process.env.DATABASE_URL?.trim();
    
    if (!connectionString) {
      console.error('❌ DATABASE_URL is not defined! DB operations will fail.');
    }

    const isRemote = connectionString && !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1');
    _pool = new Pool({
      connectionString,
      ssl: isRemote ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 60000,
      connectionTimeoutMillis: 10000,
      application_name: 'saas-local-business-lead',
    });

    _pool.on('error', (err) => {
      console.error('💥 PostgreSQL Pool Error:', err?.message ?? String(err), err);
    });

    // Initialize schema on first pool creation
    if (connectionString) {
      initSchema(_pool)
        .then(() => initDeeSchema())
        .catch(err => {
          const detail =
            err instanceof Error
              ? `${err.message}\n${err.stack ?? ''}`
              : JSON.stringify(err);
          console.error('❌ Failed to initialize PostgreSQL schema:', detail);
        });
    }
  }
  return _pool;
}

// ── Users schema ──────────────────────────────────────────────

export interface DbUser {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
}

async function initUsersSchema(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      default_niche TEXT DEFAULT 'local',
      from_name TEXT DEFAULT 'XTools Outreach',
      from_email TEXT DEFAULT 'onboarding@resend.dev',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function createUser(email: string, name: string, passwordHash: string): Promise<DbUser> {
  const pool = getPool();
  const res = await pool.query(
    `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING *`,
    [email.toLowerCase().trim(), name.trim(), passwordHash]
  );
  await pool.query(
    `INSERT INTO user_preferences (user_id) VALUES ($1) ON CONFLICT DO NOTHING`,
    [res.rows[0].id]
  );
  return res.rows[0];
}

export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const pool = getPool();
  const res = await pool.query(`SELECT * FROM users WHERE email = $1`, [email.toLowerCase().trim()]);
  return res.rows[0] ?? null;
}

export async function getUserById(id: number): Promise<DbUser | null> {
  const pool = getPool();
  const res = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
  return res.rows[0] ?? null;
}

// ── Leads schema ─────────────────────────────────────────────

async function initSchema(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        default_niche TEXT DEFAULT 'local',
        from_name TEXT DEFAULT 'XTools Outreach',
        from_email TEXT DEFAULT 'onboarding@resend.dev',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS leads (
        id                   SERIAL PRIMARY KEY,
        hash                 TEXT UNIQUE NOT NULL,
        place_id             TEXT,
        name                 TEXT NOT NULL,
        address              TEXT NOT NULL DEFAULT '',
        phone                TEXT,
        maps_url             TEXT,
        website              TEXT,
        rating               REAL,
        review_count         INTEGER,
        score                INTEGER,
        reasons              TEXT,
        enrichment_json      TEXT,
        outreach_json        TEXT,
        deep_enrichment_json TEXT,
        verified_emails      TEXT,
        verified_phones      TEXT,
        verified_socials     TEXT,
        confidence_scores    TEXT,
        deep_enriched_at     TIMESTAMP,
        created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE leads ADD COLUMN IF NOT EXISTS deep_enrichment_json TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS verified_emails TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS verified_phones TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS verified_socials TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS confidence_scores TEXT;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS deep_enriched_at TIMESTAMP;
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP;

      CREATE INDEX IF NOT EXISTS idx_leads_hash          ON leads(hash);
      CREATE INDEX IF NOT EXISTS idx_leads_score         ON leads(score DESC);
      CREATE INDEX IF NOT EXISTS idx_leads_created       ON leads(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_leads_name          ON leads(name);
      CREATE INDEX IF NOT EXISTS idx_leads_deep_enriched ON leads(deep_enriched_at DESC);

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
    INSERT INTO leads (
      hash, place_id, name, address, phone, maps_url, website,
      rating, review_count, score, reasons, enrichment_json, outreach_json,
      deep_enrichment_json, verified_emails, verified_phones, verified_socials,
      confidence_scores, deep_enriched_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    ON CONFLICT (hash) DO UPDATE SET
      score                = COALESCE(EXCLUDED.score, leads.score),
      reasons              = COALESCE(EXCLUDED.reasons, leads.reasons),
      enrichment_json      = COALESCE(EXCLUDED.enrichment_json, leads.enrichment_json),
      outreach_json        = COALESCE(EXCLUDED.outreach_json, leads.outreach_json),
      deep_enrichment_json = COALESCE(EXCLUDED.deep_enrichment_json, leads.deep_enrichment_json),
      verified_emails      = COALESCE(EXCLUDED.verified_emails, leads.verified_emails),
      verified_phones      = COALESCE(EXCLUDED.verified_phones, leads.verified_phones),
      verified_socials     = COALESCE(EXCLUDED.verified_socials, leads.verified_socials),
      confidence_scores    = COALESCE(EXCLUDED.confidence_scores, leads.confidence_scores),
      deep_enriched_at     = COALESCE(EXCLUDED.deep_enriched_at, leads.deep_enriched_at),
      updated_at           = CURRENT_TIMESTAMP
    RETURNING id
  `;
  const values = [
    lead.hash, lead.place_id, lead.name, lead.address, lead.phone, lead.maps_url,
    lead.website, lead.rating, lead.review_count, lead.score,
    lead.reasons ? JSON.stringify(lead.reasons) : null,
    lead.enrichment_json, lead.outreach_json,
    lead.deep_enrichment_json ?? null,
    lead.verified_emails ?? null,
    lead.verified_phones ?? null,
    lead.verified_socials ?? null,
    lead.confidence_scores ?? null,
    lead.deep_enriched_at ?? null,
  ];
  const res = await pool.query(query, values);
  return res.rows[0].id;
}

export async function getLeads(limit = 200, offset = 0): Promise<DbLead[]> {
  const pool = getPool();
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, 500)) : 200;
  const safeOffset = Number.isFinite(offset) ? Math.max(0, offset) : 0;

  const query = `SELECT * FROM leads ORDER BY created_at DESC LIMIT ${safeLimit} OFFSET ${safeOffset}`;
  const res = await pool.query(query);
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

export async function updateLeadDeepEnrichment(id: number, deepEnrichmentJson: string): Promise<void> {
  await getPool().query(
    'UPDATE leads SET deep_enrichment_json = $1, deep_enriched_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [deepEnrichmentJson, id]
  );
}

export async function updateLeadOutreach(id: number, outreachJson: string): Promise<void> {
  await getPool().query(
    'UPDATE leads SET outreach_json = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [outreachJson, id]
  );
}

/**
 * Update the sent_at timestamp for a lead after email is sent.
 * @param id - The lead ID to update
 * @param sentAt - ISO timestamp string when email was sent
 */
export async function updateLeadSentAt(id: number, sentAt: string): Promise<void> {
  await getPool().query(
    'UPDATE leads SET sent_at = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [sentAt, id]
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
