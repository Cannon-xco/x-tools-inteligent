# Task Assignment: PRAYOGA (Branch: `prayoga`)

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

Kamu bertanggung jawab atas **discovery dan fallback** dari Deep Enrichment Engine (DEE):
- Hypothesis Generation (smart search query builder)
- DNS Adapter (MX record lookup, domain validation)
- Fallback Strategy (error handling chain)

Fokus kamu adalah membangun **strategi pencarian yang cerdas** dan **mekanisme fallback yang robust**.

---

## 🔥 TASK 1: Hypothesis Generation Module

### Goal
Buat modul yang generate search queries cerdas untuk menemukan informasi bisnis dari berbagai sumber.

### File yang harus dibuat
```
src/enrichment/pipeline/hypothesis-generator.ts
```

### Yang harus diimplementasi

#### A. Query Templates
Buat 5 template query yang berbeda untuk setiap bisnis:

```typescript
// Contoh untuk bisnis "Warung Makan Sederhana" di "Denpasar"
const queries = [
  '"Warung Makan Sederhana" Denpasar contact',
  '"Warung Makan Sederhana" email',
  'site:linkedin.com/company "Warung Makan Sederhana"',
  'site:instagram.com "Warung Makan Sederhana"',
  'sederhana.com contact',   // jika domain diketahui
];
```

#### B. Query Strategy
- Jika `domain` tersedia: tambahkan query `"[domain] contact"` dan `"[domain] about"`
- Jika `niche` tersedia: tambahkan query `"[name] [niche] [city] phone email"`
- Jika nama bisnis panjang (> 3 kata): buat variant pendek juga
- Max 7 queries per bisnis (untuk hemat rate limit)

#### C. Query Prioritization
- Beri priority score 1-5 ke setiap query (5 = paling mungkin dapat hasil)
- Sort queries by priority sebelum return

### Interface yang harus di-export

```typescript
export interface SearchHypothesis {
  query: string;
  priority: number;       // 1-5, higher = better
  target: 'general' | 'email' | 'social' | 'website' | 'phone';
  rationale: string;      // kenapa query ini dipilih
}

/**
 * Generate smart search queries untuk menemukan informasi bisnis.
 * Return sorted by priority (highest first).
 */
export function generateHypotheses(input: {
  name: string;
  normalized_name: string;
  city: string;
  domain?: string;
  niche?: string;
  phone?: string;
}): SearchHypothesis[]
```

### Contoh Output
```typescript
[
  { query: '"Warung Sederhana" Denpasar contact email', priority: 5, target: 'general', rationale: 'Full name + city + contact keywords' },
  { query: 'site:instagram.com "Warung Sederhana"', priority: 4, target: 'social', rationale: 'Instagram discovery' },
  { query: 'site:linkedin.com/company "Warung Sederhana"', priority: 3, target: 'social', rationale: 'LinkedIn company page' },
  { query: 'warungs ederhana.com contact', priority: 3, target: 'email', rationale: 'Domain contact page' },
  { query: '"Warung Sederhana" Denpasar phone', priority: 2, target: 'phone', rationale: 'Phone number search' },
]
```

### Test
Buat file `src/enrichment/__tests__/hypothesis-generator.test.ts` dengan test cases:
1. Bisnis dengan nama pendek (1-2 kata)
2. Bisnis dengan nama panjang (> 3 kata)
3. Bisnis dengan domain tersedia
4. Bisnis tanpa domain dan tanpa niche
5. Verify sorting by priority

---

## 🔥 TASK 2: DNS Adapter

### Goal
Buat adapter yang melakukan DNS lookup untuk validasi domain dan verifikasi email.

### File yang harus dibuat
```
src/enrichment/sources/dns-adapter.ts
```

### Yang harus diimplementasi

#### A. MX Record Lookup
- Cek apakah domain memiliki MX records
- Jika ada MX records → domain bisa menerima email → valid email domain
- Return list MX records dengan priority

#### B. Domain Validation
- Cek apakah domain resolve (A record / AAAA record exists)
- Cek apakah domain redirect ke domain lain
- Return `is_valid`, `is_active`, `redirects_to`

#### C. Email Domain Verification
- Untuk setiap email yang ditemukan oleh adapter lain, verify bahwa domain-nya valid
- Gunakan MX lookup untuk ini
- Boost confidence jika domain valid, reduce jika tidak

### Implementasi

Gunakan Node.js built-in `dns` module (promises version):

```typescript
import { promises as dns } from 'dns';

// MX lookup
const mxRecords = await dns.resolveMx('example.com');

// A record
const addresses = await dns.resolve4('example.com');
```

**PENTING:** `dns` adalah built-in Node.js module, TIDAK perlu install package.

### Interface yang harus di-export

```typescript
export interface DnsResult {
  domain: string;
  is_valid: boolean;          // domain exists (has A/AAAA record)
  is_active: boolean;         // domain resolves
  has_mx: boolean;            // can receive email
  mx_records: Array<{
    exchange: string;
    priority: number;
  }>;
  a_records: string[];        // IP addresses
  redirects_to?: string;      // jika domain redirect
  duration_ms: number;
}

/**
 * Perform DNS lookup untuk validasi domain bisnis.
 * Timeout: 10 detik.
 */
export async function lookupDns(domain: string): Promise<DnsResult>

/**
 * Verify apakah email domain valid (punya MX record).
 * Quick check — hanya MX lookup.
 */
export async function verifyEmailDomain(email: string): Promise<{
  email: string;
  domain: string;
  is_valid: boolean;
  mx_host?: string;
}>
```

