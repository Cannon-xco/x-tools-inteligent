import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Pool } from 'pg';

// Load .env.local manually
try {
  const envFile = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8');
  for (const line of envFile.split('\n')) {
    const [k, ...v] = line.trim().split('=');
    if (k && !k.startsWith('#') && v.length) process.env[k] = v.join('=').replace(/^["']|["']$/g, '');
  }
} catch { /* no .env.local */ }

async function migrate() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error('DATABASE_URL not set');

  const isRemote = !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1');
  const pool = new Pool({
    connectionString,
    ssl: isRemote ? { rejectUnauthorized: false } : false,
  });

  const client = await pool.connect();
  try {
    console.log('🔄 Running migrations...');

    await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP;`);
    await client.query(`ALTER TABLE leads ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            SERIAL PRIMARY KEY,
        email         TEXT UNIQUE NOT NULL,
        name          TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        default_niche TEXT DEFAULT 'local',
        from_name     TEXT DEFAULT 'XTools Outreach',
        from_email    TEXT DEFAULT 'onboarding@resend.dev',
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('✅ Migration complete: users, user_preferences tables ready');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
