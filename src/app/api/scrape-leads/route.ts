// ============================================================
// API ROUTE: POST /api/scrape-leads
// Integrated orchestrator: Maps Scraper + Web Crawler + Tech
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { scrapeGoogleMaps } from '@/lib/maps/scraper';
import { enrichWebsite, flattenEnrichment } from '@/lib/enrich/website';
import { upsertLead, insertLog, updateLeadDeepEnrichment } from '@/lib/db/client';
import { discoverBusinessLinks } from '@/lib/enrich/search-engine';
import { createHash } from 'crypto';
import pLimit from 'p-limit'; // Fast concurrency tracking
import { addDeepEnrichJob, waitForJob } from '@/enrichment/queue/dee-queue';
import { initDeeWorker } from '@/enrichment/queue/dee-worker';
import type { DeepEnrichResult } from '@/types/deep-enrich';
import { generateAutoOutreach } from '@/lib/ai/generator';
import { updateLeadOutreach } from '@/lib/db/client';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 min timeout for heavy concurrent scraping

function makeHash(name: string, address: string, phone: string): string {
  return createHash('sha256')
    .update(`${name.toLowerCase().trim()}|${address.toLowerCase().trim()}|${phone.trim()}`)
    .digest('hex')
    .slice(0, 16);
}

// Format exactly as requested
export interface ScrapedLeadResponse {
  name: string;
  maps_url: string;
  website: string;
  emails: string[];
  phones: string[];
  technologies: string[];
  socials: string[];
  outreach?: {
    subject: string;
    body: string;
    generated_at: string;
    source: 'ai' | 'template';
    model?: string;
  };
}

