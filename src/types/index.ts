// ============================================================
// CORE TYPE DEFINITIONS
// Local Business Lead Generation Engine
// ============================================================

export interface BusinessListing {
  id?: number;
  hash?: string;
  place_id?: string;
  name: string;
  address: string;
  phone?: string;
  maps_url?: string;
  website?: string;
  rating?: number;
  review_count?: number;
  score?: number;
  reasons?: string[];
  enrichment?: EnrichmentData;
  outreach?: OutreachDraft;
  created_at?: string;
  updated_at?: string;
}

// ── Enrichment ──────────────────────────────────────────────

/** A provenance-tracked enriched field */
export interface EnrichedField<T = string> {
  value: T;
  source: string; // e.g. "website_scan", "google_maps", "regex"
  confidence: number; // 0..1
}

export interface SeoData {
  title?: EnrichedField<string>;
  meta_description?: EnrichedField<string>;
  has_viewport?: EnrichedField<boolean>;
  canonical_url?: EnrichedField<string>;
  h1?: EnrichedField<string>;
}

export interface WebsiteSignals {
  has_ssl?: EnrichedField<boolean>;
  has_contact_form?: EnrichedField<boolean>;
  has_booking?: EnrichedField<boolean>;
  has_social?: EnrichedField<boolean>;
  social_links?: EnrichedField<string[]>;
  emails?: EnrichedField<string[]>;
  has_phone_on_page?: EnrichedField<boolean>;
}

export interface TechData {
  detected_tech?: EnrichedField<string[]>;
  cms?: EnrichedField<string>;
  analytics?: EnrichedField<string[]>;
  frameworks?: EnrichedField<string[]>;
}

export interface EnrichmentData {
  seo?: SeoData;
  website?: WebsiteSignals;
  tech?: TechData;
  raw_url?: string;
  final_url?: string;
  status_code?: number;
  enriched_at?: string;
  errors?: string[];
  duration_ms?: number;
}

// ── Scoring ──────────────────────────────────────────────────

export interface ScoringResult {
  score: number;
  reasons: string[];
  max_possible: number;
}

export type ScoringOperator = 'lt' | 'gt' | 'eq' | 'lte' | 'gte' | 'neq';

export interface ScoringRule {
  id: string;
  field: string;
  operator: ScoringOperator;
  value: string | number | boolean;
  score: number;
  reason: string;
  enabled?: boolean;
}

export interface ScoringConfig {
  version: string;
  description?: string;
  rules: ScoringRule[];
}

// ── AI / Outreach ────────────────────────────────────────────

export interface OutreachDraft {
  subject: string;
  body: string;
  generated_at: string;
  source: 'ai' | 'template';
  model?: string;
}

export interface OutreachRequest {
  business_name: string;
  niche: string;
  location?: string;
  reasons: string[];
  website?: string;
  rating?: number;
  review_count?: number;
}

// ── Search / API ─────────────────────────────────────────────

export interface SearchRequest {
  keyword: string;
  location: string;
  limit?: number;
}

export interface SearchResult {
  businesses: BusinessListing[];
  total: number;
  duration_ms: number;
  source: string;
}

// ── Logging ──────────────────────────────────────────────────

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  id?: number;
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

// ── Database ─────────────────────────────────────────────────

export interface DbLead {
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
  reasons: string | null; // JSON
  enrichment_json: string | null; // JSON
  outreach_json: string | null; // JSON
  created_at: string;
  updated_at: string;
}

// ── Export ───────────────────────────────────────────────────

export interface ExportRow {
  id: number;
  name: string;
  address: string;
  phone: string;
  maps_url: string;
  website: string;
  rating: string;
  review_count: string;
  score: string;
  reasons: string;
  has_ssl: string;
  has_booking: string;
  has_social: string;
  emails: string;
  detected_tech: string;
  outreach_subject: string;
  outreach_body: string;
  created_at: string;
}

// ── API Responses ─────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
