// ============================================================
// DEEP ENRICHMENT ENGINE — Worker
//
// Processes deep enrichment jobs from the queue.
// Orchestrates: seed extract → hypothesis generate →
//   adapters (all 6, parallel) → cross-validate → score → audit log
//
// ⛔ This is a NEW file. Does NOT modify existing code.
// ============================================================

import type { DeeJob, DeepEnrichResult, ConfidenceResult, ExtractedContact } from '../types';
import { extractFromWebsite } from '../sources/website-adapter';
import { searchBusiness } from '../sources/serp-adapter';
import { searchDirectories } from '../sources/directory-adapter';
import { enrichSocials } from '../sources/social-adapter';
import { lookupDns } from '../sources/dns-adapter';
import { lookupWhois } from '../sources/whois-adapter';
import { calculateConfidence, calculateOverallConfidence } from '../scoring/confidence-engine';
import { calculateTotalBoost } from '../scoring/cross-validator';
import { extractSeed } from '../pipeline/seed-extractor';
import { generateHypotheses } from '../pipeline/hypothesis-generator';
import { insertAuditEntry } from '../db/dee-queries';
import { registerProcessor } from './dee-queue';

// ── Worker Configuration ─────────────────────────────────────

const ADAPTER_TIMEOUT = 15_000;

// ── Pipeline Processing ──────────────────────────────────────

/**
 * Process a single deep enrichment job.
 * Runs all 6 adapters in parallel, cross-validates, scores, and writes audit log.
 */
