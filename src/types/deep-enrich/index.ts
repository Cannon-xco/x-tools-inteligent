// ============================================================
// DEEP ENRICHMENT TYPES — Deep Enrichment Engine (DEE)
// Extension types for deep enrichment functionality
// ============================================================

/**
 * Contact source types for deep enrichment
 */
export type DeepEnrichSource = 'website' | 'serp' | 'directory' | 'social' | 'dns' | 'whois';

/**
 * Status of deep enrichment for a lead.
 * Matches the `enrichment_status` column values in the DB.
 */
export type DeepEnrichStatus = 'processing' | 'completed' | 'failed' | 'limit_reached' | 'not_started';

/**
 * Email verification status
 */
export type EmailVerificationStatus = 'VERIFIED' | 'UNVERIFIED' | 'CATCH_ALL' | 'INVALID';

/**
 * Phone verification status
 */
export type PhoneVerificationStatus = 'VERIFIED' | 'UNVERIFIED' | 'INVALID';

/**
 * Deep enriched email entry
 */
export interface DeepEnrichEmail {
  /** Email address value */
  value: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** Verification status */
  status: EmailVerificationStatus;
  /** Sources where this email was found */
  sources: DeepEnrichSource[];
}

/**
 * Deep enriched phone entry
 */
export interface DeepEnrichPhone {
  /** Phone number value */
  value: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** Verification status */
  status: PhoneVerificationStatus;
  /** Sources where this phone was found */
  sources: DeepEnrichSource[];
}

/**
 * Social media links found during deep enrichment
 */
export interface DeepEnrichSocials {
  /** LinkedIn company page URL */
  linkedin?: string;
  /** Instagram profile URL */
  instagram?: string;
  /** Facebook page URL */
  facebook?: string;
  /** Twitter/X profile URL */
  twitter?: string;
  /** YouTube channel URL */
  youtube?: string;
  /** TikTok profile URL */
  tiktok?: string;
  /** Pinterest profile URL */
  pinterest?: string;
  /** GitHub organization URL */
  github?: string;
}

/**
 * Person/Contact found during deep enrichment
 */
export interface DeepEnrichPerson {
  /** Person's full name */
  name: string;
  /** Job title or role */
  title?: string;
  /** Email address if found */
  email?: string;
  /** LinkedIn profile URL */
  linkedin?: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** Sources where this person was found */
  sources?: DeepEnrichSource[];
}

/**
 * Complete deep enrichment result for a lead
 */
export interface DeepEnrichResult {
  /** Lead ID */
  leadId: number;
  /** Found emails with metadata */
  emails: DeepEnrichEmail[];
  /** Found phone numbers with metadata */
  phones: DeepEnrichPhone[];
  /** Social media links */
  socials: DeepEnrichSocials;
  /** Key people/contacts found */
  people: DeepEnrichPerson[];
  /** Overall confidence score 0-1 */
  overallConfidence: number;
  /** Sources that were used in enrichment */
  sources_used: DeepEnrichSource[];
  /** Duration of enrichment in milliseconds */
  duration_ms: number;
  /** ISO timestamp when enriched */
  enriched_at: string;
}

/**
 * Summary statistics for deep enrichment
 */
export interface DeepEnrichSummary {
  /** Number of emails found */
  emails_found: number;
  /** Number of phones found */
  phones_found: number;
  /** Number of social links found */
  socials_found: number;
  /** Number of people found */
  people_found: number;
}

/**
 * Deep enrichment status response
 */
export interface DeepEnrichStatusResponse {
  /** Lead ID */
  leadId: number;
  /** Current enrichment status */
  status: DeepEnrichStatus;
  /** When enrichment was completed (if applicable) */
  enriched_at?: string;
  /** Overall confidence score */
  overallConfidence?: number;
  /** Summary of found data */
  summary: DeepEnrichSummary;
}

/**
 * Request options for deep enrichment
 */
export interface DeepEnrichOptions {
  /** Sources to use for enrichment (default: all) */
  sources?: DeepEnrichSource[];
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Force re-enrichment even if already enriched */
  force?: boolean;
}

/**
 * POST request body for deep enrichment
 */
export interface DeepEnrichRequestBody {
  /** Lead ID to enrich */
  id: number;
  /** Optional enrichment options */
  options?: DeepEnrichOptions;
}

/**
 * API Response wrapper for deep enrichment
 */
export interface DeepEnrichApiResponse<T = unknown> {
  /** Success flag */
  success: boolean;
  /** Response data (if success) */
  data?: T;
  /** Error message (if failed) */
  error?: string;
  /** Optional message */
  message?: string;
}

/**
 * Extended DbLead with deep enrichment fields
 */
export interface DbLeadWithDeepEnrich {
  id: number;
  hash: string;
  place_id: string | null;
  name: string;
  address: string;
  phone: string | null;
  maps_url: string | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  score: number | null;
  reasons: string | null;
  enrichment_json: string | null;
  outreach_json: string | null;
  /** Deep enrichment result JSON string */
  deep_enrichment_json?: string | null;
  /** When deep enrichment was completed */
  deep_enriched_at?: string | null;
  created_at: string;
  updated_at: string;
}
