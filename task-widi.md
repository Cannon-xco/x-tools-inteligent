# Task Assignment: WIDI (Lead / Branch: `widi`)

## ⚙️ RULES — BACA SEBELUM MULAI

1. **Gunakan Plan Mode** di Windsurf untuk setiap task
2. **Pilih model: Kimi** sebagai AI assistant
3. ⛔ **STRICT: JANGAN mengubah, menghapus, atau memodifikasi file/logic yang sudah ada.** Semua existing code di `src/lib/`, `src/app/`, `src/types/` adalah production code. **Hanya TAMBAHKAN file baru.** Jika perlu extend types, buat file baru (misal `src/types/dee.ts`), jangan edit `src/types/index.ts`.
4. Semua file baru dibuat di dalam folder `src/enrichment/` (buat folder ini jika belum ada)
5. Setiap function harus punya JSDoc comment
6. Gunakan TypeScript strict mode
7. Jangan install package baru tanpa konfirmasi tim

---

## 📋 OVERVIEW

Kamu bertanggung jawab atas **core engine** dari Deep Enrichment Engine (DEE):
- Enhanced Website Adapter (HTML parsing, email/phone extraction)
- SERP Adapter (search engine scraping)
- Confidence Scoring Engine + Cross-Validation Engine
- Queue System (Redis + BullMQ)

Ini adalah bagian **paling teknikal dan krusial** dari sistem.

---

## 🔥 TASK 1: Enhanced Website Adapter

### Goal
Buat adapter website yang **jauh lebih powerful** dari yang ada sekarang. Fokus pada extraction email, phone, dan social dari HTML mentah.

### File yang harus dibuat
```
src/enrichment/sources/website-adapter.ts
```

### Yang harus diimplementasi

#### A. Advanced Email Extraction
- Regex standard: `user@domain.com`
- Obfuscated patterns:
  - `info [at] domain [dot] com`
  - `info(at)domain(dot)com`
  - HTML entities: `&#64;` → `@`, `&#46;` → `.`
  - URL encoded: `%40` → `@`
  - JavaScript obfuscation: `document.write('user' + '@' + 'domain.com')`
- `mailto:` link extraction
- Filter false positives (image filenames, sentry DSNs, example.com, dll.)
- Deduplicate dan lowercase

#### B. Advanced Phone Extraction
- International formats: `+62812345678`, `+1 (555) 123-4567`
- Local formats: `(021) 555-1234`, `0812-3456-7890`
- `tel:` link extraction
- WhatsApp links: `wa.me/628123456`
- Normalize ke international format (E.164 jika memungkinkan)

#### C. Enhanced Social Extraction
- Detect semua social platform dari `<a href>`:
  - LinkedIn company page
  - Instagram business profile
  - Facebook page
  - Twitter/X
  - TikTok
  - YouTube
- Filter out individual posts (`/p/`, `/status/`, `/shorts/`, `/reel/`)
- Return structured object: `{ linkedin?: string, instagram?: string, ... }`

#### D. Decision-Maker Detection (Best Effort)
- Scan untuk pattern "About Us", "Our Team", "Meet the Team"
- Extract nama + title jika ditemukan di proximity (dalam `<div>` yang sama)
- Contoh: `<h3>John Doe</h3><p>CEO & Founder</p>` → `{ name: "John Doe", title: "CEO & Founder" }`

### Interface yang harus di-export

```typescript
export interface WebsiteAdapterResult {
  emails: Array<{ value: string; source: string; confidence: number }>;
  phones: Array<{ value: string; source: string; confidence: number }>;
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
  fetch_method: 'fetch' | 'playwright';
  duration_ms: number;
}

export async function extractFromWebsite(url: string, html?: string): Promise<WebsiteAdapterResult>
```

### Dependency
- Gunakan `cheerio` untuk HTML parsing (sudah ada di project)
- Boleh reuse logic fetching dari `src/lib/enrich/website.ts` sebagai **referensi**, tapi buat implementasi sendiri di file baru

### Test
Buat file `src/enrichment/__tests__/website-adapter.test.ts` dengan minimal 5 test cases.

---

## 🔥 TASK 2: SERP Adapter

### Goal
Buat adapter untuk scraping hasil search engine (Yahoo/DuckDuckGo) dan extract informasi bisnis.

### File yang harus dibuat
```
src/enrichment/sources/serp-adapter.ts
```

### Yang harus diimplementasi

#### A. Yahoo Search Scraping
- Fetch `https://search.yahoo.com/search?p={query}`
- Parse HTML results menggunakan Cheerio
- Extract URLs dari Yahoo redirect structure (`/RU=...`)
- Kategorikan hasil:
  - Official website
  - Social media profiles
  - Directory listings (YellowPages, Yelp, dll.)

#### B. DuckDuckGo Lite Scraping
- Fetch `https://lite.duckduckgo.com/lite/?q={query}`
- Parse HTML results (lebih simple dari Yahoo)
- Extract URLs dan snippets

#### C. Result Merging
- Gabungkan hasil dari kedua search engine
- Deduplicate URLs
- Prioritaskan: official website > social > directory

### Interface yang harus di-export

