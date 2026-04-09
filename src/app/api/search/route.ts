// ============================================================
// API ROUTE: POST /api/search
// Triggers Google Maps scraping and saves leads to DB
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { scrapeGoogleMaps } from '@/lib/maps/scraper';
import { upsertLead, insertLog } from '@/lib/db/client';
import { createHash } from 'crypto';
import type { ApiResponse, BusinessListing } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 120; // 2 min timeout for scraping

function makeHash(name: string, address: string, phone: string): string {
  return createHash('sha256')
    .update(`${name.toLowerCase().trim()}|${address.toLowerCase().trim()}|${phone.trim()}`)
    .digest('hex')
    .slice(0, 16);
}

export async function POST(req: NextRequest) {
  const start = Date.now();

  try {
    const body = await req.json() as { keyword?: string; location?: string; limit?: number };
    const { keyword, location, limit = 20 } = body;

    if (!keyword?.trim() || !location?.trim()) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'keyword and location are required',
      }, { status: 400 });
    }

    await insertLog('info', `Search started: "${keyword}" in "${location}" (limit: ${limit})`);

    const businesses = await scrapeGoogleMaps({
      keyword: keyword.trim(),
      location: location.trim(),
      limit: Math.min(limit, 50),
    });

    // Save each to DB
    const saved: BusinessListing[] = [];
    for (const b of businesses) {
      const hash = makeHash(b.name, b.address, b.phone ?? '');
      const id = await upsertLead({
        hash,
        place_id: b.place_id ?? null,
        name: b.name,
        address: b.address,
        phone: b.phone ?? null,
        maps_url: b.maps_url ?? null,
        website: b.website ?? null,
        rating: b.rating ?? null,
        review_count: b.review_count ?? null,
        score: null,
        reasons: null,
        enrichment_json: null,
        outreach_json: null,
      });
      saved.push({ ...b, id, hash });
    }

    const duration = Date.now() - start;
    await insertLog('info', `Search complete: ${saved.length} businesses saved in ${duration}ms`);

    return NextResponse.json<ApiResponse<{ businesses: BusinessListing[]; total: number; duration_ms: number }>>({
      success: true,
      data: {
        businesses: saved,
        total: saved.length,
        duration_ms: duration,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await insertLog('error', `Search failed: ${msg}`);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: msg,
    }, { status: 500 });
  }
}
