// ============================================================
// LEAD SCORING ENGINE
// Configurable rule-based scoring for sales qualification
// ============================================================

import fs from 'fs';
import path from 'path';
import type { ScoringResult, ScoringConfig, ScoringRule, ScoringOperator } from '@/types';
import type { FlatEnrichment } from '@/lib/enrich/website';

const RULES_PATH = path.join(process.cwd(), 'scoring-rules.json');

// ── Rule loader (with hot-reload on each evaluation) ─────────

let _cachedConfig: ScoringConfig | null = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 30_000; // 30s

function loadRules(): ScoringConfig {
  const now = Date.now();
  if (_cachedConfig && now - _cacheTime < CACHE_TTL_MS) {
    return _cachedConfig;
  }
  try {
    const raw = fs.readFileSync(RULES_PATH, 'utf-8');
    _cachedConfig = JSON.parse(raw) as ScoringConfig;
    _cacheTime = now;
    return _cachedConfig;
  } catch {
    // Fallback to minimal built-in config
    return {
      version: 'built-in',
      rules: [
        { id: 'no_website', field: 'has_website', operator: 'eq', value: false, score: 30, reason: 'No website detected' },
        { id: 'no_ssl', field: 'has_ssl', operator: 'eq', value: false, score: 25, reason: 'No SSL certificate' },
        { id: 'low_rating', field: 'rating', operator: 'lt', value: 4.0, score: 20, reason: 'Low Google rating' },
        { id: 'no_booking', field: 'has_booking', operator: 'eq', value: false, score: 20, reason: 'No booking system' },
        { id: 'low_reviews', field: 'review_count', operator: 'lt', value: 20, score: 15, reason: 'Low review count' },
        { id: 'no_social', field: 'has_social', operator: 'eq', value: false, score: 10, reason: 'No social media' },
        { id: 'no_contact_form', field: 'has_contact_form', operator: 'eq', value: false, score: 10, reason: 'No contact form' },
      ],
    };
  }
}

// ── Operator evaluator ────────────────────────────────────────

function evaluate(
  fieldValue: string | number | boolean | null | undefined,
  op: ScoringOperator,
  ruleValue: string | number | boolean
): boolean {
  if (fieldValue === null || fieldValue === undefined) {
    // Treat null/undefined as "false" for boolean checks
    if (typeof ruleValue === 'boolean') {
      fieldValue = false;
    } else {
      return false;
    }
  }

  switch (op) {
    case 'eq':  return fieldValue === ruleValue;
    case 'neq': return fieldValue !== ruleValue;
    case 'lt':  return (fieldValue as number) < (ruleValue as number);
    case 'lte': return (fieldValue as number) <= (ruleValue as number);
    case 'gt':  return (fieldValue as number) > (ruleValue as number);
    case 'gte': return (fieldValue as number) >= (ruleValue as number);
    default:    return false;
  }
}

// ── Context builder ───────────────────────────────────────────

interface ScoringContext {
  // From Google Maps
  rating?: number;
  review_count?: number;
  has_website: boolean;
  // From enrichment
  has_ssl: boolean;
  has_contact_form: boolean;
  has_booking: boolean;
  has_social: boolean;
}

function buildContext(
  listing: { rating?: number; review_count?: number; website?: string },
  enrichment: FlatEnrichment
): ScoringContext {
  return {
    rating: listing.rating,
    review_count: listing.review_count,
    has_website: !!listing.website || enrichment.has_website,
    has_ssl: enrichment.has_ssl,
    has_contact_form: enrichment.has_contact_form,
    has_booking: enrichment.has_booking,
    has_social: enrichment.has_social,
  };
}

// ── Main scoring function ─────────────────────────────────────

export function scoreLead(
  listing: { rating?: number; review_count?: number; website?: string },
  enrichment: FlatEnrichment
): ScoringResult {
  const config = loadRules();
  const context = buildContext(listing, enrichment);
  const activeRules = config.rules.filter((r) => r.enabled !== false);

  let score = 0;
  const reasons: string[] = [];
  const maxPossible = activeRules.reduce((acc, r) => acc + r.score, 0);

  for (const rule of activeRules) {
    const fieldValue = (context as unknown as Record<string, unknown>)[rule.field];
    const matched = evaluate(
      fieldValue as string | number | boolean | null,
      rule.operator,
      rule.value
    );

    if (matched) {
      score += rule.score;
      reasons.push(rule.reason);
    }
  }

  return {
    score,
    reasons,
    max_possible: maxPossible,
  };
}

// ── Utility: score label ──────────────────────────────────────

export function scoreLabel(score: number): 'Hot' | 'Warm' | 'Cold' {
  if (score >= 60) return 'Hot';
  if (score >= 30) return 'Warm';
  return 'Cold';
}

export function getRules(): ScoringConfig {
  return loadRules();
}