```typescript
export interface SerpResult {
  officialWebsite?: string;
  socialProfiles: string[];
  directoryListings: string[];
  snippets: Array<{ text: string; url: string; source: 'yahoo' | 'duckduckgo' }>;
  duration_ms: number;
}

export async function searchBusiness(
  businessName: string,
  location: string,
  queries?: string[]
): Promise<SerpResult>
```

### Filter Domains
Reuse konsep dari `src/lib/enrich/search-engine.ts` — filter domain directory:
- tripadvisor.com, yelp.com, agoda.com, booking.com, yellowpages.com, dll.

### Error Handling
- Timeout 15 detik per request (AbortController)
- Jika Yahoo gagal, fallback ke DuckDuckGo
- Jika keduanya gagal, return empty result (jangan throw)

### Test
Buat file `src/enrichment/__tests__/serp-adapter.test.ts`

---

## 🔥 TASK 3: Confidence Scoring + Cross-Validation + Queue System

### Goal
Buat engine yang menilai kepercayaan data dari multiple sources, dan queue system untuk background processing.

### Files yang harus dibuat
```
src/enrichment/scoring/confidence-engine.ts
src/enrichment/scoring/cross-validator.ts
src/enrichment/queue/dee-queue.ts
src/enrichment/queue/dee-worker.ts
src/enrichment/types.ts
```

### A. Confidence Scoring Engine (`confidence-engine.ts`)

Formula:
```
confidence = (sourceReliability × 0.4) + (fieldMatch × 0.3) + (freshness × 0.2) + (crossValidation × 0.1)
```

Source Reliability Weights:
| Source | Weight |
|--------|--------|
| Official website | 0.9 |
| Directory (YellowPages, Yelp) | 0.7 |
| SERP snippet | 0.5 |
| Raw scrape | 0.4 |

Thresholds:
| Score | Action |
|-------|--------|
| ≥ 0.75 | Auto commit (verified) |
| 0.50 – 0.74 | Mark LOW_CONFIDENCE |
| < 0.50 | Discard |

```typescript
export interface ConfidenceResult {
  value: string;
  field: 'email' | 'phone' | 'social' | 'person';
  confidence: number;
  status: 'VERIFIED' | 'LOW_CONFIDENCE' | 'DISCARDED';
  sources: Array<{ name: string; reliability: number }>;
}

export function calculateConfidence(
  field: string,
  value: string,
  sources: Array<{ name: string; reliability: number; timestamp: Date }>,
  crossValidationScore: number
): ConfidenceResult
```

### B. Cross-Validation Engine (`cross-validator.ts`)

Compare data across multiple sources:
- Same email dari 2+ sources → boost +0.2
- Email domain matches business website domain → boost +0.15
- Phone appears in website AND directory → boost +0.2
- Name + city match across sources → boost +0.1

```typescript
export interface CrossValidationResult {
  field: string;
  value: string;
  matchCount: number;
  matchingSources: string[];
  boostScore: number;
}

export function validateAcrossSources(
  field: string,
  entries: Array<{ value: string; source: string }>
): CrossValidationResult
```

### C. Queue System (`dee-queue.ts` + `dee-worker.ts`)

Setup menggunakan **BullMQ + Redis** (atau fallback ke in-memory queue jika Redis tidak tersedia):

```typescript
// dee-queue.ts
export async function addDeepEnrichJob(leadId: number, data: DeepEnrichInput): Promise<string>
export async function getJobStatus(jobId: string): Promise<JobStatus>

// dee-worker.ts
// Worker yang process jobs: run semua adapters → normalize → validate → score → save
```

Flow:
```
addDeepEnrichJob() → Queue → Worker picks up → Run pipeline → Save to DB → Emit event
```

**PENTING:** Jika Redis tidak available (local dev), buat fallback **in-memory queue** yang tetap bisa jalan. Jangan hard-depend ke Redis.

### D. Shared Types (`types.ts`)

```typescript
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
  socials: { linkedin?: string; instagram?: string; facebook?: string };
  people: Array<{ name: string; title: string; confidence: number }>;
  overallConfidence: number;
  sources_used: string[];
  duration_ms: number;
  enriched_at: string;
}
```

### Test
Buat file `src/enrichment/__tests__/confidence-engine.test.ts`

---

## 📦 DEPENDENCY ORDER

```
Task 1 (Website Adapter) → bisa mulai langsung
Task 2 (SERP Adapter) → bisa mulai langsung (parallel dengan Task 1)
Task 3 (Scoring + Queue) → mulai setelah Task 1 & 2 selesai, karena butuh test data dari adapters
```

## 📁 FINAL STRUCTURE

```
src/enrichment/
├── sources/
│   ├── website-adapter.ts    ← Task 1
│   └── serp-adapter.ts       ← Task 2
├── scoring/
│   ├── confidence-engine.ts  ← Task 3
│   └── cross-validator.ts    ← Task 3
├── queue/
│   ├── dee-queue.ts          ← Task 3
│   └── dee-worker.ts         ← Task 3
├── types.ts                  ← Task 3
└── __tests__/
    ├── website-adapter.test.ts
    ├── serp-adapter.test.ts
    └── confidence-engine.test.ts
```
