// ============================================================
// DEEP ENRICHMENT ENGINE — Confidence Scoring Engine
//
// Calculates confidence scores for enriched data fields using:
//   confidence = (sourceReliability × 0.4) +
//                (fieldMatch × 0.3) +
//                (freshness × 0.2) +
//                (crossValidation × 0.1)
//
// ⛔ This is a NEW file. Does NOT modify existing scoring code.
// ============================================================

import type {
  ConfidenceResult,
  ConfidenceStatus,
  FieldType,
  SOURCE_RELIABILITY,
} from '../types';

// Re-import as value (not just type) for runtime usage
const SOURCE_WEIGHTS: Record<string, number> = {
  official_website: 0.9,
  dee_website_adapter: 0.9,
  'dee_website_adapter:mailto': 0.95,
  'dee_website_adapter:regex': 0.85,
  'dee_website_adapter:obfuscated': 0.7,
  'dee_website_adapter:js_concat': 0.6,
  'dee_website_adapter:tel_link': 0.95,
  'dee_website_adapter:whatsapp': 0.9,
  directory: 0.7,
  yellowpages: 0.7,
  yelp: 0.7,
  dee_serp_adapter: 0.5,
  serp_snippet: 0.5,
  raw_scrape: 0.4,
  dns: 0.8,
  whois: 0.6,
  social: 0.6,
};

// ── Confidence Thresholds ────────────────────────────────────

const THRESHOLD_VERIFIED = 0.75;
const THRESHOLD_LOW_CONFIDENCE = 0.50;

// ── Scoring Formula Weights ──────────────────────────────────

const W_SOURCE_RELIABILITY = 0.4;
const W_FIELD_MATCH = 0.3;
const W_FRESHNESS = 0.2;
const W_CROSS_VALIDATION = 0.1;

// ── Helper Functions ─────────────────────────────────────────

/**
 * Get reliability weight for a source name.
 * Falls back to 0.4 (raw_scrape) for unknown sources.
 */
function getSourceReliability(sourceName: string): number {
  // Check exact match first
  if (SOURCE_WEIGHTS[sourceName] !== undefined) return SOURCE_WEIGHTS[sourceName];

  // Check prefix match (e.g., "dee_website_adapter:mailto" → "dee_website_adapter")
  const prefix = sourceName.split(':')[0];
  if (SOURCE_WEIGHTS[prefix] !== undefined) return SOURCE_WEIGHTS[prefix];

  return 0.4; // default: raw_scrape level
}

/**
 * Calculate field match score based on field type and value quality.
 * Higher score for more complete/valid data.
 */
function calculateFieldMatch(field: string, value: string): number {
  if (!value || value.trim().length === 0) return 0;

  switch (field) {
    case 'email': {
      // Valid email format = higher score
      const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      const hasCommonTld = /\.(com|org|net|io|co|biz|info|edu)$/i.test(value);
      let score = isValid ? 0.7 : 0.3;
      if (hasCommonTld) score += 0.2;
      if (!value.includes('noreply') && !value.includes('no-reply')) score += 0.1;
      return Math.min(score, 1.0);
    }
    case 'phone': {
      const digits = value.replace(/\D/g, '');
      if (digits.length >= 10 && digits.length <= 15) return 0.9;
      if (digits.length >= 7) return 0.6;
      return 0.3;
    }
    case 'social': {
      // Social URL should be HTTPS and have a path
      try {
        const url = new URL(value);
        if (url.pathname.length > 1) return 0.85;
      } catch { /* not a valid URL */ }
      return 0.5;
    }
    case 'person': {
      // Name should have at least 2 words
      const words = value.trim().split(/\s+/);
      if (words.length >= 2 && words.length <= 5) return 0.8;
      return 0.4;
    }
    default:
      return 0.5;
  }
}

/**
 * Calculate freshness score based on source timestamps.
 * More recent = higher score.
 */
function calculateFreshness(timestamps: Date[]): number {
  if (timestamps.length === 0) return 0.5;

  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  const latestTimestamp = Math.max(...timestamps.map((t) => t.getTime()));
  const age = now - latestTimestamp;

  if (age <= maxAge) return 1.0;           // Within 24h
  if (age <= maxAge * 7) return 0.8;       // Within 1 week
  if (age <= maxAge * 30) return 0.6;      // Within 1 month
  if (age <= maxAge * 90) return 0.4;      // Within 3 months
  return 0.2;                               // Older than 3 months
}