async function processJob(job: DeeJob): Promise<DeepEnrichResult> {
  const start = Date.now();
  const { input } = job;

  // ── Step 1: Seed extraction ──────────────────────────────
  const seed = extractSeed({
    name: input.name,
    address: input.address,
    phone: input.phone,
    website: input.domain,
    niche: input.niche,
  });

  const sourcesUsed: string[] = [];

  // Raw data buckets
  const rawEmails: Array<ExtractedContact & { adapterSource: string }> = [];
  const rawPhones: Array<ExtractedContact & { adapterSource: string }> = [];
  const allSocials: Record<string, string> = {};
  const allPeople: Array<{ name: string; title: string; confidence: number }> = [];
  const allSocialUrls: string[] = [];

  // ── Step 2: Hypothesis generation for SERP ──────────────
  const hypotheses = generateHypotheses({
    name: input.name,
    normalized_name: seed.normalized_name,
    city: seed.city,
    domain: seed.domain,
    niche: input.niche,
  });
  const serpQueries = hypotheses.map((h) => h.query);

  // Resolve website URL
  const websiteUrl = seed.domain
    ? (seed.domain.startsWith('http') ? seed.domain : `https://${seed.domain}`)
    : input.domain
      ? (input.domain.startsWith('http') ? input.domain : `https://${input.domain}`)
      : undefined;

  const searchCity = seed.city || input.address;
  const searchName = seed.display_name || input.name;

  // ── Step 3: Run all 6 adapters in parallel ────────────────
  const [websiteRes, serpRes, directoryRes, dnsRes, whoisRes] = await Promise.allSettled([
    websiteUrl
      ? withTimeout(extractFromWebsite(websiteUrl), ADAPTER_TIMEOUT)
      : Promise.resolve(null),
    withTimeout(searchBusiness(input.name, searchCity, serpQueries), ADAPTER_TIMEOUT),
    withTimeout(searchDirectories(searchName, searchCity), ADAPTER_TIMEOUT),
    seed.domain
      ? withTimeout(lookupDns(seed.domain), ADAPTER_TIMEOUT)
      : Promise.resolve(null),
    seed.domain
      ? withTimeout(lookupWhois(seed.domain), ADAPTER_TIMEOUT)
      : Promise.resolve(null),
  ]);

  // ── Process website adapter results ──────────────────────
  if (websiteRes.status === 'fulfilled' && websiteRes.value) {
    sourcesUsed.push('website');
    const r = websiteRes.value;
    for (const e of r.emails) rawEmails.push({ ...e, adapterSource: 'website' });
    for (const p of r.phones) rawPhones.push({ ...p, adapterSource: 'website' });
    for (const person of r.people) allPeople.push(person);
    for (const [platform, url] of Object.entries(r.socials)) {
      if (url) {
        if (!allSocials[platform]) allSocials[platform] = url;
        allSocialUrls.push(url);
      }
    }
  }

  // ── Process SERP adapter results ──────────────────────────
  if (serpRes.status === 'fulfilled' && serpRes.value) {
    sourcesUsed.push('serp');
    const r = serpRes.value;
    allSocialUrls.push(...r.socialProfiles);

    // Fallback: if no domain was provided, enrich official website from SERP
    if (r.officialWebsite && !websiteUrl) {
      try {
        const siteRes = await withTimeout(extractFromWebsite(r.officialWebsite), ADAPTER_TIMEOUT);
        sourcesUsed.push('serp_website');
        for (const e of siteRes.emails) rawEmails.push({ ...e, adapterSource: 'serp_website' });
        for (const p of siteRes.phones) rawPhones.push({ ...p, adapterSource: 'serp_website' });
        for (const [platform, url] of Object.entries(siteRes.socials)) {
          if (url && !allSocials[platform]) {
            allSocials[platform] = url;
            allSocialUrls.push(url);
          }
        }
      } catch { /* continue */ }
    }
  }

  // ── Process directory adapter results ─────────────────────
  if (directoryRes.status === 'fulfilled' && directoryRes.value) {
    sourcesUsed.push('directory');
    const r = directoryRes.value;
    for (const phone of r.phones) {
      rawPhones.push({ value: phone, source: 'directory', confidence: 0.7, adapterSource: 'directory' });
    }
    // Enrich first website found in directory if we have no domain yet
    if (r.websites.length > 0 && !websiteUrl) {
      try {
        const siteRes = await withTimeout(extractFromWebsite(r.websites[0]), ADAPTER_TIMEOUT);
        sourcesUsed.push('directory_website');
        for (const e of siteRes.emails) rawEmails.push({ ...e, adapterSource: 'directory_website' });
        for (const p of siteRes.phones) rawPhones.push({ ...p, adapterSource: 'directory_website' });
      } catch { /* continue */ }
    }
  }

  // ── Social adapter — aggregate all collected URLs ──────────
  if (allSocialUrls.length > 0) {
    try {
      const socialRes = await withTimeout(
        enrichSocials(allSocialUrls, 'combined', { verify: false }),
        ADAPTER_TIMEOUT
      );
      if (socialRes.total_found > 0) {
        sourcesUsed.push('social');
        for (const [platform, url] of Object.entries(socialRes.socials)) {
          if (url && !allSocials[platform]) allSocials[platform] = url;
        }
      }
    } catch { /* continue */ }
  }

  // ── DNS/WHOIS — validation + registrant email ─────────────
  if (dnsRes.status === 'fulfilled' && dnsRes.value) {
    sourcesUsed.push('dns');
  }
  if (whoisRes.status === 'fulfilled' && whoisRes.value) {
    sourcesUsed.push('whois');
    const r = whoisRes.value;
    if (r.registrant?.email) {
      rawEmails.push({
        value: r.registrant.email,
        source: 'whois',
        confidence: 0.5,
        adapterSource: 'whois',
      });
    }
  }

  // ── Step 4: Cross-Validation & Confidence Scoring ─────────
  const now = new Date();

  const scoredEmails: ConfidenceResult[] = [];
  const emailGroups = groupByValue(rawEmails, (e) => e.value.toLowerCase());

  for (const [emailValue, entries] of emailGroups) {
    const sources = entries.map((e) => e.source);
    const crossBoost = calculateTotalBoost('email', emailValue, sources, { businessWebsite: websiteUrl });
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

  const scoredPeople = allPeople.map((p) => ({
    name: p.name,
    title: p.title,
    confidence: p.confidence,
  }));

  const allResults = [...scoredEmails, ...scoredPhones];
  const overallConfidence = calculateOverallConfidence(allResults);

  scoredEmails.sort((a, b) => b.confidence - a.confidence);
  scoredPhones.sort((a, b) => b.confidence - a.confidence);

  // ── Step 5: Write audit log ──────────────────────────────
  await writeAuditLog(input.leadId, scoredEmails, scoredPhones, allSocials);

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
 * Write scored fields to the enrichment_audit table.
 * Failures are swallowed so audit never blocks enrichment.
 */
async function writeAuditLog(
  leadId: number,
  emails: ConfidenceResult[],
  phones: ConfidenceResult[],
  socials: Record<string, string>
): Promise<void> {
  try {
    const entries: Promise<unknown>[] = [];

    for (const email of emails) {
      entries.push(
        insertAuditEntry({
          lead_id: leadId,
          field_name: 'email',
          value: email.value,
          source: email.sources.map((s) => s.name).join(', '),
          confidence: email.confidence,
          status: mapConfidenceStatus(email.status),
        })
      );
    }

    for (const phone of phones) {
      entries.push(
        insertAuditEntry({
          lead_id: leadId,
          field_name: 'phone',
          value: phone.value,
          source: phone.sources.map((s) => s.name).join(', '),
          confidence: phone.confidence,
          status: mapConfidenceStatus(phone.status),
        })
      );
    }

    for (const [platform, url] of Object.entries(socials)) {
      if (url) {
        entries.push(
          insertAuditEntry({
            lead_id: leadId,
            field_name: 'social',
            value: url,
            source: platform,
            confidence: 0.7,
            status: 'verified',
          })
        );
      }
    }

    await Promise.allSettled(entries);
  } catch { /* audit log failures must never block enrichment */ }
}

/**
 * Map internal ConfidenceStatus to AuditEntry status.
 */
function mapConfidenceStatus(
  status: string
): 'pending' | 'verified' | 'low_confidence' | 'discarded' {
  switch (status) {
    case 'VERIFIED': return 'verified';
    case 'LOW_CONFIDENCE': return 'low_confidence';
    case 'DISCARDED': return 'discarded';
    default: return 'pending';
  }
}

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
