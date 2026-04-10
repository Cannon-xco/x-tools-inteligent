# Task Assignment: DEKRES (Branch: `dekres`)

## ⚙️ RULES — BACA SEBELUM MULAI

1. **Gunakan Plan Mode** di Windsurf untuk setiap task
2. **Pilih model: Kimi** sebagai AI assistant
3. ⛔ **STRICT: JANGAN mengubah, menghapus, atau memodifikasi file/logic yang sudah ada.** Semua existing code di `src/lib/`, `src/app/`, `src/types/` adalah production code. **Hanya TAMBAHKAN file baru.** Jika perlu extend types, buat file baru, jangan edit file existing.
4. Semua file baru dibuat di dalam folder `src/enrichment/` (buat folder ini jika belum ada)
5. Setiap function harus punya JSDoc comment
6. Gunakan TypeScript strict mode
7. Jangan install package baru tanpa konfirmasi tim

---

## 📋 OVERVIEW

Kamu bertanggung jawab atas **data processing layer** dari Deep Enrichment Engine (DEE):
- Seed Extraction (normalisasi input data)
- Data Normalization Layer (konversi ke unified schema)
- Database Migration (extend tabel + buat tabel baru)

Fokus kamu adalah memastikan data yang masuk dan keluar dari sistem **bersih, konsisten, dan terstruktur**.

---

## 🔥 TASK 1: Seed Extraction Module

### Goal
Buat modul yang menerima raw lead data dan menormalisasi semua field sebelum masuk ke enrichment pipeline.

### File yang harus dibuat
```
src/enrichment/pipeline/seed-extractor.ts
```

### Yang harus diimplementasi

#### A. Name Normalization
- Lowercase semua input
- Remove special characters (kecuali `&`, `-`, `'` yang valid dalam nama bisnis)
- Trim whitespace berlebih
- Remove common suffixes yang tidak relevan: `LLC`, `Inc`, `PT`, `CV`, `Ltd`
- Generate `normalized_name` untuk matching

Contoh:
```
Input:  "  PT. EXAMPLE CAFÉ & Restaurant, LLC  "
Output: "example café & restaurant"
normalized_name: "example cafe restaurant"
```

#### B. Address Normalization
- Trim dan lowercase
- Normalize abbreviations: `St.` → `street`, `Ave.` → `avenue`, `Jl.` → `jalan`
- Extract `city` dari address jika belum ada (pattern: kota setelah koma terakhir)

#### C. Domain Extraction
- Jika ada URL: extract domain murni (tanpa `www.`, tanpa path)
- Contoh: `https://www.example.com/about` → `example.com`

#### D. Phone Normalization
- Remove semua non-digit kecuali `+`
- Detect country code jika ada
- Output format: `+628123456789`

### Interface yang harus di-export

```typescript
export interface SeedData {
  original_name: string;
  normalized_name: string;      // untuk fuzzy matching
  display_name: string;         // untuk display (trimmed tapi tetap proper case)
  address: string;
  city: string;
  domain?: string;              // extracted dari URL
  phone?: string;               // normalized
  niche?: string;
}

/**
 * Normalize raw lead data menjadi clean seed untuk enrichment pipeline
 */
export function extractSeed(input: {
  name: string;
  address: string;
  phone?: string;
  website?: string;
  niche?: string;
}): SeedData
```

### Test
Buat file `src/enrichment/__tests__/seed-extractor.test.ts` dengan test cases:
1. Nama dengan special chars dan spasi berlebih
2. Nama dengan suffix (LLC, PT, dll.)
3. URL ke domain extraction
4. Phone normalization berbagai format
5. Address dengan abbreviasi

---

## 🔥 TASK 2: Data Normalization Layer

### Goal
Buat layer yang mengkonversi raw data dari **berbagai source adapters** ke dalam satu **unified schema** yang konsisten.

### File yang harus dibuat
```
src/enrichment/pipeline/normalizer.ts
```

### Yang harus diimplementasi

#### A. Email Normalization
- Lowercase semua
- Remove leading/trailing whitespace
- Remove mailto: prefix jika ada
- Validate format (harus contain `@` dan `.`)
- Filter out known junk: `noreply@`, `no-reply@`, `example@example.com`
- Deduplicate

#### B. Phone Normalization
- Convert ke E.164 format jika memungkinkan
- Remove extensions (e.g., `ext 123`)
- Deduplicate (2 phone yang sama setelah normalisasi = 1)
- Min length: 8 digits, Max length: 15 digits

#### C. Social URL Normalization
- Remove trailing slashes
- Remove tracking parameters (`?utm_source=...`, `?ref=...`)
- Ensure HTTPS
- Categorize ke platform: `linkedin`, `instagram`, `facebook`, `twitter`, `tiktok`, `youtube`

#### D. Deduplication Engine
- Untuk setiap field type, deduplicate berdasarkan normalized value
- Jika duplicate ditemukan, **keep yang confidence-nya lebih tinggi**

### Interface yang harus di-export

