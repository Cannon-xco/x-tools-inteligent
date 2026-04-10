// ============================================================
// API ROUTE: /api/deep-enrich
// Deep Enrichment Engine (DEE) — POST and GET handlers
// Provides deep contact enrichment with multi-source intelligence
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getLeadById, insertLog, getPool } from '@/lib/db/client';
import type { DbLead } from '@/types';
import type {
  DeepEnrichRequestBody,
  DeepEnrichOptions,
  DeepEnrichResult,
  DeepEnrichStatusResponse,
  DeepEnrichSummary,
  DeepEnrichApiResponse,
  DeepEnrichSource,
  DeepEnrichStatus,
  DbLeadWithDeepEnrich,
} from '@/types/deep-enrich';

// Runtime configuration
export const runtime = 'nodejs';
export const maxDuration = 60; // 1 minute timeout

/** Default sources for deep enrichment */
const DEFAULT_SOURCES: DeepEnrichSource[] = ['website', 'serp', 'directory', 'social', 'dns', 'whois'];

/** Default timeout in milliseconds */
const DEFAULT_TIMEOUT = 30000;

/**
 * Placeholder for deep enrichment pipeline.
 * Will be replaced with actual implementation after team merge.
 *
 * @param lead - The lead to enrich
 * @param sources - Sources to use for enrichment
 * @returns Promise resolving to deep enrichment result
 */
async function runDeepEnrichPipeline(
  lead: DbLead,
  sources: DeepEnrichSource[]
): Promise<DeepEnrichResult> {
  // TODO: Integrate with actual DEE pipeline after team merge
  // For now, return mock structure
  await insertLog('info', `Running deep enrichment pipeline for lead ${lead.id} with sources: ${sources.join(', ')}`);

  return {
    leadId: lead.id,
    emails: [],
    phones: [],
    socials: {},
    people: [],
    overallConfidence: 0,
    sources_used: sources,
    duration_ms: 0,
    enriched_at: new Date().toISOString(),
  };
}

/**
 * Calculate overall confidence score based on enrichment results.
 *
 * @param result - The enrichment result
 * @returns Calculated confidence score 0-1
 */
function calculateOverallConfidence(result: DeepEnrichResult): number {
  const emailConfidences = result.emails.map(e => e.confidence);
  const phoneConfidences = result.phones.map(p => p.confidence);
  const peopleConfidences = result.people.map(p => p.confidence);

  const allConfidences = [...emailConfidences, ...phoneConfidences, ...peopleConfidences];

  if (allConfidences.length === 0) {
    return 0;
  }

  // Weighted average with bonus for variety of sources
  const avgConfidence = allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length;
  const sourceBonus = Math.min(result.sources_used.length * 0.05, 0.2);

  return Math.min(avgConfidence + sourceBonus, 1);
}

/**
 * Generate summary from enrichment result.
 *
 * @param result - The enrichment result
 * @returns Summary statistics
 */
function generateSummary(result: DeepEnrichResult): DeepEnrichSummary {
  const socialsCount = Object.values(result.socials).filter(Boolean).length;

  return {
    emails_found: result.emails.length,
    phones_found: result.phones.length,
    socials_found: socialsCount,
    people_found: result.people.length,
  };
}

/**
 * Update lead with deep enrichment data in database.
 *
 * @param leadId - The lead ID
 * @param result - The enrichment result to save
 */
