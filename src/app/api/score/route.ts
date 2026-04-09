// ============================================================
// API ROUTE: POST /api/score
// Scores a lead based on enriched data
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { scoreLead, getRules } from '@/lib/scoring/engine';
import { flattenEnrichment } from '@/lib/enrich/website';
import { updateLeadScore, getLeadById, insertLog } from '@/lib/db/client';
import type { ApiResponse, ScoringResult, EnrichmentData } from '@/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      id?: number;
      rating?: number;
      review_count?: number;
      website?: string;
      enrichment?: EnrichmentData;
    };

    let { id, rating, review_count, website, enrichment } = body;

    // If id provided, load from DB
    if (id && !enrichment) {
      const lead = await getLeadById(id);
      if (lead) {
        rating = lead.rating ?? undefined;
        review_count = lead.review_count ?? undefined;
        website = lead.website ?? undefined;
        enrichment = lead.enrichment_json ? JSON.parse(lead.enrichment_json) : undefined;
      }
    }

    const flat = flattenEnrichment(enrichment);
    flat.has_website = !!website || flat.has_website;

    const result = scoreLead({ rating, review_count, website }, flat);

    // Persist if we have an ID
    if (id) {
      await updateLeadScore(id, result.score, result.reasons);
      await insertLog('info', `Scored lead ${id}: ${result.score}pts – ${result.reasons.length} issues`);
    }

    return NextResponse.json<ApiResponse<ScoringResult>>({
      success: true,
      data: result,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await insertLog('error', `Scoring failed: ${msg}`);
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 });
  }
}

// GET scoring rules (for frontend config display)
export async function GET() {
  try {
    const config = getRules();
    return NextResponse.json<ApiResponse<typeof config>>({ success: true, data: config });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 });
  }
}
