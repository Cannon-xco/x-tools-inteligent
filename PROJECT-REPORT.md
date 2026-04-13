# Project Progress Report: Deep Enrichment Engine (DEE)
**Project:** XTools Intelligent — Deep Enrichment Engine
**Date:** April 2026
**Prepared by:** Engineering Team
**Report to:** Team Lead

---

> ⚠️ **DISCLAIMER**
> This project is currently **in active development and testing**. All features described below are implemented but have not yet undergone full QA validation or production load testing. APIs, database schemas, and UI components may change. **Do not use in a production environment without proper review and approval from the team lead.** Data completeness and enrichment accuracy metrics are targets, not yet measured in live conditions.

---

## 1. Project Overview

**Objective:** Transform incomplete lead records into fully enriched, actionable prospects by algorithmically cross-referencing existing data against public web sources, directories, and infrastructure signals.

**The Problem Solved:**
The previous enrichment pipeline only performed an initial website scan, leaving leads with missing emails, phone numbers, social profiles, and contact names. This forced users to research manually (4–8 minutes per lead), breaking the automation promise of the platform.

**Target (Phase 1):** Verified business emails, phone numbers, official social profiles (LinkedIn, Facebook, Instagram), secondary websites, and key decision-maker names/titles.

**Out of Scope (Phase 1):** Intent data, revenue/employee firmographics, GDPR-compliant consent tracking — planned for Phase 2.

---

## 2. Technical Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16, TypeScript (strict mode) |
| Database | PostgreSQL (via `pg` connection pool) |
| Browser Automation | Playwright (Chromium, Docker image) |
| Styling | TailwindCSS |
| Queue (current) | In-memory queue (MVP) |
| Queue (planned) | Redis + BullMQ (Railway plugin ready) |
| Deployment | Railway (Docker, `railway.json` configured) |

---

## 3. Completed Work

### 3.1 Enrichment Pipeline — 6-Step Deterministic Algorithm

| Step | Module | Description |
|------|--------|-------------|
| 1 | `seed-extractor.ts` | Parses lead record: normalizes name, city, domain, existing contact |
| 2 | `hypothesis-generator.ts` | Generates 3–7 targeted SERP queries from seed data |
| 3 | Parallel Adapters | Runs all 6 sources concurrently (`Promise.allSettled`) |
| 4 | `normalizer.ts` | Deduplicates contacts, normalizes emails to lowercase, phones to E.164 |
| 5 | `cross-validator.ts` | Boosts confidence when the same value appears in multiple sources |
| 6 | `confidence-engine.ts` | Calculates final confidence score and assigns field status |

**Confidence Formula:**
```
confidence = (sourceReliability × 0.4)
           + (fieldMatchScore   × 0.3)
           + (freshnessWeight   × 0.2)
           + (crossValidation   × 0.1)
```

**Thresholds:**
- `≥ 0.75` → **VERIFIED** — auto-committed to database
- `0.50–0.74` → **LOW CONFIDENCE** — flagged with ⚠️, saved to audit log
- `< 0.50` → **DISCARDED** — audit log only

### 3.2 Source Adapters (6 Sources)

| Adapter | Data Sources | Reliability Weight |
|---------|-------------|-------------------|
| Website Adapter | Direct crawl + Playwright JS fallback | 0.9 |
| SERP Adapter | DuckDuckGo + Yahoo search results | 0.5 |
| Directory Adapter | YellowPages, Yelp, **BBB**, **Chamber of Commerce** | 0.7 |
| Social Adapter | LinkedIn, Instagram, Facebook, Twitter, TikTok, YouTube | 0.7 |
| DNS Adapter | A / MX / AAAA records (24h cache) | — |
| WHOIS Adapter | RDAP registrant lookup (24h cache) | — |

> **Added in this sprint:** BBB (Better Business Bureau) and Chamber of Commerce scrapers integrated into the directory adapter.

### 3.3 Database Schema

**Extended `leads` table:**
```sql
ADD COLUMN verified_emails      TEXT;   -- JSON: [{value, source, confidence}]
ADD COLUMN verified_phones      TEXT;   -- JSON
ADD COLUMN verified_socials     TEXT;   -- JSON: {linkedin, instagram, ...}
ADD COLUMN confidence_scores    TEXT;   -- JSON: {field: score}
ADD COLUMN deep_enrichment_json TEXT;   -- Full enrichment result blob
ADD COLUMN deep_enriched_at     TIMESTAMP;
ADD COLUMN enrichment_status    TEXT;   -- processing|completed|failed|limit_reached
```

