# X-Tools Intelligent — Project Overview

> **AI-powered Local Business Lead Generation Engine**
> Source, enrich, score, dan outreach bisnis lokal secara otomatis.

---

## Table of Contents

1. [Project Summary](#1-project-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Directory Structure](#3-directory-structure)
4. [Data Pipeline (Core Flow)](#4-data-pipeline-core-flow)
5. [API Reference](#5-api-reference)
6. [Database Schema](#6-database-schema)
7. [Scoring System](#7-scoring-system)
8. [Enrichment Detail](#8-enrichment-detail)
9. [AI Outreach System](#9-ai-outreach-system)
10. [Frontend / Dashboard](#10-frontend--dashboard)
11. [Environment Variables](#11-environment-variables)
12. [Deployment & Infrastructure](#12-deployment--infrastructure)
13. [Test Files](#13-test-files)

---

## 1. Project Summary

| Field           | Value                                                              |
| --------------- | ------------------------------------------------------------------ |
| **Package name** | `saas-local-business-lead`                                        |
| **Repo name**    | `x-tools-inteligent`                                              |
| **Version**      | `0.1.0`                                                           |
| **Framework**    | Next.js 16.2.3 (App Router, standalone output)                    |
| **Runtime**      | Node.js 20                                                        |
| **Language**     | TypeScript 5                                                      |
| **UI**           | React 19, TailwindCSS 4, Geist font family                       |
| **Database**     | PostgreSQL (via `pg` driver)                                      |
| **Scraping**     | Playwright (Chromium), Cheerio                                    |
| **AI Provider**  | OpenRouter API (default model: `z-ai/glm-5.1`)                   |
| **Deployment**   | Docker multi-stage → Railway                                      |

### Apa yang dilakukan project ini?

Project ini adalah **SaaS lead generation engine** yang secara otomatis:

1. **Mencari** bisnis lokal dari Google Maps berdasarkan keyword + lokasi
2. **Memperkaya** data dengan crawling website bisnis (SEO, tech stack, signals)
3. **Menilai** kualitas lead dengan scoring engine berbasis rules
4. **Membuat** draft email outreach menggunakan AI

Semua proses dapat dilakukan dari satu dashboard web, dan hasilnya bisa di-export ke CSV.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      NEXT.JS MONOLITH                       │
│                   (App Router, Standalone)                   │
├──────────────────┬──────────────────────────────────────────┤
│   FRONTEND       │              BACKEND (API Routes)        │
│                  │                                          │
│  /dashboard      │  POST /api/scrape-leads  ← Orchestrator │
│  (React 19 SPA)  │  POST /api/search        ← Maps only    │
│                  │  GET  /api/leads          ← List leads   │
│                  │  DELETE /api/leads        ← Delete       │
│                  │  POST /api/enrich         ← Single       │
│                  │  PUT  /api/enrich         ← Bulk         │
│                  │  POST /api/score          ← Score lead   │
│                  │  GET  /api/score          ← Get rules    │
│                  │  POST /api/outreach       ← AI email     │
│                  │  GET  /api/export         ← CSV          │
│                  │  GET  /api/health         ← Health       │
│                  │  GET  /api/ping           ← Ping         │
├──────────────────┴──────────────────────────────────────────┤
│                        LIB MODULES                          │
│                                                             │
│  lib/maps/scraper.ts     → Google Maps Playwright scraper   │
│  lib/enrich/website.ts   → Website crawling orchestrator    │
│  lib/enrich/seo.ts       → SEO signal extraction            │
│  lib/enrich/tech.ts      → Technology detection             │
│  lib/enrich/search-engine.ts → Yahoo search fallback        │
│  lib/scoring/engine.ts   → Rule-based lead scoring          │
│  lib/ai/generator.ts     → AI outreach email generator      │
│  lib/db/client.ts        → PostgreSQL client + CRUD         │
├─────────────────────────────────────────────────────────────┤
│                     EXTERNAL SERVICES                       │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Google Maps   │  │  PostgreSQL  │  │  OpenRouter API  │  │
│  │ (Playwright)  │  │  (Railway)   │  │  (AI Generation) │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│  ┌──────────────┐                                           │
│  │ Yahoo Search  │                                          │
│  │ (Fallback)    │                                          │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

- **Standalone output** — Next.js di-build sebagai standalone untuk Docker deployment yang ringan
- **Monolith** — Semua logic (scraping, enrichment, scoring, AI) dalam satu app untuk kemudahan deploy
- **Tiered fetching** — `fetch()` → Playwright fallback untuk enrichment, mengoptimalkan speed vs coverage
- **Concurrency control** — `p-limit` untuk membatasi parallel scraping (default 3 concurrent)
- **Provenance tracking** — Setiap enriched field memiliki `source` dan `confidence` score

---

## 3. Directory Structure

```
x-tools-inteligent/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout (dark theme, Geist fonts)
│   │   ├── page.tsx                  # Root page → redirect ke /dashboard
│   │   ├── globals.css               # Global styles (TailwindCSS 4)
│   │   ├── favicon.ico
│   │   ├── dashboard/
│   │   │   └── page.tsx              # Main dashboard UI (1107 lines, client component)
│   │   └── api/
│   │       ├── scrape-leads/route.ts # Integrated orchestrator endpoint
│   │       ├── search/route.ts       # Google Maps search endpoint
│   │       ├── leads/route.ts        # CRUD leads endpoint
│   │       ├── enrich/route.ts       # Website enrichment endpoint
│   │       ├── score/route.ts        # Lead scoring endpoint
│   │       ├── outreach/route.ts     # AI outreach endpoint
│   │       ├── export/route.ts       # CSV export endpoint
│   │       ├── health/route.ts       # Health check
│   │       └── ping/route.ts         # Simple ping (Railway healthcheck)
│   ├── lib/                          # Core business logic
│   │   ├── maps/
│   │   │   └── scraper.ts            # Google Maps Playwright scraper
│   │   ├── enrich/
│   │   │   ├── website.ts            # Website enrichment orchestrator
│   │   │   ├── seo.ts                # SEO signal extraction
│   │   │   ├── tech.ts               # Technology/CMS detection
│   │   │   └── search-engine.ts      # Yahoo search fallback discovery
│   │   ├── scoring/
│   │   │   └── engine.ts             # Configurable rule-based scoring
│   │   ├── ai/
│   │   │   └── generator.ts          # AI outreach email generator
│   │   └── db/
│   │       └── client.ts             # PostgreSQL client (singleton Pool)
│   └── types/
│       └── index.ts                  # Semua TypeScript type definitions
├── data/
│   └── leads.db*                     # Legacy SQLite files (tidak digunakan lagi)
├── public/                           # Static assets (SVG icons)
├── scoring-rules.json                # Configurable scoring rules
├── Dockerfile                        # Multi-stage Docker build
├── railway.json                      # Railway deployment config
├── next.config.ts                    # Next.js config (standalone, external packages)
├── package.json                      # Dependencies & scripts
├── tsconfig.json                     # TypeScript config
├── postcss.config.mjs                # PostCSS (TailwindCSS)
├── eslint.config.mjs                 # ESLint config
├── test-ddg.js                       # Manual test: DuckDuckGo parsing
├── test-yahoo-parse.js               # Manual test: Yahoo HTML parsing
└── test-yahoo.js                     # Manual test: Yahoo search fetch
```

---

## 4. Data Pipeline (Core Flow)

Pipeline utama terdiri dari 4 tahap yang bisa dijalankan secara individual atau terintegrasi:

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  SOURCE   │ ──→ │  ENRICH  │ ──→ │  SCORE   │ ──→ │ OUTREACH │
│           │     │          │     │          │     │          │
│ Google    │     │ Website  │     │ Rule-    │     │ AI Email │
│ Maps      │     │ Crawling │     │ based    │     │ Draft    │
│ Scraper   │     │ + Tech   │     │ Engine   │     │ via      │
│           │     │ + SEO    │     │          │     │ OpenRouter│
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                │                │
     ▼                ▼                ▼                ▼
  ┌─────────────────────────────────────────────────────────┐
  │                    PostgreSQL Database                   │
  │              (leads table + logs table)                  │
  └─────────────────────────────────────────────────────────┘
```

### 4.1 Stage 1: Source (Google Maps Scraper)

**File:** `src/lib/maps/scraper.ts`

Menggunakan **Playwright** untuk scraping Google Maps:

- Membuka Google Maps search URL berdasarkan keyword + location
- Browser headless Chromium dengan anti-detection settings
- Block images/fonts untuk speed optimization
- Handle consent/cookie dialogs otomatis
- Scroll panel secara bertahap untuk load lebih banyak results
- Deduplikasi menggunakan SHA-256 hash dari `name|address|phone`
- Retry mechanism dengan exponential back-off (default 3 attempts)
- Ekstraksi data: name, address, phone, website, maps_url, rating, review_count, place_id

**Selectors** didesain dengan fallback untuk menghandle perubahan DOM Google Maps:

```typescript
const SELECTORS = {
  resultsPanel: ['div[role="feed"]', 'div.m6QErb[aria-label]', 'div.m6QErb'],
  resultItem:   ['div.Nv2PK', 'a[jsaction*="pane.resultSection"]', ...],
  name:         ['div.qBF1Pd', 'span.fontHeadlineSmall', '[aria-label]'],
  // ... dll
};
```

### 4.2 Stage 2: Enrich (Website Crawling)

**Files:** `src/lib/enrich/website.ts`, `seo.ts`, `tech.ts`, `search-engine.ts`

Strategy **tiered fetching** (dalam urutan speed/cost):

1. **Tier 1: `fetch()` + Cheerio** — Cepat, works untuk ~80% website bisnis lokal
2. **Tier 2: Playwright fallback** — Untuk JS-heavy sites atau jika fetch di-block

**Smart fetch heuristic** — Jika HTML dari fetch() terlihat seperti JS SPA shell (e.g. `<div id="root"></div>` tanpa content), otomatis fallback ke Playwright.

**Search Engine Discovery** — Jika bisnis tidak punya website di Google Maps, sistem akan mencari via **Yahoo Search** untuk menemukan:
- Official website (filtering directory domains seperti TripAdvisor, Yelp, dll.)
- Social media profiles (Instagram, Facebook, TikTok, dll.)

Detail enrichment yang diekstrak:
- **SEO**: title, meta description, viewport (mobile-friendly), canonical URL, H1
- **Signals**: SSL, contact form, booking system, social links, emails, phone on page
- **Tech**: CMS, analytics, frameworks, booking platforms

### 4.3 Stage 3: Score (Lead Scoring)

**File:** `src/lib/scoring/engine.ts`

Rule-based scoring engine yang:
- Load rules dari `scoring-rules.json` (hot-reload setiap 30 detik)
- Fallback ke built-in rules jika file tidak ditemukan
- Evaluate setiap rule terhadap context (dari Maps data + enrichment)
- Return total score, list of reasons, dan max possible score

### 4.4 Stage 4: Outreach (AI Email Generation)

**File:** `src/lib/ai/generator.ts`

- Membuat prompt yang berisi info bisnis, industry, location, dan identified issues
- Memanggil **OpenRouter API** dengan model `z-ai/glm-5.1`
- Parse response format `SUBJECT: ... BODY: ...`
- Fallback ke template-based generation jika API unavailable
- Timeout 20 detik, max 1200 tokens

---

## 5. API Reference

### `POST /api/scrape-leads` — Integrated Orchestrator

**Timeout:** 300s (5 menit)

Endpoint utama yang menjalankan seluruh pipeline: scrape Google Maps → enrich setiap bisnis → simpan ke database.

**Request Body:**
```json
{
  "keyword": "coffee shop",
  "location": "Bali",
  "limit": 10
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "Example Coffee",
      "maps_url": "https://google.com/maps/place/...",
      "website": "https://example.com",
      "emails": ["info@example.com"],
      "phones": ["+62812345678"],
      "technologies": ["WordPress", "Google Analytics"],
      "socials": ["https://instagram.com/example"]
    }
  ],
  "metrics": { "total_found": 10, "duration_ms": 45000 }
}
```

Concurrency: **3 parallel enrichments** via `p-limit`.

---

### `POST /api/search` — Google Maps Search Only

**Timeout:** 120s

Hanya menjalankan Google Maps scraping dan menyimpan raw data ke database (tanpa enrichment).

**Request Body:** Sama dengan `/api/scrape-leads`

**Response:** `{ success, data: { businesses: BusinessListing[], total, duration_ms } }`

---

### `GET /api/leads` — List Leads

**Query Params:**
| Param    | Default | Max  | Description          |
| -------- | ------- | ---- | -------------------- |
| `limit`  | 200     | 500  | Jumlah leads         |
| `offset` | 0       | —    | Pagination offset    |

**Response:** `{ success, data: { leads: BusinessListing[], total } }`

Setiap lead mengandung parsed `enrichment`, `outreach`, dan `reasons` dari JSON columns.

---

### `DELETE /api/leads` — Delete Lead(s)

**Query Params:**
- `?id=123` — Hapus satu lead
- `?all=true` — Hapus semua leads

---

### `POST /api/enrich` — Enrich Single Lead

**Request Body:**
```json
{
  "id": 123,
  "url": "https://example.com",
  "forcePlaywright": false
}
```

Jika `id` diberikan tanpa `url`, sistem akan otomatis menjalankan **search engine discovery** untuk menemukan website.

**Response:** `{ success, data: EnrichmentData }`

---

### `PUT /api/enrich` — Bulk Enrichment

**Request Body:**
```json
{
  "leads": [
    { "id": 1, "url": "https://site1.com" },
    { "id": 2, "url": "https://site2.com" }
  ]
}
```

Diproses dalam batches berdasarkan `MAX_CONCURRENT_ENRICHMENT` (default: 5).

---

### `POST /api/score` — Score a Lead

**Request Body:**
```json
{
  "id": 123
}
```
Atau tanpa `id` (inline data):
```json
{
  "rating": 3.5,
  "review_count": 8,
  "website": "https://example.com",
  "enrichment": { ... }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "score": 65,
    "reasons": ["No SSL certificate", "Low review count"],
    "max_possible": 130
  }
}
```

---

### `GET /api/score` — Get Scoring Rules

Mengembalikan konfigurasi scoring rules saat ini (dari `scoring-rules.json`).

---

### `POST /api/outreach` — Generate AI Outreach

**Request Body:**
```json
{
  "id": 123,
  "niche": "restaurant"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "subject": "Quick tip for Example Restaurant",
    "body": "Hi Example Restaurant team...",
    "generated_at": "2024-01-01T00:00:00.000Z",
    "source": "ai",
    "model": "z-ai/glm-5.1"
  }
}
```

---

### `GET /api/export` — CSV Export

**Query Params:** `?limit=10000` (max 10,000)

Mengembalikan file CSV dengan header:
```
ID, Name, Address, Phone, Maps URL, Website, Rating, Reviews, Score, Reasons,
Has SSL, Has Booking, Has Social, Emails, Detected Tech, CMS,
Meta Title, Meta Description, Outreach Subject, Outreach Body, Outreach Source, Created At
```

---

### `GET /api/health` — Health Check

```json
{ "status": "ok", "timestamp": "...", "environment": "production", "mode": "monolith" }
```

### `GET /api/ping` — Ping (Railway Healthcheck)

```json
{ "status": "online", "timestamp": "...", "message": "xtools backend is alive" }
```

---

## 6. Database Schema

### Table: `leads`

| Column           | Type      | Constraints                | Description                        |
| ---------------- | --------- | -------------------------- | ---------------------------------- |
| `id`             | SERIAL    | PRIMARY KEY                | Auto-increment ID                  |
| `hash`           | TEXT      | UNIQUE NOT NULL            | SHA-256 hash (deduplikasi)         |
| `place_id`       | TEXT      |                            | Google Maps Place ID               |
| `name`           | TEXT      | NOT NULL                   | Nama bisnis                        |
| `address`        | TEXT      | NOT NULL DEFAULT ''        | Alamat                             |
| `phone`          | TEXT      |                            | Nomor telepon                      |
| `maps_url`       | TEXT      |                            | Google Maps URL                    |
| `website`        | TEXT      |                            | Website URL                        |
| `rating`         | REAL      |                            | Rating Google (0-5)                |
| `review_count`   | INTEGER   |                            | Jumlah review                      |
| `score`          | INTEGER   |                            | Lead score (0-130)                 |
| `reasons`        | TEXT      |                            | JSON array of scoring reasons      |
| `enrichment_json`| TEXT      |                            | Full enrichment data (JSON)        |
| `outreach_json`  | TEXT      |                            | Generated outreach draft (JSON)    |
| `created_at`     | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP  | Waktu dibuat                       |
| `updated_at`     | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP  | Waktu terakhir diupdate            |

**Indexes:**
- `idx_leads_hash` — Untuk fast dedup lookup
- `idx_leads_score` — DESC, untuk sorting by score
- `idx_leads_created` — DESC, untuk sorting by date
- `idx_leads_name` — Untuk search by name

**Upsert strategy:** `ON CONFLICT (hash) DO UPDATE` — Jika bisnis sudah ada (berdasarkan hash), hanya update score, reasons, enrichment, dan outreach.

### Table: `logs`

| Column      | Type      | Constraints               | Description          |
| ----------- | --------- | ------------------------- | -------------------- |
| `id`        | SERIAL    | PRIMARY KEY               | Auto-increment ID    |
| `level`     | TEXT      | NOT NULL                  | info/warn/error      |
| `message`   | TEXT      | NOT NULL                  | Log message          |
| `data`      | TEXT      |                           | Extra data (JSON)    |
| `created_at`| TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Timestamp            |

**Index:** `idx_logs_created` (DESC)

### Connection Configuration

```typescript
{
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,                    // Max pool connections
  idleTimeoutMillis: 60000,   // 1 menit idle timeout
  connectionTimeoutMillis: 10000  // 10 detik connection timeout
}
```

---

## 7. Scoring System

### Konfigurasi Rules (`scoring-rules.json`)

Scoring bersifat **fully configurable** via file JSON. Rules di-cache selama 30 detik (hot-reload).

| Rule ID           | Field              | Operator | Value | Score | Reason                                              |
| ----------------- | ------------------ | -------- | ----- | ----- | --------------------------------------------------- |
| `no_website`      | `has_website`      | `eq`     | false | 30    | No website detected — major digital presence gap    |
| `no_ssl`          | `has_ssl`          | `eq`     | false | 25    | No SSL certificate — security risk & SEO penalty    |
| `low_rating`      | `rating`           | `lt`     | 4.0   | 20    | Low Google rating (< 4.0) — reputation management   |
| `no_booking`      | `has_booking`      | `eq`     | false | 20    | No booking/appointment system detected              |
| `low_reviews`     | `review_count`     | `lt`     | 20    | 15    | Low review count (< 20) — needs reputation building |
| `no_social`       | `has_social`       | `eq`     | false | 10    | No social media presence                            |
| `no_contact_form` | `has_contact_form` | `eq`     | false | 10    | No contact form detected                            |

**Max possible score:** 130 (semua rules triggered)

### Score Labels

| Score Range | Label    | Meaning                                    |
| ----------- | -------- | ------------------------------------------ |
| ≥ 60        | **Hot**  | Banyak gap digital — peluang sales tinggi  |
| 30 – 59     | **Warm** | Beberapa area perlu improvement            |
| < 30        | **Cold** | Digital presence relatif baik              |

### Supported Operators

`eq`, `neq`, `lt`, `lte`, `gt`, `gte`

### Scoring Context

Context dibangun dari gabungan data Google Maps dan enrichment:

```typescript
interface ScoringContext {
  rating?: number;          // dari Google Maps
  review_count?: number;    // dari Google Maps
  has_website: boolean;     // dari listing + enrichment
  has_ssl: boolean;         // dari enrichment
  has_contact_form: boolean;// dari enrichment
  has_booking: boolean;     // dari enrichment
  has_social: boolean;      // dari enrichment
}
```

---

## 8. Enrichment Detail

### 8.1 Tiered Fetching Strategy

```
                    ┌──────────────┐
                    │  URL Input   │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  fetch() +   │
                    │  Cheerio     │
                    └──────┬───────┘
                           │
                 ┌─────────┴─────────┐
                 │                   │
          HTML usable?          HTML = SPA shell
          (status < 400,        atau fetch error?
           body > 500 bytes,         │
           bukan SPA shell)     ┌────▼────┐
                 │              │Playwright│
                 ▼              │ fallback │
          ┌──────────┐         └────┬─────┘
          │ Extract   │              │
          │ data from │◄─────────────┘
          │ HTML      │
          └──────────┘
```

**SPA Shell Detection** — Jika HTML mengandung `<div id="root"></div>` atau `<noscript>JavaScript is required` dan body text < 30 kata, dianggap SPA shell.

**Playwright Trigger Conditions** (selain SPA shell):
- `ECONNREFUSED`
- Certificate/SSL errors
- HTTP 403 (blocked)
- Abort timeout

### 8.2 SEO Extraction (`seo.ts`)

| Signal            | Source                                            | Confidence |
| ----------------- | ------------------------------------------------- | ---------- |
| Page title        | `<title>` tag                                     | 0.9        |
| Meta description  | `meta[name="description"]` / `og:description`    | 0.9        |
| Mobile-friendly   | `meta[name="viewport"]`                           | 1.0        |
| Canonical URL     | `link[rel="canonical"]`                           | 0.95       |
| H1 tag            | First `<h1>` element                              | 0.95       |

### 8.3 Website Signal Detection (`website.ts`)

| Signal         | Detection Method                                                         |
| -------------- | ------------------------------------------------------------------------ |
| **SSL**        | URL starts with `https://`                                               |
| **Contact form** | `<form>` with email/message inputs, atau WhatsApp link (`wa.me`)       |
| **Booking**    | Button/link text matching booking keywords + tech detection (Calendly, dll.) |
| **Social links** | `<a href>` matching patterns: Facebook, Instagram, Twitter, LinkedIn, TikTok, YouTube, Pinterest, Telegram |
| **Emails**     | `mailto:` links + regex scan + obfuscated email detection (`&#64;`, `%40`, `AT`) |
| **Phone**      | `tel:` links + regex pattern matching                                    |

### 8.4 Technology Detection (`tech.ts`)

Detection menggunakan regex pattern matching pada HTML, headers, dan meta tags:

**CMS:**
| Platform     | Detection Pattern                                      |
| ------------ | ------------------------------------------------------ |
| WordPress    | `wp-content`, `wp-includes`, `wp-json`                 |
| Wix          | `wix.com`, `wixstatic.com`                             |
| Squarespace  | `squarespace.com`, `Static.SQUARESPACE_URLS`           |
| Shopify      | `Shopify.theme`, `cdn.shopify.com`                     |
| Webflow      | `webflow.com`                                          |
| Joomla       | `/components/com_`, `Joomla!`                          |
| Drupal       | `Drupal.settings`, `drupal.org`                        |
| Ghost        | `ghost-theme`, `ghost.io`                              |

**Analytics:**
| Platform           | Detection Pattern                        |
| ------------------ | ---------------------------------------- |
| Google Analytics   | `google-analytics.com`, `gtag(`          |
| Google Tag Manager | `googletagmanager.com`                   |
| Facebook Pixel     | `connect.facebook.net/en_US/fbevents`    |

**Frameworks:**
| Framework | Detection Pattern                            |
| --------- | -------------------------------------------- |
| React     | `__REACT_DEVTOOLS_GLOBAL_HOOK__`, `data-reactroot` |
| Next.js   | `__NEXT_DATA__`                              |
| Vue.js    | `vue.runtime`, `vuejs.org`                   |
| Angular   | `ng-version`, `angular.min`                  |

**Booking Platforms:**
Calendly, Acuity Scheduling, Booksy, Fresha, SimplyBook

**Infrastructure:**
Cloudflare (HTML + header detection)

### 8.5 Search Engine Fallback (`search-engine.ts`)

Ketika bisnis **tidak punya website** di Google Maps, sistem melakukan discovery via **Yahoo Search**:

1. Search `"business name" + "location"` di Yahoo
2. Parse hasil, extract URLs dari redirect structure Yahoo (`/RU=...`)
3. Filter out directory domains (TripAdvisor, Yelp, Agoda, Booking.com, dll.)
4. Identifikasi official website (URL pertama yang bukan directory)
5. Identifikasi social media profiles (Instagram, Facebook, LinkedIn, TikTok, dll.)
6. Filter out individual posts (`/p/`, `/status/`, `/shorts/`)

**Filtered Directory Domains:** TripAdvisor, Yelp, Agoda, Booking.com, Traveloka, Yellow Pages, Foursquare, Zomato, OpenTable, Grab, GoFood, ShopeFood, Tokopedia, Shopee, Google, Bing, dan lainnya.

---

## 9. AI Outreach System

### Provider & Model

| Config           | Value                                          |
| ---------------- | ---------------------------------------------- |
| API Endpoint     | `https://openrouter.ai/api/v1/chat/completions` |
| Default Model    | `z-ai/glm-5.1` (Elite Reasoning Model)        |
| Max Tokens       | 1200 (includes reasoning overhead)             |
| Temperature      | 0.7                                            |
| Timeout          | 20 detik                                       |
| Reasoning        | Enabled (`reasoning: { enabled: true }`)       |

### Prompt Engineering

Prompt didesain untuk menghasilkan cold outreach email:
- **Persona:** Professional digital marketing consultant
- **Input:** Business name, industry, location, rating, review count, identified opportunities
- **Constraints:** Max 120 words, professional but friendly, value-focused, no fake promises, soft CTA
- **Format:** `SUBJECT: [subject] BODY: [body]`

### Template Fallback

Jika OpenRouter API gagal (no API key, timeout, error), sistem generate template-based email:

```
Subject: Quick tip for {business_name} — grow your {niche} business

Hi {business_name} team,

I came across your {niche} business and noticed an opportunity...
Specifically: {top_issue}.
Also: {second_issue}.

These are quick wins that could meaningfully improve your online visibility...
I'd love to share a free 5-minute audit with you. Would you be open to a quick chat?

Best regards
```

---

## 10. Frontend / Dashboard

### Overview

- **Route:** `/dashboard` (root `/` redirects ke sini)
- **Type:** Client Component (`'use client'`)
- **Size:** ~1107 lines (single-file SPA)
- **Theme:** Dark mode (background `#0d0f1a`, text `#f0f0ff`)
- **Fonts:** Geist Sans (UI) + Geist Mono (code/data)

### UI Components

| Component        | Fungsi                                                    |
| ---------------- | --------------------------------------------------------- |
| **Search Form**  | Input keyword + location, trigger scraping                |
| **Lead Table**   | Tabel semua leads dengan sorting, detail expandable       |
| **PipelineBar**  | Visual progress bar 4-step per lead (Sourced→Enriched→Scored→Outreach) |
| **SignalBadge**  | Badge ✓/✗ untuk setiap signal (SSL, Social, Booking, dll.) |
| **ScoreBadge**   | Hot (merah) / Warm (amber) / Cold (biru) badge           |
| **Star Rating**  | Visual star rating dengan half-star support               |
| **Spinner**      | Loading indicator (sm/md sizes)                           |

### Pipeline Steps (Visual)

```
  📍 Sourced  →  🔍 Enriched  →  📊 Scored  →  ✉️ Outreach
  ████████████   ████████████    ████████████   ████████████
  (violet bar fills progressively based on lead's current step)
```

### Color System

| Element        | Color                                        |
| -------------- | -------------------------------------------- |
| Hot score      | Red (`text-red-400`, `bg-red-950/50`)        |
| Warm score     | Amber (`text-amber-400`, `bg-amber-950/50`)  |
| Cold score     | Emerald (`text-emerald-400`, `bg-emerald-950/50`) |
| Signal OK      | Emerald (`bg-emerald-500/10`)                |
| Signal Missing | Red (`bg-red-500/10`)                        |
| Pipeline       | Violet (`bg-violet-500`)                     |
| Focus ring     | Purple (`rgba(139, 92, 246, 0.6)`)           |

---

## 11. Environment Variables

| Variable                    | Required | Default          | Description                                |
| --------------------------- | -------- | ---------------- | ------------------------------------------ |
| `DATABASE_URL`              | **Yes**  | —                | PostgreSQL connection string               |
| `OPENROUTER_API_KEY`        | No*      | —                | OpenRouter API key (fallback ke template)  |
| `OPENROUTER_MODEL`          | No       | `z-ai/glm-5.1`  | AI model untuk outreach generation         |
| `ENRICHMENT_TIMEOUT_MS`     | No       | `12000`          | Timeout untuk website fetch (ms)           |
| `ENRICHMENT_USE_PLAYWRIGHT` | No       | `true`           | Enable/disable Playwright fallback         |
| `MAX_CONCURRENT_ENRICHMENT` | No       | `5`              | Max concurrent bulk enrichment jobs        |
| `APP_MODE`                  | No       | `monolith`       | Application mode label (untuk health check)|
| `NODE_ENV`                  | No       | `development`    | Environment (affects SSL config)           |
| `PORT`                      | No       | `3000`           | Server port                                |
| `HOSTNAME`                  | No       | `localhost`      | Server hostname                            |

> *`OPENROUTER_API_KEY` tidak strictly required — tanpa key, outreach generation akan fallback ke template-based emails.

---

## 12. Deployment & Infrastructure

### Docker (Multi-stage Build)

```dockerfile
# Stage 1: Dependencies (node:20-slim)
FROM node:20-slim AS deps
# → npm ci

# Stage 2: Builder (node:20-slim)
FROM node:20-slim AS builder
# → next build (standalone output)

# Stage 3: Runner (mcr.microsoft.com/playwright:v1.48.0-focal)
FROM mcr.microsoft.com/playwright:v1.48.0-focal AS runner
# → Install Node.js 20
# → Copy standalone build + static + public
# → Install Chromium via npx playwright install chromium --with-deps
# → Expose port 3000
# → CMD ["node", "server.js"]
```

**Key decisions:**
- Runner image berbasis **Microsoft Playwright** image (bukan Node slim) karena membutuhkan Chromium binary
- Node.js 20 di-install manual di runner stage
- Telemetry disabled (`NEXT_TELEMETRY_DISABLED=1`)
- Browser path: `/ms-playwright`

### Railway Configuration (`railway.json`)

```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "healthcheckPath": "/api/ping",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

- Health check via `/api/ping` (timeout 300s untuk build warmup)
- Auto-restart on failure (max 10 retries)

### Next.js Configuration (`next.config.ts`)

```typescript
{
  output: 'standalone',
  serverExternalPackages: ['playwright', 'playwright-core', 'pg'],
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
}
```

- `standalone` output untuk minimal Docker image
- `playwright`, `playwright-core`, `pg` di-exclude dari bundle (loaded at runtime)
- Server actions enabled untuk localhost

### NPM Scripts

| Script    | Command       | Description              |
| --------- | ------------- | ------------------------ |
| `dev`     | `next dev`    | Development server       |
| `build`   | `next build`  | Production build         |
| `start`   | `next start`  | Production server        |
| `lint`    | `eslint`      | Lint check               |

---

## 13. Test Files

Project memiliki beberapa manual test scripts di root directory:

| File                  | Purpose                                           |
| --------------------- | ------------------------------------------------- |
| `test-ddg.js`         | Test DuckDuckGo search parsing                    |
| `test-yahoo-parse.js` | Test Yahoo HTML response parsing                  |
| `test-yahoo.js`       | Test Yahoo search fetch & URL extraction          |

Test files ini bersifat **manual** (tidak ada test framework), dijalankan langsung dengan `node test-*.js`.

---

## Type System

Semua types didefinisikan di `src/types/index.ts` dan digunakan secara konsisten di seluruh codebase:

| Type                | Purpose                                         |
| ------------------- | ----------------------------------------------- |
| `BusinessListing`   | Core lead entity (maps data + enrichment + outreach) |
| `EnrichedField<T>`  | Provenance-tracked field (value + source + confidence) |
| `EnrichmentData`    | Full enrichment result (SEO + signals + tech)   |
| `SeoData`           | SEO signals dari website                        |
| `WebsiteSignals`    | Website feature signals (SSL, forms, social)    |
| `TechData`          | Detected technologies                           |
| `ScoringResult`     | Score + reasons + max_possible                  |
| `ScoringRule`       | Single scoring rule definition                  |
| `ScoringConfig`     | Full scoring configuration                      |
| `OutreachDraft`     | Generated email (subject + body + metadata)     |
| `OutreachRequest`   | Input untuk outreach generation                 |
| `SearchRequest`     | Search input (keyword + location + limit)       |
| `SearchResult`      | Search output (businesses + metrics)            |
| `DbLead`            | Database row representation                     |
| `ExportRow`         | CSV export row                                  |
| `ApiResponse<T>`    | Standard API response wrapper                   |
| `LogEntry`          | System log entry                                |

### Provenance Tracking

Setiap enriched field memiliki metadata:

```typescript
interface EnrichedField<T> {
  value: T;            // Nilai yang diekstrak
  source: string;      // Sumber data (e.g. "website_scan", "tech_detection", "search_engine")
  confidence: number;  // Tingkat keyakinan (0.0 - 1.0)
}
```

Ini memungkinkan downstream consumer untuk mengetahui **dari mana** data berasal dan **seberapa yakin** sistem terhadap data tersebut.

---

*Generated on: April 2025*
*Project: x-tools-inteligent (saas-local-business-lead) v0.1.0*
