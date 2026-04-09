// ============================================================
// API ROUTE: POST /api/outreach
// Generates AI outreach for a lead
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { generateOutreach } from '@/lib/ai/generator';
import { updateLeadOutreach, getLeadById, insertLog } from '@/lib/db/client';
import type { ApiResponse, OutreachDraft, OutreachRequest } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      id?: number;
      business_name?: string;
      niche?: string;
      location?: string;
      reasons?: string[];
      website?: string;
      rating?: number;
      review_count?: number;
    };

    let outreachReq: OutreachRequest;

    if (body.id) {
      // Load from DB
      const lead = await getLeadById(body.id);
      if (!lead) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: `Lead ${body.id} not found`,
        }, { status: 404 });
      }

      const reasons = lead.reasons ? JSON.parse(lead.reasons) as string[] : [];

      outreachReq = {
        business_name: lead.name,
        niche: body.niche ?? 'local',
        location: lead.address,
        reasons,
        website: lead.website ?? undefined,
        rating: lead.rating ?? undefined,
        review_count: lead.review_count ?? undefined,
      };
    } else {
      if (!body.business_name?.trim()) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'business_name is required (or provide id)',
        }, { status: 400 });
      }

      outreachReq = {
        business_name: body.business_name.trim(),
        niche: body.niche ?? 'local',
        location: body.location,
        reasons: body.reasons ?? [],
        website: body.website,
        rating: body.rating,
        review_count: body.review_count,
      };
    }

    await insertLog('info', `Generating outreach for: ${outreachReq.business_name}`);

    const draft = await generateOutreach(outreachReq);

    // Persist to DB
    if (body.id) {
      await updateLeadOutreach(body.id, JSON.stringify(draft));
    }

    return NextResponse.json<ApiResponse<OutreachDraft>>({
      success: true,
      data: draft,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await insertLog('error', `Outreach generation failed: ${msg}`);
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 });
  }
}
