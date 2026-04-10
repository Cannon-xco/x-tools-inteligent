// ============================================================
// DEEP ENRICHMENT ENGINE (DEE) — Shared Type Definitions
// ============================================================

// ── Source Reliability Constants ─────────────────────────────

export const SOURCE_RELIABILITY: Record<string, number> = {
  official_website: 0.9,
  directory: 0.7,
  serp_snippet: 0.5,
  raw_scrape: 0.4,
  dns: 0.8,
  whois: 0.6,
  social: 0.6,
};

// ── Confidence ───────────────────────────────────────────────

export type ConfidenceStatus = 'VERIFIED' | 'LOW_CONFIDENCE' | 'DISCARDED';
export type FieldType = 'email' | 'phone' | 'social' | 'person';

export interface ConfidenceResult {
  value: string;
  field: FieldType;
  confidence: number;
  status: ConfidenceStatus;
  sources: Array<{ name: string; reliability: number }>;
}

// ── Cross-Validation ─────────────────────────────────────────

export interface CrossValidationResult {
  field: string;
  value: string;
  matchCount: number;
  matchingSources: string[];
  boostScore: number;
}

export interface CrossValidationEntry {
  value: string;
  source: string;
}

// ── Deep Enrichment Input/Output ─────────────────────────────

export interface DeepEnrichInput {
  leadId: number;
  name: string;
  address: string;
  domain?: string;
  phone?: string;
  niche?: string;
}

export interface DeepEnrichResult {
  leadId: number;
  emails: ConfidenceResult[];
  phones: ConfidenceResult[];
  socials: {
    linkedin?: string;
    instagram?: string;
    facebook?: string;
    twitter?: string;
    tiktok?: string;
    youtube?: string;
  };
  people: Array<{ name: string; title: string; confidence: number }>;
  overallConfidence: number;
  sources_used: string[];
  duration_ms: number;
  enriched_at: string;
}

// ── Website Adapter ──────────────────────────────────────────

export interface ExtractedContact {
  value: string;
  source: string;
  confidence: number;
}

export interface WebsiteAdapterResult {
  emails: ExtractedContact[];
  phones: ExtractedContact[];
  socials: {
    linkedin?: string;
    instagram?: string;
    facebook?: string;
    twitter?: string;
    tiktok?: string;
    youtube?: string;
  };
  people: Array<{ name: string; title: string; confidence: number }>;
  raw_html_length: number;
  fetch_method: 'fetch' | 'playwright' | 'provided';
  duration_ms: number;
}

// ── SERP Adapter ─────────────────────────────────────────────

export interface SerpSnippet {
  text: string;
  url: string;
  source: 'yahoo' | 'duckduckgo';
}

export interface SerpResult {
  officialWebsite?: string;
  socialProfiles: string[];
  directoryListings: string[];
  snippets: SerpSnippet[];
  duration_ms: number;
}

// ── Queue / Job ──────────────────────────────────────────────

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface DeeJob {
  id: string;
  input: DeepEnrichInput;
  status: JobStatus;
  result?: DeepEnrichResult;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}