### Error Handling
- Timeout: 10 detik per lookup
- Jika DNS resolve gagal → `is_valid: false`, `is_active: false`
- Jangan throw error — selalu return result object
- Cache results per domain (jangan lookup domain yang sama 2x)

### Cache Strategy
Buat simple in-memory cache:
```typescript
const cache = new Map<string, { result: DnsResult; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 jam
```

### Test
Buat file `src/enrichment/__tests__/dns-adapter.test.ts` dengan test cases:
1. Domain yang valid (misal: `google.com`)
2. Domain yang tidak exist
3. Email domain verification
4. Cache hit test
5. Timeout handling

---

## 🔥 TASK 3: Fallback Strategy

### Goal
Buat modul yang mengatur **urutan fallback** ketika satu source gagal, dan retry mechanism.

### File yang harus dibuat
```
src/enrichment/pipeline/fallback-strategy.ts
```

### Yang harus diimplementasi

#### A. Source Execution Order
Definisikan urutan eksekusi source adapters:

```
Primary:    Website Adapter + SERP Adapter (parallel)
Secondary:  Directory Adapter + Social Adapter (parallel)
Tertiary:   DNS Adapter + WHOIS Adapter (parallel)
Final:      Mark as FAILED jika semua gagal
```

#### B. Retry Mechanism
- Max 2 retries per source
- Exponential backoff: `1s → 3s → 9s`
- Timeout per source: 15 detik
- Use `AbortController` untuk timeout

#### C. Fallback Chain
```
Jika Website gagal:
  → Coba SERP untuk cari website lain
  → Jika SERP gagal → skip website enrichment

Jika SERP gagal:
  → Coba DuckDuckGo (jika Yahoo gagal)
  → Jika keduanya gagal → skip SERP data

Jika semua primary gagal:
  → Tetap jalankan secondary (directory + social)
  → Tetap jalankan tertiary (DNS + WHOIS)
```

#### D. Status Tracking
Track status setiap source:

```typescript
type SourceStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'timeout';
```

### Interface yang harus di-export

```typescript
export interface FallbackConfig {
  maxRetries: number;
  timeoutMs: number;
  backoffMultiplier: number;
}

export interface SourceExecution {
  source: string;
  status: SourceStatus;
  attempts: number;
  duration_ms: number;
  error?: string;
  result?: unknown;
}

export interface PipelineExecution {
  sources: SourceExecution[];
  total_duration_ms: number;
  successful_sources: number;
  failed_sources: number;
}

/**
 * Execute a single source with retry and timeout.
 */
export async function executeWithFallback<T>(
  sourceName: string,
  fn: () => Promise<T>,
  config?: Partial<FallbackConfig>
): Promise<SourceExecution & { result?: T }>

/**
 * Execute multiple sources in parallel with fallback chain.
 */
export async function executePipeline(
  stages: Array<{
    name: string;
    sources: Array<{
      name: string;
      execute: () => Promise<unknown>;
    }>;
  }>
): Promise<PipelineExecution>
```

### Contoh Penggunaan

```typescript
const result = await executePipeline([
  {
    name: 'primary',
    sources: [
      { name: 'website', execute: () => websiteAdapter.extract(url) },
      { name: 'serp', execute: () => serpAdapter.search(name, city) },
    ],
  },
  {
    name: 'secondary',
    sources: [
      { name: 'directory', execute: () => directoryAdapter.search(name) },
      { name: 'social', execute: () => socialAdapter.detect(name) },
    ],
  },
  {
    name: 'tertiary',
    sources: [
      { name: 'dns', execute: () => dnsAdapter.lookup(domain) },
      { name: 'whois', execute: () => whoisAdapter.lookup(domain) },
    ],
  },
]);
```

### Test
Buat file `src/enrichment/__tests__/fallback-strategy.test.ts` dengan test cases:
1. Source berhasil pertama kali
2. Source berhasil setelah retry ke-2
3. Source timeout
4. Pipeline dengan mix success dan failure
5. Backoff timing (verify delay increases)

---

## 📦 DEPENDENCY ORDER

```
Task 1 (Hypothesis Generator) → bisa mulai langsung
Task 2 (DNS Adapter) → bisa mulai langsung (parallel)
Task 3 (Fallback Strategy) → bisa mulai langsung (parallel), tapi test integration butuh adapters lain
```

## 📁 FINAL STRUCTURE

```
src/enrichment/
├── pipeline/
│   ├── hypothesis-generator.ts  ← Task 1
│   └── fallback-strategy.ts     ← Task 3
├── sources/
│   └── dns-adapter.ts           ← Task 2
└── __tests__/
    ├── hypothesis-generator.test.ts
    ├── dns-adapter.test.ts
    └── fallback-strategy.test.ts
```
