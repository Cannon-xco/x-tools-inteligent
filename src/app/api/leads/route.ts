// ============================================================
// API ROUTE: /api/leads
// GET: List all leads | DELETE: Remove a lead
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getLeads, getLeadsCount, deleteLeadById, insertLog } from '@/lib/db/client';
import type { ApiResponse, BusinessListing, EnrichmentData, OutreachDraft } from '@/types';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '200'), 500);
    const offset = parseInt(searchParams.get('offset') ?? '0');

    const rows = await getLeads(limit, offset);
    const total = await getLeadsCount();

    const leads: BusinessListing[] = rows.map((row) => ({
      id: row.id,
      hash: row.hash,
      place_id: row.place_id ?? undefined,
      name: row.name,
      address: row.address,
      phone: row.phone ?? undefined,
      maps_url: row.maps_url ?? undefined,
      website: row.website ?? undefined,
      rating: row.rating ?? undefined,
      review_count: row.review_count ?? undefined,
      score: row.score ?? undefined,
      reasons: row.reasons ? JSON.parse(row.reasons) as string[] : undefined,
      enrichment: row.enrichment_json ? JSON.parse(row.enrichment_json) as EnrichmentData : undefined,
      outreach: row.outreach_json ? JSON.parse(row.outreach_json) as OutreachDraft : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return NextResponse.json<ApiResponse<{ leads: BusinessListing[]; total: number }>>({
      success: true,
      data: { leads, total },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await insertLog('error', `Failed to list leads: ${msg}`);
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const all = searchParams.get('all') === 'true';

    if (all) {
      const { deleteAllLeads } = await import('@/lib/db/client');
      await deleteAllLeads();
      await insertLog('info', '🗑 DELETED ALL LEADS FROM DATABASE');
      return NextResponse.json<ApiResponse>({ success: true, message: 'All leads deleted' });
    }

    const id = parseInt(searchParams.get('id') ?? '0');

    if (!id) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'id or all=true is required' }, { status: 400 });
    }

    await deleteLeadById(id);
    await insertLog('info', `Deleted lead ${id}`);

    return NextResponse.json<ApiResponse>({ success: true, message: `Lead ${id} deleted` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 });
  }
}