**New `enrichment_audit` table:**
```sql
CREATE TABLE enrichment_audit (
  id          SERIAL PRIMARY KEY,
  lead_id     INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  field_name  TEXT NOT NULL,
  value       TEXT NOT NULL,
  source      TEXT NOT NULL,
  confidence  REAL NOT NULL,
  status      TEXT DEFAULT 'pending',
  raw_snippet TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

All migrations are **idempotent** — safe to run multiple times.

### 3.4 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/leads/:id/enrich` | ✅ Trigger deep enrichment (RESTful — per boss spec) |
| `GET` | `/api/leads/:id/enrich/status` | ✅ Poll enrichment status in real-time |
| `POST` | `/api/deep-enrich` | ✅ Legacy endpoint (backward compatible) |
| `POST` | `/api/admin/purge-pii` | ✅ Delete audit log entries older than 7 days |

### 3.5 UI Components

| Component | Features |
|-----------|----------|
| `DeepEnrichButton` | 7 states: idle, loading, polling (real-time), success, limit\_reached, error, already\_enriched |
| `ConfidenceBadge` | Color-coded: green ≥75%, yellow 50–74%, red <50% |
| `DeepEnrichPanel` | Collapsible panel showing all enriched fields with per-field confidence |

**Real-time progress:** Button polls `/api/leads/:id/enrich/status` every 2 seconds during processing to provide live status feedback.

### 3.6 Auto-trigger for Cold/Warm Leads

Leads with a score below 60 (Warm or Cold tier) that are **missing email data** are now automatically enriched when the dashboard loads — staggered 3 seconds apart to prevent queue overload.

### 3.7 Performance & Reliability

- ✅ `AbortController` + 15-second timeout per source adapter
- ✅ Exponential backoff with configurable retry
- ✅ DNS/WHOIS results cached for 24 hours
- ✅ Obfuscated email handling (`[at]`, `&#64;`, `%40`, HTML entities)
- ✅ Playwright fallback for JavaScript-heavy websites

### 3.8 DevOps

- ✅ `Dockerfile` configured with Playwright Chromium dependencies
- ✅ `railway.json` with healthcheck path and restart policy
- ✅ `env.example` — full environment variable reference
- ✅ `ALLOWED_ORIGINS` env var for Railway Server Actions CSRF protection
- ✅ `REDIS_URL` detection with graceful in-memory fallback + upgrade instructions logged

### 3.9 Documentation

- ✅ `docs/dee-architecture.md` — Mermaid architecture diagram, database schema, API reference

---

## 4. Pending / Backlog

### 4.1 Requires Team Confirmation Before Starting

| Item | Effort | Notes |
|------|--------|-------|
| **Redis + BullMQ** | ~4h | Install `bullmq` + `ioredis`, create `BullMQQueue` adapter. Interface already abstracted — swap is a single file change. Railway Redis plugin available. |
| **Levenshtein fuzzy matching** | ~2h | Heuristic scoring (Approach 2) currently uses word-match %. True Levenshtein would improve accuracy for typo-variant business names. |

### 4.2 Post-MVP Improvements

| Item | Priority | Notes |
|------|----------|-------|
| WebSocket / SSE real-time | Medium | Currently polling every 2s. Upgrade to SSE for better UX and reduced HTTP overhead. |
| PII purge schedule | Medium | `POST /api/admin/purge-pii` endpoint exists. Needs to be called on a schedule (Railway cron or external cron service) — recommended: daily at 02:00. |
| Phase 2 features | Low | Intent data, revenue/employee firmographics, GDPR consent tracking |

---

## 5. Success Metrics (Targets)

| Metric | Baseline | Target | Status |
|--------|----------|--------|--------|
| Data Completeness Rate | ~60% | ≥ 85% | ⏳ Pending measurement |
| Manual Research Time per Lead | 4–8 min | < 10 sec | ✅ Automated |
| Enrichment Success Rate (fields filled) | N/A | ≥ 70% | ⏳ Pending measurement |
| Processing Time | N/A | < 15 sec | ✅ Timeout enforced |
| User Retention on Enrich Feature | N/A | ≥ 80% weekly | ⏳ Post-deployment |

---

## 6. Project File Structure

```
src/enrichment/
├── pipeline/         ← Steps 1-2: seed, hypothesis, normalize, fallback
├── sources/          ← 6 adapters: website, serp, directory, social, dns, whois
├── scoring/          ← Confidence engine + cross-validator
├── queue/            ← dee-queue.ts (InMemoryQueue + IDeeQueue), dee-worker.ts
├── db/               ← dee-schema.ts (migrations), dee-queries.ts (CRUD)
└── types.ts

src/app/api/leads/[id]/
├── enrich/route.ts           ← POST trigger
└── enrich/status/route.ts    ← GET polling

src/app/api/admin/purge-pii/route.ts  ← PII purge
src/app/dashboard/components/         ← UI: Button, Badge, Panel
docs/dee-architecture.md              ← Architecture diagram
env.example                           ← Environment variable reference
```

---

*End of Report — XTools Intelligent Engineering Team*
