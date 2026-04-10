// ============================================================
// DEEP ENRICHMENT ENGINE — Worker
//
// Processes deep enrichment jobs from the queue.
// Orchestrates: adapters → normalize → cross-validate → score
//
// ⛔ This is a NEW file. Does NOT modify existing code.
// ============================================================

import type { DeeJob, DeepEnrichResult, ConfidenceResult, ExtractedContact } from '../types';
import { extractFromWebsite } from '../sources/website-adapter';
import { searchBusiness } from '../sources/serp-adapter';
import { calculateConfidence, calculateOverallConfidence } from '../scoring/confidence-engine';
import { validateAcrossSources, calculateTotalBoost } from '../scoring/cross-validator';
import { registerProcessor } from './dee-queue';

// ── Worker Configuration ─────────────────────────────────────

const ADAPTER_TIMEOUT = 15_000;

// ── Pipeline Processing ──────────────────────────────────────

/**
 * Process a single deep enrichment job.
 * Runs all available adapters, normalizes, cross-validates, and scores.
 */
async function processJob(job: DeeJob): Promise<DeepEnrichResult> {
  const start = Date.now();
  const { input } = job;
  const sourcesUsed: string[] = [];

  // Collected raw data from all adapters
  const rawEmails: Array<ExtractedContact & { adapterSource: string }> = [];
  const rawPhones: Array<ExtractedContact & { adapterSource: string }> = [];
  const allSocials: Record<string, string> = {};
  const allPeople: Array<{ name: string; title: string; confidence: number; source: string }> = [];

  // ── Run Website Adapter ──────────────────────────────────

  if (input.domain) {
    try {
      const websiteUrl = input.domain.startsWith('http') ? input.domain : `https://${input.domain}`;
      const websiteResult = await withTimeout(extractFromWebsite(websiteUrl), ADAPTER_TIMEOUT);

      sourcesUsed.push('website');

      for (const email of websiteResult.emails) {
        rawEmails.push({ ...email, adapterSource: 'website' });
      }
      for (const phone of websiteResult.phones) {
        rawPhones.push({ ...phone, adapterSource: 'website' });
      }
      for (const [platform, url] of Object.entries(websiteResult.socials)) {
        if (url && !allSocials[platform]) {
          allSocials[platform] = url;
        }
      }
      for (const person of websiteResult.people) {
        allPeople.push({ ...person, source: 'website' });
      }
    } catch {
      // Website adapter failed — continue with other adapters
    }
  }

  // ── Run SERP Adapter ─────────────────────────────────────

  try {
    const serpResult = await withTimeout(
      searchBusiness(input.name, input.address),
      ADAPTER_TIMEOUT
    );

    sourcesUsed.push('serp');

    // If SERP found an official website and we don't have a domain, enrich it
    if (serpResult.officialWebsite && !input.domain) {
      try {
        const websiteResult = await withTimeout(
          extractFromWebsite(serpResult.officialWebsite),
          ADAPTER_TIMEOUT
        );

        sourcesUsed.push('serp_website');

        for (const email of websiteResult.emails) {
          rawEmails.push({ ...email, adapterSource: 'serp_website' });
        }
        for (const phone of websiteResult.phones) {
          rawPhones.push({ ...phone, adapterSource: 'serp_website' });
        }
        for (const [platform, url] of Object.entries(websiteResult.socials)) {
          if (url && !allSocials[platform]) {
            allSocials[platform] = url;
          }
        }
      } catch {
        // SERP website enrichment failed
      }
    }

    // Add social profiles from SERP
    for (const socialUrl of serpResult.socialProfiles) {
      const platform = detectPlatform(socialUrl);
      if (platform && !allSocials[platform]) {
        allSocials[platform] = socialUrl;
      }
    }
  } catch {
    // SERP adapter failed — continue
  }

  // ── Cross-Validation & Confidence Scoring ────────────────

  const now = new Date();
  const businessWebsite = input.domain
    ? (input.domain.startsWith('http') ? input.domain : `https://${input.domain}`)
    : undefined;

  // Score emails
  const scoredEmails: ConfidenceResult[] = [];
  const emailGroups = groupByValue(rawEmails, (e) => e.value.toLowerCase());

  for (const [emailValue, entries] of emailGroups) {
    const sources = entries.map((e) => e.source);
    const crossBoost = calculateTotalBoost('email', emailValue, sources, { businessWebsite });

    const result = calculateConfidence(
      'email',
      emailValue,
      entries.map((e) => ({ name: e.source, reliability: e.confidence, timestamp: now })),
      crossBoost
    );

    if (result.status !== 'DISCARDED') {
      scoredEmails.push(result);
    }
  }

  // Score phones
  const scoredPhones: ConfidenceResult[] = [];
  const phoneGroups = groupByValue(rawPhones, (p) => normalizePhone(p.value));

  for (const [phoneValue, entries] of phoneGroups) {
    const sources = entries.map((e) => e.source);
    const crossBoost = calculateTotalBoost('phone', phoneValue, sources);

    const result = calculateConfidence(
      'phone',
      phoneValue,
      entries.map((e) => ({ name: e.source, reliability: e.confidence, timestamp: now })),
      crossBoost
    );

    if (result.status !== 'DISCARDED') {
      scoredPhones.push(result);
    }
  }

  // Score people
  const scoredPeople = allPeople.map((p) => ({
    name: p.name,
    title: p.title,
    confidence: p.confidence,
  }));

  // Calculate overall confidence
  const allResults = [...scoredEmails, ...scoredPhones];
  const overallConfidence = calculateOverallConfidence(allResults);

  // Sort by confidence (highest first)
  scoredEmails.sort((a, b) => b.confidence - a.confidence);
  scoredPhones.sort((a, b) => b.confidence - a.confidence);

  return {
    leadId: input.leadId,
    emails: scoredEmails,
    phones: scoredPhones,
    socials: {
      linkedin: allSocials.linkedin,
      instagram: allSocials.instagram,
      facebook: allSocials.facebook,
      twitter: allSocials.twitter,
      tiktok: allSocials.tiktok,
      youtube: allSocials.youtube,
    },
    people: scoredPeople,
    overallConfidence,
    sources_used: sourcesUsed,
    duration_ms: Date.now() - start,
    enriched_at: new Date().toISOString(),
  };
}

