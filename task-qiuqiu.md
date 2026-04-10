# Task Assignment: QIUQIU (Branch: `qiuqiu`)

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

Kamu bertanggung jawab atas **external source adapters** dari Deep Enrichment Engine (DEE):
- Social Adapter (detect LinkedIn, Instagram, Facebook profiles)
- Directory Adapter (parse YellowPages/Yelp pages)
- WHOIS Adapter (domain ownership lookup)

Fokus kamu adalah membuat **adapter yang bisa extract data dari sumber eksternal** secara reliable.

---

## 🔥 TASK 1: Social Adapter

### Goal
Buat adapter yang mendeteksi dan memvalidasi social media profiles sebuah bisnis.

### File yang harus dibuat
```
src/enrichment/sources/social-adapter.ts
```

### Yang harus diimplementasi

#### A. Social Profile Detection
Dari hasil SERP atau website HTML, identifikasi URL social media:

| Platform   | URL Pattern                        | Contoh                                      |
|------------|------------------------------------|--------------------------------------------|
| LinkedIn   | `linkedin.com/company/`            | `https://linkedin.com/company/example`     |
| Instagram  | `instagram.com/`                   | `https://instagram.com/example_bali`       |
| Facebook   | `facebook.com/`                    | `https://facebook.com/ExampleBali`         |
| Twitter/X  | `twitter.com/` atau `x.com/`      | `https://x.com/example`                    |
| TikTok     | `tiktok.com/@`                     | `https://tiktok.com/@example`              |
| YouTube    | `youtube.com/` atau `youtube.com/@`| `https://youtube.com/@example`             |

#### B. URL Filtering
Filter out URL yang **bukan** profil bisnis:
- Individual posts: URL mengandung `/p/`, `/status/`, `/reel/`, `/shorts/`, `/watch?v=`
- Halaman generic: `/login`, `/signup`, `/help`, `/about` (dari platform, bukan bisnis)
- Halaman search: URL mengandung `/search`, `/explore`, `/hashtag`

#### C. URL Normalization
- Remove tracking params (`?utm_source=...`, `?ref=...`, `?igshid=...`)
- Remove trailing slash
- Ensure HTTPS
- Lowercase

Contoh:
```
Input:  "http://www.Instagram.com/example_bali/?igshid=abc123"
Output: "https://instagram.com/example_bali"
```

#### D. Profile Validation (Basic)
- Fetch URL dan cek apakah return HTTP 200 (atau 3xx redirect)
- Timeout: 5 detik per URL
- Jika gagal fetch → tetap return URL tapi set `verified: false`

### Interface yang harus di-export

```typescript
export interface SocialProfile {
  platform: 'linkedin' | 'instagram' | 'facebook' | 'twitter' | 'tiktok' | 'youtube';
  url: string;
  original_url: string;      // sebelum normalisasi
  verified: boolean;          // berhasil di-fetch?
  confidence: number;         // 0.0 - 1.0
  source: string;             // dari mana URL ini ditemukan
}

export interface SocialAdapterResult {
  profiles: SocialProfile[];
  socials: {
    linkedin?: string;
    instagram?: string;
    facebook?: string;
    twitter?: string;
    tiktok?: string;
    youtube?: string;
  };
  total_found: number;
  duration_ms: number;
}

/**
 * Detect social media profiles dari list URL yang ditemukan.
 * Typically called after SERP atau website scraping.
 */
export function detectSocialProfiles(urls: string[], source: string): SocialProfile[]

/**
 * Full social detection: dari URL list + optional fetch verification.
 */
export async function enrichSocials(
  urls: string[],
  source: string,
  options?: { verify?: boolean; timeout?: number }
): Promise<SocialAdapterResult>
```

### Test
Buat file `src/enrichment/__tests__/social-adapter.test.ts` dengan test cases:
1. Detect LinkedIn company URL
2. Detect Instagram profile (filter out posts `/p/`)
3. URL normalization (remove tracking params)
4. Mix valid dan invalid URLs
5. Empty input → empty result

---

## 🔥 TASK 2: Directory Adapter

### Goal
Buat adapter yang bisa scrape halaman directory bisnis (YellowPages, Yelp) untuk extract contact info.

### File yang harus dibuat
```
src/enrichment/sources/directory-adapter.ts
```

### Yang harus diimplementasi

#### A. YellowPages Search
- Build search URL: `https://www.yellowpages.com/search?search_terms={name}&geo_location_terms={city}`
- Fetch halaman dengan User-Agent browser
- Parse HTML menggunakan Cheerio
- Extract dari result cards:
  - Business name (untuk matching)
  - Phone number
  - Address
  - Website URL (jika ada)

#### B. Yelp Search
- Build search URL: `https://www.yelp.com/search?find_desc={name}&find_loc={city}`
- Fetch dan parse HTML
- Extract dari result cards:
  - Business name
  - Phone (jika visible)
  - Rating
  - Address

#### C. Result Matching
Sebelum return data, **pastikan result cocok** dengan bisnis yang dicari:
- Bandingkan nama bisnis (case-insensitive)
- Simple similarity: cek apakah semua kata dari search query ada di result name
- Jika tidak match → skip result tersebut

```typescript
// Simple matching example
function isMatch(searchName: string, resultName: string): boolean {
  const searchWords = searchName.toLowerCase().split(/\s+/);
  const resultLower = resultName.toLowerCase();
  // At least 60% of words harus ada di result
  const matchCount = searchWords.filter(w => resultLower.includes(w)).length;
  return matchCount / searchWords.length >= 0.6;
}
```

