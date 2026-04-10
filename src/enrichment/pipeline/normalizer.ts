// ============================================================
// DATA NORMALIZATION LAYER
// Deep Enrichment Engine (DEE) - Data Processing Layer
// Converts raw data from multiple source adapters to unified schema
// ============================================================

/**
 * Normalized enrichment data with confidence tracking
 */
export interface NormalizedEnrichmentData {
  /** Verified emails with provenance */
  emails: Array<{
    value: string;
    original: string;
    source: string;
    confidence: number;
  }>;
  /** Verified phones in E.164 format with provenance */
  phones: Array<{
    value: string;
    original: string;
    source: string;
    confidence: number;
  }>;
  /** Social media profiles by platform */
  socials: {
    linkedin?: string;
    instagram?: string;
    facebook?: string;
    twitter?: string;
    tiktok?: string;
    youtube?: string;
  };
  /** Key people identified with titles */
  people: Array<{
    name: string;
    title: string;
    source: string;
    confidence: number;
  }>;
}

/**
 * Raw data from a single source adapter
 */
export interface RawDataSource {
  /** Source identifier (e.g., 'website', 'serp', 'directory') */
  source: string;
  /** Raw email strings found */
  emails?: string[];
  /** Raw phone strings found */
  phones?: string[];
  /** Raw social media URLs found */
  socialUrls?: string[];
  /** People identified with their titles */
  people?: Array<{ name: string; title: string }>;
}

// Known junk email patterns to filter out
const JUNK_EMAIL_PATTERNS = [
  /^noreply@/i,
  /^no-reply@/i,
  /^no_reply@/i,
  /^donotreply@/i,
  /^do-not-reply@/i,
  /^example@example\.com$/i,
  /^test@test\.com$/i,
  /^admin@localhost$/i,
  /^info@example\.com$/i,
  /^mail@example\.com$/i,
];

// Social platform URL patterns for categorization
const SOCIAL_PATTERNS: Record<string, RegExp> = {
  linkedin: /linkedin\.com\/company\//i,
  instagram: /instagram\.com\//i,
  facebook: /facebook\.com\//i,
  twitter: /(twitter\.com\/|x\.com\/)/i,
  tiktok: /tiktok\.com\/@/i,
  youtube: /(youtube\.com\/|youtube\.com\/@)/i,
};

// Tracking parameters to remove from URLs
const TRACKING_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'ref',
  'igshid',
  'fbclid',
  'gclid',
];

/**
 * Normalize email address
 * - Lowercase
 * - Trim whitespace
 * - Remove mailto: prefix
 * - Validate format
 * @param email - Raw email string
 * @returns Normalized email or null if invalid/junk
 */
function normalizeEmail(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return null;
  }

  let normalized = email.trim().toLowerCase();

  // Remove mailto: prefix
  normalized = normalized.replace(/^mailto:/i, '');

  // Basic validation: must contain @ and at least one . after @
  const atIndex = normalized.indexOf('@');
  if (atIndex === -1 || atIndex === 0 || atIndex === normalized.length - 1) {
    return null;
  }

  const domain = normalized.slice(atIndex + 1);
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) {
    return null;
  }

  // Check against junk patterns
  for (const pattern of JUNK_EMAIL_PATTERNS) {
    if (pattern.test(normalized)) {
      return null;
    }
  }

  return normalized;
}

/**
 * Normalize phone number to E.164 format
 * - Remove all non-digit characters except +
 * - Remove extensions
 * - Convert to E.164 format
 * @param phone - Raw phone string
 * @returns Normalized phone or null if invalid
 */
function normalizePhone(phone: string): string | null {
  if (!phone || typeof phone !== 'string') {
    return null;
  }

  let normalized = phone.trim();

  // Remove extension patterns (ext, x, ext., followed by numbers)
  normalized = normalized.replace(/\s+(ext\.?|x|extn\.?)\s*\d+$/i, '');
  normalized = normalized.replace(/\s*[-/]\s*\d+$/i, ''); // Remove trailing numbers after dash/slash

  // Remove all non-digit characters except +
  normalized = normalized.replace(/[^\d+]/g, '');

  // Remove duplicate + signs
  if (normalized.includes('+')) {
    normalized = '+' + normalized.replace(/\+/g, '');
  }

  // Handle country code detection for Indonesian numbers
  if (!normalized.startsWith('+')) {
    if (normalized.startsWith('0')) {
      // Convert 08xxx to +628xxx
      normalized = '+62' + normalized.slice(1);
    } else if (normalized.startsWith('62')) {
      normalized = '+' + normalized;
    }
  }

  // Validate length (E.164: max 15 digits including country code)
  const digitsOnly = normalized.replace(/\+/g, '');
  if (digitsOnly.length < 8 || digitsOnly.length > 15) {
    return null;
  }

  return normalized;
}

/**
 * Categorize social URL to platform
 * @param url - Social media URL
 * @returns Platform name or null if unknown
 */
function categorizeSocialUrl(url: string): string | null {
  for (const [platform, pattern] of Object.entries(SOCIAL_PATTERNS)) {
    if (pattern.test(url)) {
      return platform;
    }
  }
  return null;
}

