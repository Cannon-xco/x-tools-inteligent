// ============================================================
// API ROUTE: POST /api/leads/[id]/enrich
// RESTful Deep Enrichment endpoint (Boss spec: /api/leads/:id/enrich)
// Wraps the same pipeline as /api/deep-enrich with:
//   - id sourced from URL path param (not body)
//   - enrichment_status tracking (processing → completed/failed/limit_reached)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getLeadById, insertLog, getPool } from '@/lib/db/client';
import type { DeepEnrichResult, DeepEnrichSource, DeepEnrichOptions, DeepEnrichApiResponse } from '@/types/deep-enrich';
import type { DeepEnrichInput } from '@/enrichment/types';
import { addDeepEnrichJob, waitForJob } from '@/enrichment/queue/dee-queue';
import { initDeeWorker } from '@/enrichment/queue/dee-worker';
import { saveDeepEnrichment } from '@/enrichment/db/dee-queries';
import { updateEnrichmentStatus } from '@/enrichment/db/dee-queries';
import type { ConfidenceResult } from '@/enrichment/types';
import type { DeepEnrichEmail, DeepEnrichPhone, DeepEnrichPerson } from '@/types/deep-enrich';

export const runtime = 'nodejs';
export const maxDuration = 60;

const DEFAULT_SOURCES: DeepEnrichSource[] = ['website', 'serp', 'directory', 'social', 'dns', 'whois'];
const DEFAULT_TIMEOUT = 30000;

let _workerInitialized = false;
function ensureDeeWorker(): void {
  if (!_workerInitialized) {
    initDeeWorker();
    _workerInitialized = true;
  }
}

/**
 * Convert internal ConfidenceResult[] to API DeepEnrichEmail[]/DeepEnrichPhone[].
 */
function toApiResult(
  internal: {
    emails: ConfidenceResult[];
    phones: ConfidenceResult[];
    people: Array<{ name: string; title: string; confidence: number }>;
    socials: Record<string, string | undefined>;
    leadId: number;
    overallConfidence: number;
    duration_ms: number;
    enriched_at: string;
  },
  sources: DeepEnrichSource[]
): DeepEnrichResult {
  const emails: DeepEnrichEmail[] = internal.emails.map((e) => ({
    value: e.value,
    confidence: e.confidence,
    status: e.status === 'VERIFIED' ? 'VERIFIED' : e.status === 'DISCARDED' ? 'INVALID' : 'UNVERIFIED',
    sources,
  }));

  const phones: DeepEnrichPhone[] = internal.phones.map((p) => ({
    value: p.value,
    confidence: p.confidence,
    status: p.status === 'VERIFIED' ? 'VERIFIED' : p.status === 'DISCARDED' ? 'INVALID' : 'UNVERIFIED',
    sources,
  }));

  const people: DeepEnrichPerson[] = internal.people.map((p) => ({
    name: p.name,
    title: p.title,
    confidence: p.confidence,
  }));

  return {
    leadId: internal.leadId,
    emails,
    phones,
    socials: internal.socials,
    people,
    overallConfidence: internal.overallConfidence,
    sources_used: sources,
    duration_ms: internal.duration_ms,
    enriched_at: internal.enriched_at,
  };
}

/**
 * POST /api/leads/[id]/enrich
 *
 * Triggers deep enrichment for a lead identified by the URL path param `id`.
 * Sets enrichment_status to `processing` while running, then `completed`,
 * `failed`, or `limit_reached` upon finish.
 *
 * @param _req  - Next.js request object
 * @param context - Route context containing async params
 */
export async function POST(
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

  const lead = await getLeadById(id);
  if (!lead) {
    return NextResponse.json<DeepEnrichApiResponse<null>>({
      success: false,
      error: `Lead ${id} not found`,
    }, { status: 404 });
  }

  // Mark as processing
  await updateEnrichmentStatus(id, 'processing');
  await insertLog('info', `[RESTful] Starting deep enrichment for lead ${id}: ${lead.name}`);

  ensureDeeWorker();

  const input: DeepEnrichInput = {
    leadId: lead.id,
    name: lead.name,
    address: lead.address ?? '',
    domain: lead.website ?? undefined,
    phone: lead.phone ?? undefined,
  };

  const start = Date.now();

  try {
    const jobId = await addDeepEnrichJob(lead.id, input);
    const job = await waitForJob(jobId, DEFAULT_TIMEOUT);

    if (!job || job.status === 'failed') {
      const msg = job?.error ?? 'DEE pipeline failed';
      await updateEnrichmentStatus(id, 'failed');
      await insertLog('error', `[RESTful] Deep enrichment failed for lead ${id}: ${msg}`);
      return NextResponse.json<DeepEnrichApiResponse<null>>({
        success: false,
        error: msg,
      }, { status: 500 });
    }

    if (!job.result) {
      await updateEnrichmentStatus(id, 'failed');
      return NextResponse.json<DeepEnrichApiResponse<null>>({
        success: false,
        error: 'DEE job completed but returned no result',
      }, { status: 500 });
    }

    const result = toApiResult(job.result, DEFAULT_SOURCES);
    result.duration_ms = Date.now() - start;
    result.enriched_at = new Date().toISOString();

    // Detect limit_reached: all sources returned no usable data
    const hasData =
      result.emails.length > 0 ||
      result.phones.length > 0 ||
      Object.values(result.socials).some(Boolean);

    const finalStatus = hasData ? 'completed' : 'limit_reached';

    // Persist full JSON blob
    const pool = getPool();
    await pool.query(
      `UPDATE leads SET deep_enrichment_json = $1, deep_enriched_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [JSON.stringify(result), id]
    );

    // Persist typed columns
    try {
      await saveDeepEnrichment(id, {
        verified_emails: result.emails.map((e) => ({
          value: e.value,
          original: e.value,
          source: e.sources.join(', '),
          confidence: e.confidence,
        })),
        verified_phones: result.phones.map((p) => ({
          value: p.value,
          original: p.value,
          source: p.sources.join(', '),
          confidence: p.confidence,
        })),
        verified_socials: result.socials,
        confidence_scores: Object.fromEntries([
          ...result.emails.map((e) => [e.value, e.confidence] as [string, number]),
          ...result.phones.map((p) => [p.value, p.confidence] as [string, number]),
        ]),
      });
    } catch (saveErr) {
      await insertLog('warn', `[RESTful] Typed column save failed for lead ${id}: ${saveErr}`);
    }

    await updateEnrichmentStatus(id, finalStatus);
    await insertLog('info', `[RESTful] Enrichment ${finalStatus} for lead ${id} in ${result.duration_ms}ms`);

    return NextResponse.json<DeepEnrichApiResponse<DeepEnrichResult>>({
      success: true,
      data: result,
      message: finalStatus === 'limit_reached'
        ? 'Enrichment completed but no data could be discovered (limit_reached)'
        : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await updateEnrichmentStatus(id, 'failed');
    await insertLog('error', `[RESTful] Deep enrich error for lead ${id}: ${msg}`);
    return NextResponse.json<DeepEnrichApiResponse<null>>({
      success: false,
      error: msg,
    }, { status: 500 });
  }
}
