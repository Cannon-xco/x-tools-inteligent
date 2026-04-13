// ============================================================
// API ROUTE: GET /api/leads/[id]/enrich/status
// Polling endpoint — returns current enrichment_status + result.
// Dashboard polls this every 2s while enrichment_status = 'processing'.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db/client';
import type { DeepEnrichApiResponse } from '@/types/deep-enrich';

export const runtime = 'nodejs';

/** Shape returned by this endpoint. */
export interface EnrichStatusResponse {
  leadId: number;
  status: 'processing' | 'completed' | 'failed' | 'limit_reached' | 'not_started';
  enriched_at: string | null;
  result: unknown | null;
}

/**
 * GET /api/leads/[id]/enrich/status
 *
 * Returns the current `enrichment_status` and enrichment result (if completed)
 * for a lead. The dashboard polls this endpoint while status is `processing`.
 *
 * @param _req    - Next.js request object (unused)
 * @param context - Route context containing async params
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: idParam } = await context.params;
  const id = parseInt(idParam, 10);

  if (isNaN(id) || id <= 0) {
    return NextResponse.json<DeepEnrichApiResponse<null>>({
      success: false,
      error: 'Lead ID must be a valid positive number',
    }, { status: 400 });
  }

  const pool = getPool();
  const res = await pool.query(
    `SELECT id, enrichment_status, deep_enriched_at, deep_enrichment_json FROM leads WHERE id = $1`,
    [id]
  );

  if (res.rows.length === 0) {
    return NextResponse.json<DeepEnrichApiResponse<null>>({
      success: false,
      error: `Lead ${id} not found`,
    }, { status: 404 });
  }

  const row = res.rows[0];
  const rawStatus = row.enrichment_status as string | null;

  const status: EnrichStatusResponse['status'] =
    rawStatus === 'processing' ? 'processing' :
    rawStatus === 'completed'  ? 'completed'  :
    rawStatus === 'failed'     ? 'failed'      :
    rawStatus === 'limit_reached' ? 'limit_reached' :
    'not_started';

  let result: unknown = null;
  if (row.deep_enrichment_json) {
    try {
      result = JSON.parse(row.deep_enrichment_json);
    } catch {
      result = null;
    }
  }

  return NextResponse.json<DeepEnrichApiResponse<EnrichStatusResponse>>({
    success: true,
    data: {
      leadId: id,
      status,
      enriched_at: row.deep_enriched_at ?? null,
      result,
    },
  });
}