/**
 * Normalize social URL
 * - Ensure HTTPS
 * - Remove trailing slashes
 * - Remove tracking parameters
 * @param url - Raw social URL
 * @returns Normalized URL
 */
function normalizeSocialUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  let normalized = url.trim();

  // Ensure HTTPS
  if (normalized.startsWith('http://')) {
    normalized = 'https://' + normalized.slice(7);
  } else if (!normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }

  try {
    const urlObj = new URL(normalized);

    // Remove tracking parameters
    for (const param of TRACKING_PARAMS) {
      urlObj.searchParams.delete(param);
    }

    // Remove trailing slash from pathname
    if (urlObj.pathname.endsWith('/') && urlObj.pathname.length > 1) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }

    normalized = urlObj.toString();
  } catch {
    // If URL parsing fails, do basic cleanup
    normalized = normalized.replace(/\?.*$/, ''); // Remove query string
    normalized = normalized.replace(/\/$/, ''); // Remove trailing slash
  }

  return normalized.toLowerCase();
}

/**
 * Calculate source reliability weight for confidence scoring
 * @param source - Source identifier
 * @returns Reliability weight (0.0 - 1.0)
 */
function getSourceReliability(source: string): number {
  const reliabilityMap: Record<string, number> = {
    website: 0.9,
    official: 0.95,
    directory: 0.7,
    serp: 0.5,
    scrape: 0.4,
    social: 0.6,
    linkedin: 0.75,
    google_maps: 0.8,
  };

  return reliabilityMap[source.toLowerCase()] || 0.5;
}

/**
 * Calculate confidence score based on source and data quality
 * @param source - Data source
 * @param value - Normalized value
 * @returns Confidence score (0.0 - 1.0)
 */
function calculateConfidence(source: string, value: string): number {
  const baseReliability = getSourceReliability(source);

  // Adjust based on data quality
  let qualityScore = 1.0;

  // Lower confidence for very short values
  if (value.length < 5) {
    qualityScore = 0.7;
  }

  // Higher confidence for official domains
  if (source === 'website' || source === 'official') {
    qualityScore = 1.0;
  }

  return Math.min(1.0, baseReliability * qualityScore);
}

/**
 * Deduplicate items keeping highest confidence
 * @param items - Array of items with value and confidence
 * @returns Deduplicated array
 */
function deduplicateByConfidence<T extends { value: string; confidence: number }>(
  items: T[]
): T[] {
  const seen = new Map<string, T>();

  for (const item of items) {
    const existing = seen.get(item.value);
    if (!existing || item.confidence > existing.confidence) {
      seen.set(item.value, item);
    }
  }

  return Array.from(seen.values());
}

/**
 * Normalize dan merge data dari multiple source adapters
 * @param rawDataSources - Array of raw data from different sources
 * @returns Normalized and deduplicated enrichment data
 */
export function normalizeEnrichmentData(
  rawDataSources: RawDataSource[]
): NormalizedEnrichmentData {
  const emails: NormalizedEnrichmentData['emails'] = [];
  const phones: NormalizedEnrichmentData['phones'] = [];
  const socials: NormalizedEnrichmentData['socials'] = {};
  const people: NormalizedEnrichmentData['people'] = [];

  for (const source of rawDataSources) {
    const sourceReliability = getSourceReliability(source.source);

    // Process emails
    if (source.emails) {
      for (const email of source.emails) {
        const normalized = normalizeEmail(email);
        if (normalized) {
          emails.push({
            value: normalized,
            original: email,
            source: source.source,
            confidence: calculateConfidence(source.source, normalized),
          });
        }
      }
    }

    // Process phones
    if (source.phones) {
      for (const phone of source.phones) {
        const normalized = normalizePhone(phone);
        if (normalized) {
          phones.push({
            value: normalized,
            original: phone,
            source: source.source,
            confidence: calculateConfidence(source.source, normalized),
          });
        }
      }
    }

    // Process social URLs
    if (source.socialUrls) {
      for (const url of source.socialUrls) {
        const normalized = normalizeSocialUrl(url);
        if (normalized) {
          const platform = categorizeSocialUrl(normalized);
          if (platform) {
            // Only keep the highest confidence URL for each platform
            const confidence = calculateConfidence(source.source, normalized);
            const existing = socials[platform as keyof typeof socials];
            if (!existing || confidence > 0.5) {
              (socials as Record<string, string>)[platform] = normalized;
            }
          }
        }
      }
    }

    // Process people
    if (source.people) {
      for (const person of source.people) {
        if (person.name && person.name.trim()) {
          people.push({
            name: person.name.trim(),
            title: person.title?.trim() || 'Unknown',
            source: source.source,
            confidence: sourceReliability,
          });
        }
      }
    }
  }

  // Deduplicate emails and phones by confidence
  const deduplicatedEmails = deduplicateByConfidence(emails);
  const deduplicatedPhones = deduplicateByConfidence(phones);

  // Sort by confidence descending
  deduplicatedEmails.sort((a, b) => b.confidence - a.confidence);
  deduplicatedPhones.sort((a, b) => b.confidence - a.confidence);

  return {
    emails: deduplicatedEmails,
    phones: deduplicatedPhones,
    socials,
    people,
  };
}