```typescript
export interface NormalizedEnrichmentData {
  emails: Array<{
    value: string;
    original: string;
    source: string;
    confidence: number;
  }>;
  phones: Array<{
    value: string;          // E.164 format
    original: string;       // as found
    source: string;
    confidence: number;
  }>;
  socials: {
    linkedin?: string;
    instagram?: string;
    facebook?: string;
    twitter?: string;
    tiktok?: string;
    youtube?: string;
  };
  people: Array<{
    name: string;
    title: string;
    source: string;
    confidence: number;
  }>;
}

/**
 * Normalize dan merge data dari multiple source adapters
 */
export function normalizeEnrichmentData(
  rawDataSources: Array<{
    source: string;
    emails?: string[];
    phones?: string[];
    socialUrls?: string[];
    people?: Array<{ name: string; title: string }>;
  }>
): NormalizedEnrichmentData
```

### Test
Buat file `src/enrichment/__tests__/normalizer.test.ts` dengan test cases:
1. Email deduplication dan filtering
2. Phone E.164 conversion
3. Social URL cleanup
4. Merge dari 3 sources berbeda
5. Confidence-based dedup (keep highest)

---

## 🔥 TASK 3: Database Migration

### Goal
Buat schema extension dan tabel baru untuk menyimpan deep enrichment data.

### Files yang harus dibuat
```
src/enrichment/db/dee-schema.ts
src/enrichment/db/dee-queries.ts
```

### A. Schema Extension (`dee-schema.ts`)

Buat function yang menambahkan kolom baru ke tabel `leads` dan membuat tabel baru `enrichment_audit`.

**PENTING:** Gunakan `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` supaya aman dijalankan berulang kali.

```typescript
/**
 * Initialize DEE database schema.
 * Adds new columns to leads table and creates enrichment_audit table.
 * Safe to run multiple times (idempotent).
 */
export async function initDeeSchema(): Promise<void>
```

#### Extend tabel `leads` — tambahkan kolom:

| Column | Type | Description |
|--------|------|-------------|
| `verified_emails` | TEXT (JSON) | Array of verified emails with confidence |
| `verified_phones` | TEXT (JSON) | Array of verified phones with confidence |
| `verified_socials` | TEXT (JSON) | Social profiles object |
| `confidence_scores` | TEXT (JSON) | Per-field confidence scores |
| `deep_enriched_at` | TIMESTAMP | Kapan deep enrichment terakhir dijalankan |

#### Buat tabel baru `enrichment_audit`:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | SERIAL | PRIMARY KEY | Auto ID |
| `lead_id` | INTEGER | NOT NULL, REFERENCES leads(id) | Lead yang di-enrich |
| `field_name` | TEXT | NOT NULL | Nama field (email, phone, social, person) |
| `value` | TEXT | NOT NULL | Nilai yang ditemukan |
| `source` | TEXT | NOT NULL | Adapter source (website, serp, directory, dll.) |
| `confidence` | REAL | NOT NULL | Confidence score (0.0 - 1.0) |
| `status` | TEXT | NOT NULL DEFAULT 'pending' | VERIFIED / LOW_CONFIDENCE / DISCARDED |
| `raw_snippet` | TEXT | | Raw HTML/text snippet sebagai bukti |
| `created_at` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Waktu ditemukan |

Indexes:
- `idx_audit_lead_id` on `lead_id`
- `idx_audit_field` on `field_name`
- `idx_audit_confidence` on `confidence DESC`

### B. Query Helpers (`dee-queries.ts`)

```typescript
/** Save deep enrichment results to leads table */
export async function saveDeepEnrichment(leadId: number, data: {
  verified_emails: object;
  verified_phones: object;
  verified_socials: object;
  confidence_scores: object;
}): Promise<void>

/** Insert audit trail entry */
export async function insertAuditEntry(entry: {
  lead_id: number;
  field_name: string;
  value: string;
  source: string;
  confidence: number;
  status: string;
  raw_snippet?: string;
}): Promise<number>

/** Get audit trail for a specific lead */
export async function getAuditByLeadId(leadId: number): Promise<AuditEntry[]>

/** Get deep enrichment data for a lead */
export async function getDeepEnrichment(leadId: number): Promise<DeepEnrichmentRow | null>
```

**PENTING:** Import `getPool` dari `@/lib/db/client` — reuse existing connection pool, JANGAN buat pool baru.

### Test
Buat file `src/enrichment/__tests__/dee-schema.test.ts` — test bahwa schema creation idempotent.

---

## 📦 DEPENDENCY ORDER

```
Task 1 (Seed Extractor) → bisa mulai langsung, tidak butuh dependency
Task 2 (Normalizer) → bisa mulai langsung (parallel dengan Task 1)
Task 3 (Database) → bisa mulai langsung, tapi test-nya butuh DB connection
```

Semua 3 task bisa dikerjakan **parallel** karena tidak saling depend.

## 📁 FINAL STRUCTURE

```
src/enrichment/
├── pipeline/
│   ├── seed-extractor.ts     ← Task 1
│   └── normalizer.ts         ← Task 2
├── db/
│   ├── dee-schema.ts         ← Task 3
│   └── dee-queries.ts        ← Task 3
└── __tests__/
    ├── seed-extractor.test.ts
    ├── normalizer.test.ts
    └── dee-schema.test.ts
```