export async function POST(req: NextRequest) {
  const start = Date.now();

  try {
    const body = await req.json() as { keyword?: string; location?: string; limit?: number };
    const { keyword, location, limit = 10 } = body;

    if (!keyword?.trim() || !location?.trim()) {
      return NextResponse.json({ success: false, error: 'keyword and location are required' }, { status: 400 });
    }

    await insertLog('info', `Integrated scrape started: "${keyword}" in "${location}" (limit: ${limit})`);

    // 1. Map Scraper Tier
    const businesses = await scrapeGoogleMaps({
      keyword: keyword.trim(),
      location: location.trim(),
      limit: Math.min(limit, 50),
    });

    const finalLeads: ScrapedLeadResponse[] = [];
    
    // Concurrency Limit = 3
    const limitConcurrent = pLimit(3);

    // 2. Web Crawler & Tech Engine Tier
    const scrapePromises = businesses.map((b) => limitConcurrent(async () => {
      let finalWebsite = b.website ?? '';
      let enrichmentData: any = undefined;
      let socialMediaUrls: string[] = [];
      let discoveredWebsite = false;

      // Execute Fallback Engine if website is missing
      if (!finalWebsite) {
        await insertLog('info', `Missing website for ${b.name}, firing Search Engine Fallback...`);
        const discovered = await discoverBusinessLinks(b.name, b.address);
        if (discovered.website) {
           finalWebsite = discovered.website;
           discoveredWebsite = true;
        }
        if (discovered.socialLinks.length > 0) {
           socialMediaUrls.push(...discovered.socialLinks);
        }
      }

      // Execute Main Enrichment Engine if website exists (or was discovered)
      if (finalWebsite) {
        enrichmentData = await enrichWebsite({ url: finalWebsite });
      }

      const flat = flattenEnrichment(enrichmentData);
      
      // Combine socials
      const combinedSocials = Array.from(new Set([...socialMediaUrls, ...flat.social_links]));

      // Combine phones
      const phones = [];
      if (b.phone) phones.push(b.phone);
      // Our existing scanner detects if phone is on page but doesn't extract all instances 
      // strictly to avoid junk. We'll return the main phone.

      // Map to exact required output structure
      const leadResponse: ScrapedLeadResponse = {
        name: b.name,
        maps_url: b.maps_url ?? `https://www.google.com/maps/place/?q=place_id:${b.place_id}`,
        website: finalWebsite,
        emails: flat.emails,
        phones: phones,
        technologies: flat.detected_tech,
        socials: combinedSocials,
      };

      // Background logic: still save fully rich data to DB so the dashboard works normally
      const hash = makeHash(b.name, b.address, b.phone ?? '');
      
      const dbEnrichment = enrichmentData ? { ...enrichmentData } : undefined;
      // Inject fallback discovery markers
      if (dbEnrichment && discoveredWebsite) {
         dbEnrichment.raw_url = `<discovered> ${dbEnrichment.raw_url}`;
      }
      if (dbEnrichment && combinedSocials.length > 0 && !dbEnrichment.website?.has_social?.value) {
         if (!dbEnrichment.website) dbEnrichment.website = {};
         dbEnrichment.website.social_links = { value: combinedSocials, source: 'merged', confidence: 0.9 };
         dbEnrichment.website.has_social = { value: true, source: 'merged', confidence: 0.9 };
      }

      const savedLeadId = await upsertLead({
        hash,
        place_id: b.place_id ?? null,
        name: b.name,
        address: b.address,
        phone: b.phone ?? null,
        maps_url: leadResponse.maps_url,
        website: leadResponse.website || null,
        rating: b.rating ?? null,
        review_count: b.review_count ?? null,
        score: null,
        reasons: null,
        enrichment_json: dbEnrichment ? JSON.stringify(dbEnrichment) : null,
        outreach_json: null,
        deep_enrichment_json: null,
        verified_emails: null,
        verified_phones: null,
        verified_socials: null,
        confidence_scores: null,
        deep_enriched_at: null,
        sent_at: null,
      });

      // ── AUTO DEEP ENRICHMENT ────────────────────────────────
      // Run deep-enrichment automatically after lead is saved
      try {
        initDeeWorker();
        const deeInput = {
          leadId: savedLeadId,
          name: b.name,
          address: b.address,
          domain: finalWebsite || undefined,
          phone: b.phone ?? undefined,
        };
        const jobId = await addDeepEnrichJob(savedLeadId, deeInput);
        const job = await waitForJob(jobId, 25000); // 25s timeout per lead
        
        if (job?.status === 'completed' && job.result) {
          // Cast job.result to any to access DeepEnrichResult properties
          const rr = job.result as any;
          // Update lead with deep enrichment results
          const deepEnrichment: DeepEnrichResult = {
            leadId: savedLeadId,
            emails: rr.emails.map((e: any) => ({
              value: e.value,
              confidence: e.confidence,
              status: e.status === 'VERIFIED' ? 'VERIFIED' : e.status === 'DISCARDED' ? 'INVALID' : 'UNVERIFIED',
              sources: e.sources as any,
            })),
            phones: rr.phones.map((p: any) => ({
              value: p.value,
              confidence: p.confidence,
              status: p.status === 'VERIFIED' ? 'VERIFIED' : p.status === 'DISCARDED' ? 'INVALID' : 'UNVERIFIED',
              sources: p.sources as any,
            })),
            socials: rr.socials,
            people: rr.people.map((p: any) => ({
              name: p.name,
              title: p.title,
              confidence: p.confidence,
            })),
            overallConfidence: rr.overallConfidence ?? 0,
            sources_used: rr.sources_used ?? [],
            duration_ms: rr.duration_ms ?? 0,
            enriched_at: rr.enriched_at ?? new Date().toISOString(),
          };
          
          await updateLeadDeepEnrichment(savedLeadId, JSON.stringify(deepEnrichment));
          
          // Update response with deep enrichment data
          leadResponse.emails = deepEnrichment.emails.map(e => e.value);
          leadResponse.phones = [...leadResponse.phones, ...deepEnrichment.phones.map(p => p.value)];
          
          // ── AUTO OUTREACH (Human Feel) ─────────────────────────
          try {
            const flatEnrich = flattenEnrichment(dbEnrichment);
            const outreachInput = {
              businessName: b.name,
              location: b.address,
              niche: keyword,
              deepEnrichment: {
                emails: deepEnrichment.emails,
                phones: deepEnrichment.phones,
                socials: deepEnrichment.socials,
                overallConfidence: deepEnrichment.overallConfidence,
              },
              enrichment: {
                tech: flatEnrich.cms ? { cms: { value: flatEnrich.cms }, detected_tech: { value: flatEnrich.detected_tech } } : undefined,
                website: {
                  has_ssl: { value: flatEnrich.has_ssl },
                  has_booking: { value: flatEnrich.has_booking },
                  has_contact_form: { value: flatEnrich.has_contact_form },
                  social_links: { value: flatEnrich.social_links },
                },
              },
              rating: b.rating,
              review_count: b.review_count,
            };
            
            const outreach = await generateAutoOutreach(outreachInput);
            await updateLeadOutreach(savedLeadId, JSON.stringify(outreach));
            
            leadResponse.outreach = outreach;
          } catch (outreachErr) {
            console.error(`Auto outreach failed for lead ${savedLeadId}:`, outreachErr);
          }
          // ── END AUTO OUTREACH ───────────────────────────
        }
      } catch (deeErr) {
        console.error(`Auto deep-enrich failed for lead ${savedLeadId}:`, deeErr);
        // Continue without deep enrichment - don't fail the whole scrape
      }
      // ── END AUTO DEEP ENRICHMENT ───────────────────────────

      finalLeads.push(leadResponse);
    }));

    await Promise.all(scrapePromises);

    const duration_ms = Date.now() - start;
    await insertLog('info', `Integrated scrape finished: ${businesses.length} mapped, ${finalLeads.length} returned in ${duration_ms}ms`);

    // Output strictly what was requested
    return NextResponse.json({
      success: true,
      data: finalLeads,
      metrics: {
        total_found: businesses.length,
        duration_ms
      }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await insertLog('error', `Integrated scrape failed: ${msg}`);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
