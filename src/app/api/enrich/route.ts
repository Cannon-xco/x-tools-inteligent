// ============================================================
// API ROUTE: POST /api/enrich
// Enriches a single lead by fetching its website
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { enrichWebsite } from '@/lib/enrich/website';
import { updateLeadEnrichment, insertLog, getLeadById, upsertLead } from '@/lib/db/client';
import { discoverBusinessLinks } from '@/lib/enrich/search-engine';
import type { ApiResponse, EnrichmentData } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { id?: number; url?: string; forcePlaywright?: boolean };
    const { id, forcePlaywright = false } = body;
    let { url } = body;

    let lead = id ? await getLeadById(id) : null;
    let discoveredSignals;

    // Check if website is missing but we have an ID
    if (id && lead && !url?.trim()) {
      await insertLog('info', `Lead ${id} has no website, initiating search engine discovery...`);
      discoveredSignals = await discoverBusinessLinks(lead.name, lead.address);
      
      if (discoveredSignals.website) {
        await insertLog('info', `✅ Auto-discovered website for ${lead.name}: ${discoveredSignals.website}`);
        url = discoveredSignals.website;
        // Save the newly discovered website back to the DB mapping
        await upsertLead({ ...lead, website: url });
      } else {
        await insertLog('warn', `Failed to discover official website for ${lead.name}`);
        // Save social links even if we didn't find a base website
        if (discoveredSignals.socialLinks.length > 0) {
          const dummyEnrichment: EnrichmentData = {
             website: {
               social_links: { value: discoveredSignals.socialLinks, source: 'search_engine', confidence: 0.8 },
               has_social: { value: true, source: 'search_engine', confidence: 0.8 }
             },
             enriched_at: new Date().toISOString()
          };
          await updateLeadEnrichment(id, JSON.stringify(dummyEnrichment));
          return NextResponse.json<ApiResponse<EnrichmentData>>({ success: true, data: dummyEnrichment, message: 'Only social links found' });
        }
      }
    }

    if (!url?.trim()) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Website URL is missing and could not be discovered.',
      }, { status: 400 });
    }

    await insertLog('info', `Enriching lead ${id ?? '?'}: ${url}`);

    const enrichment = await enrichWebsite({ url: url.trim(), forcePlaywright });

    // Inject discovered social links if they exist
    if (discoveredSignals && discoveredSignals.socialLinks.length > 0) {
      if (!enrichment.website) enrichment.website = {};
      const existingSocials = enrichment.website.social_links?.value || [];
      const combined = Array.from(new Set([...existingSocials, ...discoveredSignals.socialLinks]));
      enrichment.website.social_links = { value: combined, source: 'merged', confidence: 0.9 };
      enrichment.website.has_social = { value: combined.length > 0, source: 'merged', confidence: 0.9 };
    }
    
    if (discoveredSignals?.websiteSource) {
      enrichment.raw_url = `<discovered> ${enrichment.raw_url}`; // Hack string marker so UI knows
    }

    // Persist to DB if we have a lead ID
    if (id) {
      await updateLeadEnrichment(id, JSON.stringify(enrichment));
    }

    return NextResponse.json<ApiResponse<EnrichmentData>>({
      success: true,
      data: enrichment,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await insertLog('error', `Enrichment failed: ${msg}`);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: msg,
    }, { status: 500 });
  }
}

// Bulk enrichment endpoint
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json() as { leads: Array<{ id: number; url: string }> };
    const { leads } = body;

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'leads array is required',
      }, { status: 400 });
    }

    const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_ENRICHMENT ?? '5');
    const results: Array<{ id: number; success: boolean; error?: string }> = [];

    // Process in batches
    for (let i = 0; i < leads.length; i += maxConcurrent) {
      const batch = leads.slice(i, i + maxConcurrent);
      const batchResults = await Promise.allSettled(
        batch.map(async ({ id, url }) => {
          const enrichment = await enrichWebsite({ url });
          await updateLeadEnrichment(id, JSON.stringify(enrichment));
          return { id, success: true };
        })
      );

      batchResults.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          results.push(r.value);
        } else {
          results.push({
            id: batch[idx].id,
            success: false,
            error: r.reason instanceof Error ? r.reason.message : String(r.reason),
          });
        }
      });
    }

    return NextResponse.json<ApiResponse<typeof results>>({
      success: true,
      data: results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json<ApiResponse>({ success: false, error: msg }, { status: 500 });
  }
}