// ── Helpers ──────────────────────────────────────────────────

/**
 * Run a promise with timeout. Rejects if timeout exceeded.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    promise
      .then((val) => { clearTimeout(timer); resolve(val); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}

/**
 * Group array items by a key extracted from each item.
 */
function groupByValue<T>(
  items: T[],
  keyFn: (item: T) => string
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

/**
 * Normalize phone number for deduplication.
 */
function normalizePhone(phone: string): string {
  const hasPlus = phone.startsWith('+');
  const digits = phone.replace(/\D/g, '');
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Detect social media platform from URL.
 */
function detectPlatform(url: string): string | null {
  const lower = url.toLowerCase();
  if (lower.includes('linkedin.com')) return 'linkedin';
  if (lower.includes('instagram.com')) return 'instagram';
  if (lower.includes('facebook.com')) return 'facebook';
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'twitter';
  if (lower.includes('tiktok.com')) return 'tiktok';
  if (lower.includes('youtube.com')) return 'youtube';
  return null;
}

// ── Worker Registration ──────────────────────────────────────

/**
 * Initialize the DEE worker.
 * Registers the processJob handler with the queue.
 * Call this once at application startup.
 */
export function initDeeWorker(): void {
  registerProcessor(processJob);
}

/**
 * Process a job directly (bypasses queue, for testing/debugging).
 */
export async function processJobDirect(job: DeeJob): Promise<DeepEnrichResult> {
  return processJob(job);
}
