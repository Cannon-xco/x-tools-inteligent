// ============================================================
// TYPE TESTS: Deep Enrichment Types
// Compile-time type assertions (no runtime test needed)
// Run: npx tsc --noEmit src/enrichment/__tests__/deep-enrich-types.ts
// ============================================================

import type {
  DeepEnrichRequestBody,
  DeepEnrichOptions,
  DeepEnrichResult,
  DeepEnrichStatusResponse,
  DeepEnrichApiResponse,
  DeepEnrichEmail,
  DeepEnrichPhone,
  DeepEnrichSocials,
  DeepEnrichPerson,
  DeepEnrichSource,
  DeepEnrichStatus,
  EmailVerificationStatus,
  PhoneVerificationStatus,
  DeepEnrichSummary,
  DbLeadWithDeepEnrich,
} from '@/types/deep-enrich';

// ── Type Assertions ─────────────────────────────────────────

// Valid: All source types
const allSources: DeepEnrichSource[] = [
  'website',
  'serp',
  'directory',
  'social',
  'dns',
  'whois',
];

// Valid: All status types
const allStatuses: DeepEnrichStatus[] = [
  'pending',
  'enriched',
  'failed',
  'not_started',
];

// Valid: Email verification statuses
const emailStatuses: EmailVerificationStatus[] = [
  'VERIFIED',
  'UNVERIFIED',
  'CATCH_ALL',
  'INVALID',
];

// Valid: Phone verification statuses
const phoneStatuses: PhoneVerificationStatus[] = [
  'VERIFIED',
  'UNVERIFIED',
  'INVALID',
];

// Valid: Request body minimal
const minimalRequest: DeepEnrichRequestBody = {
  id: 123,
};

// Valid: Request body dengan options
const fullRequest: DeepEnrichRequestBody = {
  id: 456,
  options: {
    sources: ['website', 'serp'],
    timeout: 30000,
    force: true,
  },
};

// Valid: Email entry
const validEmail: DeepEnrichEmail = {
  value: 'test@example.com',
  confidence: 0.95,
  status: 'VERIFIED',
  sources: ['website', 'serp'],
};

// Valid: Phone entry
const validPhone: DeepEnrichPhone = {
  value: '+628123456789',
  confidence: 0.85,
  status: 'VERIFIED',
  sources: ['website'],
};

// Valid: Social links
const validSocials: DeepEnrichSocials = {
  linkedin: 'https://linkedin.com/company/test',
  instagram: 'https://instagram.com/test',
  facebook: 'https://facebook.com/test',
  twitter: 'https://twitter.com/test',
  youtube: 'https://youtube.com/test',
  tiktok: 'https://tiktok.com/@test',
  pinterest: 'https://pinterest.com/test',
  github: 'https://github.com/test',
};

// Valid: Person entry
const validPerson: DeepEnrichPerson = {
  name: 'John Doe',
  title: 'Owner',
  email: 'john@example.com',
  linkedin: 'https://linkedin.com/in/johndoe',
  confidence: 0.8,
  sources: ['website', 'social'],
};

// Valid: Complete result
const validResult: DeepEnrichResult = {
  leadId: 123,
  emails: [validEmail],
  phones: [validPhone],
  socials: validSocials,
  people: [validPerson],
  overallConfidence: 0.82,
  sources_used: ['website', 'serp', 'dns'],
  duration_ms: 8500,
  enriched_at: '2025-04-10T14:30:00.000Z',
};

// Valid: Empty result
const emptyResult: DeepEnrichResult = {
  leadId: 456,
  emails: [],
  phones: [],
  socials: {},
  people: [],
  overallConfidence: 0,
  sources_used: [],
  duration_ms: 0,
  enriched_at: new Date().toISOString(),
};

// Valid: Summary
const validSummary: DeepEnrichSummary = {
  emails_found: 2,
  phones_found: 1,
  socials_found: 3,
  people_found: 1,
};

// Valid: Status response - enriched
const enrichedStatus: DeepEnrichStatusResponse = {
  leadId: 123,
  status: 'enriched',
  enriched_at: '2025-04-10T14:30:00.000Z',
  overallConfidence: 0.82,
  summary: validSummary,
};

// Valid: Status response - not started
const notStartedStatus: DeepEnrichStatusResponse = {
  leadId: 456,
  status: 'not_started',
  summary: {
    emails_found: 0,
    phones_found: 0,
    socials_found: 0,
    people_found: 0,
  },
};

// Valid: API success response
const successResponse: DeepEnrichApiResponse<DeepEnrichResult> = {
  success: true,
  data: validResult,
};

// Valid: API error response
const errorResponse: DeepEnrichApiResponse = {
  success: false,
  error: 'Lead 123 not found',
};

// Valid: API response with message
const messageResponse: DeepEnrichApiResponse<DeepEnrichResult> = {
  success: true,
  data: validResult,
  message: 'Returning cached enrichment data',
};

// Valid: Extended DbLead
const leadWithDeepEnrich: DbLeadWithDeepEnrich = {
  id: 1,
  hash: 'abc123',
  place_id: 'place_123',
  name: 'Test Business',
  address: '123 Main St',
  phone: '+1234567890',
  maps_url: 'https://maps.google.com/...',
  website: 'https://example.com',
  rating: 4.5,
  review_count: 100,
  score: 75,
  reasons: JSON.stringify(['Has website', 'High rating']),
  enrichment_json: JSON.stringify({ enriched_at: new Date().toISOString() }),
  outreach_json: null,
  deep_enrichment_json: JSON.stringify(validResult),
  deep_enriched_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ── Export untuk prevent unused variable warnings ────────────

export {
  allSources,
  allStatuses,
  emailStatuses,
  phoneStatuses,
  minimalRequest,
  fullRequest,
  validEmail,
  validPhone,
  validSocials,
  validPerson,
  validResult,
  emptyResult,
  validSummary,
  enrichedStatus,
  notStartedStatus,
  successResponse,
  errorResponse,
  messageResponse,
  leadWithDeepEnrich,
};
