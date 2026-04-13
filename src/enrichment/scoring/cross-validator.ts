// ============================================================
// DEEP ENRICHMENT ENGINE — Cross-Validation Engine
//
// Compares data across multiple sources to boost confidence.
// Implements redundancy-based validation: same data from
// multiple independent sources = higher trust.
//
// ⛔ This is a NEW file. Does NOT modify existing scoring code.
// ============================================================

import type { CrossValidationResult, CrossValidationEntry } from '../types';

// ── Boost Constants ──────────────────────────────────────────

const BOOST_MULTI_SOURCE = 0.2;      // Same value from 2+ sources
const BOOST_DOMAIN_MATCH = 0.15;     // Email domain matches business domain
const BOOST_CROSS_FIELD = 0.2;       // Phone in website AND directory
const BOOST_NAME_CITY_MATCH = 0.1;   // Name + city match across sources

// ── Levenshtein Fuzzy Matching ──────────────────────────────

/**
 * Calculate the Levenshtein edit distance between two strings.
 * Used for fuzzy business name matching across sources.
 *
 * @param a - First string
 * @param b - Second string
 * @returns Number of single-character edits to transform a into b
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Calculate string similarity score in the range [0, 1] using Levenshtein.
 * 1.0 = identical strings, 0.0 = completely different.
 *
 * @param a - First string (case-insensitive)
 * @param b - Second string (case-insensitive)
 * @returns Similarity score 0–1
 */
export function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const normA = a.toLowerCase().trim();
  const normB = b.toLowerCase().trim();
  if (normA === normB) return 1;
  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(normA, normB) / maxLen;
}

/**
 * Validate that two business name strings refer to the same entity.
 * Returns BOOST_NAME_CITY_MATCH if similarity exceeds the threshold.
 *
 * @param nameA - Business name from one source
 * @param nameB - Business name from another source
 * @returns Boost score (0 or BOOST_NAME_CITY_MATCH)
 */
export function validateNameMatch(nameA: string, nameB: string): number {
  if (!nameA || !nameB) return 0;
  const similarity = stringSimilarity(nameA, nameB);
  return similarity >= 0.75 ? BOOST_NAME_CITY_MATCH : 0;
}

// ── Normalization Helpers ─────────────────────────────────────

/**
 * Normalize a string for fuzzy comparison:
 * lowercase, trim, remove special chars except @ and .
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w@.\-+]/g, '')
    .replace(/\s+/g, '');
}

/**
 * Normalize phone: strip all non-digits except leading +
 */
function normalizePhone(phone: string): string {
  const hasPlus = phone.startsWith('+');
  const digits = phone.replace(/\D/g, '');
  return hasPlus ? `+${digits}` : digits;
}

/**
 * Normalize email: lowercase, trim
 */
function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Extract domain from email address
 */
function emailDomain(email: string): string {
  const parts = email.split('@');
  return parts.length === 2 ? parts[1].toLowerCase() : '';
}

/**
 * Extract domain from URL
 */
function urlDomain(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

// ── Core Validation ──────────────────────────────────────────

/**
 * Validate a single field value across multiple sources.
 * Returns a boost score based on how many sources agree.
 *
 * @param field - Field type (email, phone, social, person)
 * @param entries - Array of {value, source} from different adapters
 * @returns CrossValidationResult with match count and boost score
 */
export function validateAcrossSources(
  field: string,
  entries: CrossValidationEntry[]
): CrossValidationResult {
  if (entries.length === 0) {
    return {
      field,
      value: '',
      matchCount: 0,
      matchingSources: [],
      boostScore: 0,
    };
  }

  // Group entries by normalized value
  const groups = new Map<string, string[]>();

  for (const entry of entries) {
    let normalizedValue: string;

    switch (field) {
      case 'email':
        normalizedValue = normalizeEmail(entry.value);
        break;
      case 'phone':
        normalizedValue = normalizePhone(entry.value);
        break;
      default:
        normalizedValue = normalize(entry.value);
    }

    if (!normalizedValue) continue;

    const existing = groups.get(normalizedValue) || [];
    if (!existing.includes(entry.source)) {
      existing.push(entry.source);
    }
    groups.set(normalizedValue, existing);
  }

  // Find the value with most source matches
  let bestValue = '';
  let bestSources: string[] = [];

  for (const [value, sources] of groups) {
    if (sources.length > bestSources.length) {
      bestValue = value;
      bestSources = sources;
    }
  }

  // Calculate boost based on match count
  let boostScore = 0;
  if (bestSources.length >= 2) {
    boostScore = BOOST_MULTI_SOURCE;
    // Additional +0.05 for every source beyond 2
    boostScore += Math.min((bestSources.length - 2) * 0.05, 0.15);
  }

  return {
    field,
    value: bestValue,
    matchCount: bestSources.length,
    matchingSources: bestSources,
    boostScore: Math.round(boostScore * 100) / 100,
  };
}

/**
 * Check if an email domain matches the business website domain.
 * Returns a boost score if they match.
 *
 * @param email - Email address to check
 * @param businessWebsite - Business website URL
 * @returns Boost score (0 or BOOST_DOMAIN_MATCH)
 */
export function validateEmailDomain(
  email: string,
  businessWebsite?: string
): number {
  if (!email || !businessWebsite) return 0;

  const emailDom = emailDomain(email);
  const webDom = urlDomain(businessWebsite);

  if (!emailDom || !webDom) return 0;

  // Exact match
  if (emailDom === webDom) return BOOST_DOMAIN_MATCH;

  // Subdomain match (e.g., mail.example.com matches example.com)
  if (emailDom.endsWith(`.${webDom}`) || webDom.endsWith(`.${emailDom}`)) {
    return BOOST_DOMAIN_MATCH * 0.8;
  }

  return 0;
}

/**
 * Validate phone number across website and directory sources.
 * Returns boost if found in both types of sources.
 *
 * @param phoneSources - Array of source names that found this phone
 * @returns Boost score (0 or BOOST_CROSS_FIELD)
 */
export function validatePhoneCrossField(phoneSources: string[]): number {
  const hasWebsiteSource = phoneSources.some(
    (s) => s.includes('website') || s.includes('dee_website')
  );
  const hasDirectorySource = phoneSources.some(
    (s) => s.includes('directory') || s.includes('yellowpages') || s.includes('yelp')
  );

  if (hasWebsiteSource && hasDirectorySource) return BOOST_CROSS_FIELD;
  return 0;
}

/**
 * Calculate total cross-validation boost for a field value.
 * Combines all applicable boost rules.
 *
 * @param field - Field type
 * @param value - The field value
 * @param sources - Sources that found this value
 * @param context - Additional context (business website, etc.)
 * @returns Total boost score (0.0 - 1.0)
 */
export function calculateTotalBoost(
  field: string,
  value: string,
  sources: string[],
  context?: { businessWebsite?: string; businessName?: string }
): number {
  let totalBoost = 0;

  // Multi-source boost
  if (sources.length >= 2) {
    totalBoost += BOOST_MULTI_SOURCE;
    totalBoost += Math.min((sources.length - 2) * 0.05, 0.15);
  }

  // Field-specific boosts
  if (field === 'email' && context?.businessWebsite) {
    totalBoost += validateEmailDomain(value, context.businessWebsite);
  }

  if (field === 'phone') {
    totalBoost += validatePhoneCrossField(sources);
  }

  // Name match boost: compare business name in context with found value for 'person' fields
  if (field === 'person' && context?.businessName && value) {
    totalBoost += validateNameMatch(context.businessName, value);
  }

  return Math.min(Math.round(totalBoost * 100) / 100, 1.0);
}