/**
 * Classify confidence score into status category.
 */
function classifyConfidence(score: number): ConfidenceStatus {
  if (score >= THRESHOLD_VERIFIED) return 'VERIFIED';
  if (score >= THRESHOLD_LOW_CONFIDENCE) return 'LOW_CONFIDENCE';
  return 'DISCARDED';
}

// ── Main Export ──────────────────────────────────────────────

/**
 * Calculate confidence score for a single enriched field value.
 *
 * Formula:
 *   confidence = (sourceReliability × 0.4) +
 *                (fieldMatch × 0.3) +
 *                (freshness × 0.2) +
 *                (crossValidation × 0.1)
 *
 * @param field - Type of field (email, phone, social, person)
 * @param value - The extracted value
 * @param sources - Array of sources that found this value
 * @param crossValidationScore - Score from cross-validation (0.0 - 1.0)
 * @returns ConfidenceResult with score, status, and source info
 */
export function calculateConfidence(
  field: string,
  value: string,
  sources: Array<{ name: string; reliability: number; timestamp: Date }>,
  crossValidationScore: number
): ConfidenceResult {
  if (sources.length === 0) {
    return {
      value,
      field: field as FieldType,
      confidence: 0,
      status: 'DISCARDED',
      sources: [],
    };
  }

  // 1. Source reliability: weighted average of all sources
  const avgSourceReliability =
    sources.reduce((sum, s) => sum + getSourceReliability(s.name), 0) / sources.length;

  // Bonus for multiple sources (up to +0.1)
  const multiSourceBonus = Math.min((sources.length - 1) * 0.05, 0.1);
  const sourceScore = Math.min(avgSourceReliability + multiSourceBonus, 1.0);

  // 2. Field match quality
  const fieldMatchScore = calculateFieldMatch(field, value);

  // 3. Freshness
  const freshnessScore = calculateFreshness(sources.map((s) => s.timestamp));

  // 4. Cross-validation (passed in from cross-validator)
  const crossValScore = Math.min(Math.max(crossValidationScore, 0), 1);

  // Final weighted score
  const confidence =
    sourceScore * W_SOURCE_RELIABILITY +
    fieldMatchScore * W_FIELD_MATCH +
    freshnessScore * W_FRESHNESS +
    crossValScore * W_CROSS_VALIDATION;

  // Clamp to [0, 1]
  const clampedConfidence = Math.min(Math.max(confidence, 0), 1);

  return {
    value,
    field: field as FieldType,
    confidence: Math.round(clampedConfidence * 100) / 100,
    status: classifyConfidence(clampedConfidence),
    sources: sources.map((s) => ({
      name: s.name,
      reliability: getSourceReliability(s.name),
    })),
  };
}

/**
 * Batch-score all fields from a deep enrichment run.
 * Convenience wrapper around calculateConfidence.
 */
export function scoreAllFields(
  fields: Array<{
    field: string;
    value: string;
    sources: Array<{ name: string; timestamp: Date }>;
    crossValidationScore: number;
  }>
): ConfidenceResult[] {
  return fields.map((f) =>
    calculateConfidence(
      f.field,
      f.value,
      f.sources.map((s) => ({
        ...s,
        reliability: getSourceReliability(s.name),
      })),
      f.crossValidationScore
    )
  );
}

/**
 * Calculate overall confidence for an entire deep enrichment result.
 * Weighted average: verified fields count more than low-confidence ones.
 */
export function calculateOverallConfidence(results: ConfidenceResult[]): number {
  if (results.length === 0) return 0;

  const verified = results.filter((r) => r.status === 'VERIFIED');
  const low = results.filter((r) => r.status === 'LOW_CONFIDENCE');

  // Weighted: verified × 1.0, low_confidence × 0.5, discarded × 0
  const weightedSum =
    verified.reduce((sum, r) => sum + r.confidence, 0) +
    low.reduce((sum, r) => sum + r.confidence * 0.5, 0);

  const totalWeight = verified.length + low.length * 0.5;

  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 100) / 100;
}