async function updateLeadDeepEnrichment(leadId: number, result: DeepEnrichResult): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE leads 
     SET deep_enrichment_json = $1, 
         deep_enriched_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP 
     WHERE id = $2`,
    [JSON.stringify(result), leadId]
  );
}

/**
 * Get lead with deep enrichment fields.
 *
 * @param id - The lead ID
 * @returns Lead with deep enrichment data or null
 */
async function getLeadWithDeepEnrich(id: number): Promise<DbLeadWithDeepEnrich | null> {
  const pool = getPool();
  const res = await pool.query(
    `SELECT *, deep_enrichment_json, deep_enriched_at 
     FROM leads WHERE id = $1`,
    [id]
  );
  return (res.rows[0] as DbLeadWithDeepEnrich) ?? null;
}

/**
 * Determine enrichment status from lead data.
 *
 * @param lead - Lead with deep enrichment data
 * @returns Enrichment status
 */
function determineEnrichStatus(lead: DbLeadWithDeepEnrich): DeepEnrichStatus {
  if (lead.deep_enriched_at) {
    return 'enriched';
  }
  if (lead.deep_enrichment_json) {
    try {
      const data = JSON.parse(lead.deep_enrichment_json);
      if (data.error || data.failed) {
        return 'failed';
      }
      return 'pending';
    } catch {
      return 'not_started';
    }
  }
  return 'not_started';
}

/**
 * POST handler — Run deep enrichment for a lead.
 *
 * @param req - Next.js request object
 * @returns JSON response with enrichment result
 */
export async function POST(req: NextRequest): Promise<NextResponse<DeepEnrichApiResponse<DeepEnrichResult>>> {
  try {
    const body = (await req.json()) as DeepEnrichRequestBody;
    const { id, options = {} } = body;

    // Validate input
    if (typeof id !== 'number' || isNaN(id) || id <= 0) {
      await insertLog('warn', 'Deep enrich request rejected: invalid lead ID');
      return NextResponse.json<DeepEnrichApiResponse>({
        success: false,
        error: 'Lead ID is required and must be a valid number',
      }, { status: 400 });
    }

    // Check if lead exists
    const lead = await getLeadById(id);
    if (!lead) {
      await insertLog('warn', `Deep enrich request rejected: lead ${id} not found`);
      return NextResponse.json<DeepEnrichApiResponse>({
        success: false,
        error: `Lead ${id} not found`,
      }, { status: 404 });
    }

    // Parse options
    const {
      sources = DEFAULT_SOURCES,
      timeout = DEFAULT_TIMEOUT,
      force = false,
    } = options as DeepEnrichOptions;

    // Check for cached data
    if (!force) {
      const leadWithDeep = await getLeadWithDeepEnrich(id);
      if (leadWithDeep?.deep_enriched_at && leadWithDeep.deep_enrichment_json) {
        try {
          const cached = JSON.parse(leadWithDeep.deep_enrichment_json) as DeepEnrichResult;
          await insertLog('info', `Returning cached deep enrichment for lead ${id}`);
          return NextResponse.json<DeepEnrichApiResponse<DeepEnrichResult>>({
            success: true,
            data: cached,
            message: 'Returning cached enrichment data (use force: true to re-enrich)',
          });
        } catch {
          // Cache corrupted, continue with fresh enrichment
          await insertLog('warn', `Cached deep enrichment corrupted for lead ${id}, re-enriching`);
        }
      }
    }

    // Start enrichment
    await insertLog('info', `Starting deep enrichment for lead ${id}: ${lead.name}`);
    const startTime = Date.now();

    // Set up timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Deep enrichment timeout after ${timeout}ms`)), timeout);
    });

    // Run enrichment with timeout
    let result: DeepEnrichResult;
    try {
      result = await Promise.race([
        runDeepEnrichPipeline(lead, sources),
        timeoutPromise,
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await insertLog('error', `Deep enrichment failed for lead ${id}: ${msg}`);
      return NextResponse.json<DeepEnrichApiResponse>({
        success: false,
        error: `Deep enrichment failed: ${msg}`,
      }, { status: 500 });
    }

    // Calculate duration and confidence
    const duration = Date.now() - startTime;
    result.duration_ms = duration;
    result.overallConfidence = calculateOverallConfidence(result);
    result.enriched_at = new Date().toISOString();

    // Save to database
    await updateLeadDeepEnrichment(id, result);

    await insertLog('info', `Deep enrichment completed for lead ${id} in ${duration}ms with confidence ${result.overallConfidence}`);

    return NextResponse.json<DeepEnrichApiResponse<DeepEnrichResult>>({
      success: true,
      data: result,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await insertLog('error', `Deep enrich API error: ${msg}`);
    return NextResponse.json<DeepEnrichApiResponse>({
      success: false,
      error: msg,
    }, { status: 500 });
  }
}

/**
 * GET handler — Get deep enrichment status for a lead.
 *
 * @param req - Next.js request object
 * @returns JSON response with enrichment status
 */
export async function GET(req: NextRequest): Promise<NextResponse<DeepEnrichApiResponse<DeepEnrichStatusResponse>>> {
  try {
    // Get lead ID from query params
    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get('id');

    if (!idParam) {
      return NextResponse.json<DeepEnrichApiResponse>({
        success: false,
        error: 'Lead ID is required (use ?id=<number>)',
      }, { status: 400 });
    }

    const id = parseInt(idParam, 10);
    if (isNaN(id) || id <= 0) {
      return NextResponse.json<DeepEnrichApiResponse>({
        success: false,
        error: 'Lead ID must be a valid number',
      }, { status: 400 });
    }

    // Get lead with deep enrichment data
    const lead = await getLeadWithDeepEnrich(id);
    if (!lead) {
      return NextResponse.json<DeepEnrichApiResponse>({
        success: false,
        error: `Lead ${id} not found`,
      }, { status: 404 });
    }

    // Determine status
    const status = determineEnrichStatus(lead);

    // Build response
    const response: DeepEnrichStatusResponse = {
      leadId: id,
      status,
      summary: {
        emails_found: 0,
        phones_found: 0,
        socials_found: 0,
        people_found: 0,
      },
    };

    // Include additional data if enriched
    if (status === 'enriched' && lead.deep_enrichment_json) {
      try {
        const data = JSON.parse(lead.deep_enrichment_json) as DeepEnrichResult;
        response.enriched_at = lead.deep_enriched_at ?? undefined;
        response.overallConfidence = data.overallConfidence;
        response.summary = generateSummary(data);
      } catch {
        // JSON parse error, return basic response
        await insertLog('warn', `Failed to parse deep enrichment data for lead ${id}`);
      }
    }

    return NextResponse.json<DeepEnrichApiResponse<DeepEnrichStatusResponse>>({
      success: true,
      data: response,
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await insertLog('error', `Deep enrich status API error: ${msg}`);
    return NextResponse.json<DeepEnrichApiResponse>({
      success: false,
      error: msg,
    }, { status: 500 });
  }
}
