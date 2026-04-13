// ============================================================
// API ROUTE: POST /api/admin/purge-pii
// Purges raw enrichment_audit entries older than 7 days.
// Boss spec: "Log raw payloads temporarily, then purge PII after 7 days."
// ============================================================

import { NextResponse } from 'next/server';
import { getPool, insertLog } from '@/lib/db/client';

export const runtime = 'nodejs';

const PII_RETENTION_DAYS = 7;

/**
 * POST /api/admin/purge-pii
 *
 * Deletes `enrichment_audit` rows whose `created_at` is older than
 * `PII_RETENTION_DAYS` days. Safe to call on a schedule (e.g. Railway cron).
 *
 * @returns JSON with count of deleted rows and cutoff date used.
 */
export async function POST() {
  const pool = getPool();

  try {
    const result = await pool.query(
      `DELETE FROM enrichment_audit
       WHERE created_at < NOW() - INTERVAL '${PII_RETENTION_DAYS} days'
       RETURNING id`
    );

    const deleted = result.rowCount ?? 0;
    const cutoff = new Date(Date.now() - PII_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

    await insertLog('info', `PII purge complete: deleted ${deleted} enrichment_audit rows older than ${PII_RETENTION_DAYS} days (cutoff: ${cutoff})`);

    return NextResponse.json({
      success: true,
      deleted,
      cutoff,
      retention_days: PII_RETENTION_DAYS,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await insertLog('error', `PII purge failed: ${msg}`);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