### Interface yang harus di-export

```typescript
export interface DirectoryEntry {
  source: 'yellowpages' | 'yelp';
  name: string;
  phone?: string;
  address?: string;
  website?: string;
  rating?: number;
  match_confidence: number;   // seberapa yakin ini bisnis yang sama (0.0 - 1.0)
}

export interface DirectoryAdapterResult {
  entries: DirectoryEntry[];
  phones: string[];           // aggregated unique phones
  websites: string[];         // aggregated unique websites
  duration_ms: number;
}

/**
 * Search bisnis di YellowPages.
 */
export async function searchYellowPages(
  name: string,
  city: string
): Promise<DirectoryEntry[]>

/**
 * Search bisnis di Yelp.
 */
export async function searchYelp(
  name: string,
  city: string
): Promise<DirectoryEntry[]>

/**
 * Search di semua directories secara parallel.
 */
export async function searchDirectories(
  name: string,
  city: string
): Promise<DirectoryAdapterResult>
```

### Error Handling
- Timeout: 15 detik per directory
- Gunakan `AbortController`
- Jika satu directory gagal → tetap return hasil dari yang lain
- Jangan throw error — selalu return result (bisa empty)
- Set User-Agent yang realistis

### Cheerio Usage
Cheerio sudah terinstall di project. Gunakan seperti ini:
```typescript
import * as cheerio from 'cheerio';

const $ = cheerio.load(html);
$('.result-card').each((_, el) => {
  const name = $(el).find('.business-name').text().trim();
  const phone = $(el).find('.phones').text().trim();
  // dll...
});
```

### Test
Buat file `src/enrichment/__tests__/directory-adapter.test.ts` dengan test cases:
1. Parse sample YellowPages HTML (hardcode sample HTML string)
2. Parse sample Yelp HTML
3. Name matching (match dan non-match)
4. Merge results dari 2 directories
5. Handle empty/error responses

---

## 🔥 TASK 3: WHOIS Adapter

### Goal
Buat adapter yang melakukan WHOIS lookup untuk mendapatkan informasi domain ownership.

### File yang harus dibuat
```
src/enrichment/sources/whois-adapter.ts
```

### Yang harus diimplementasi

#### A. WHOIS Lookup
- Fetch WHOIS data dari public API (tidak perlu install package)
- Gunakan free API: `https://whois.freeaitools.me/?domain={domain}` atau alternatif
- Parse response untuk extract informasi berguna

#### B. Data Extraction
Dari WHOIS response, extract:
- **Registrant name** (bisa jadi nama pemilik bisnis)
- **Registrant email** (bisa jadi email kontak)
- **Registration date** (seberapa lama domain aktif)
- **Expiry date**
- **Registrar** (siapa yang hosting)
- **Name servers** (untuk detect hosting provider)

#### C. Privacy Detection
- Banyak domain pakai WHOIS privacy protection
- Detect markers: "REDACTED", "Privacy", "WhoisGuard", "Domains By Proxy"
- Jika privacy detected → set `is_private: true`, confidence rendah

### Interface yang harus di-export

```typescript
export interface WhoisResult {
  domain: string;
  is_registered: boolean;
  is_private: boolean;          // WHOIS privacy enabled?
  registrant?: {
    name?: string;
    email?: string;
    organization?: string;
  };
  registration_date?: string;   // ISO date
  expiry_date?: string;         // ISO date
  registrar?: string;
  name_servers: string[];
  domain_age_days?: number;     // calculated
  raw_data?: string;            // raw WHOIS response
  duration_ms: number;
  confidence: number;           // 0.0 - 1.0
}

/**
 * Perform WHOIS lookup untuk sebuah domain.
 * Uses free public API — rate limited.
 * Results cached for 24 hours.
 */
export async function lookupWhois(domain: string): Promise<WhoisResult>
```

### Cache Strategy
Sama seperti DNS adapter — cache in-memory:
```typescript
const cache = new Map<string, { result: WhoisResult; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 jam
```

### Error Handling
- Timeout: 10 detik
- Jika API gagal → return minimal result dengan `is_registered: false`
- Rate limiting: jika mendapat 429 → tunggu 5 detik, retry 1x
- Jangan throw error — selalu return result object

### Confidence Rules
| Condition | Confidence |
|-----------|------------|
| WHOIS data lengkap, no privacy | 0.8 |
| WHOIS partial data | 0.5 |
| WHOIS privacy enabled | 0.2 |
| WHOIS lookup gagal | 0.0 |

### Test
Buat file `src/enrichment/__tests__/whois-adapter.test.ts` dengan test cases:
1. Domain yang valid dengan data lengkap (mock response)
2. Domain dengan privacy protection
3. Domain yang tidak exist
4. Cache hit test
5. Timeout handling

---

## 📦 DEPENDENCY ORDER

```
Task 1 (Social Adapter) → bisa mulai langsung
Task 2 (Directory Adapter) → bisa mulai langsung (parallel)
Task 3 (WHOIS Adapter) → bisa mulai langsung (parallel)
```

Semua 3 task **tidak saling depend** — bisa dikerjakan parallel.

## 📁 FINAL STRUCTURE

```
src/enrichment/
├── sources/
│   ├── social-adapter.ts      ← Task 1
│   ├── directory-adapter.ts   ← Task 2
│   └── whois-adapter.ts       ← Task 3
└── __tests__/
    ├── social-adapter.test.ts
    ├── directory-adapter.test.ts
    └── whois-adapter.test.ts
```
