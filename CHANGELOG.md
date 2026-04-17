# XTools Intelligent — Development Changelog

> A living document tracking features built, bugs fixed, and known limitations.

---

## Sprint 2 — Authentication, Email Outreach & User Isolation
*Merged into `main` — April 2026*

### ✅ Features Delivered

#### 1. Authentication System (NextAuth.js v5)
- Full authentication with **email + password** (bcrypt hashing)
- JWT session management via NextAuth.js v5 Credentials provider
- `/api/auth/register` — user registration endpoint
- `/api/auth/[...nextauth]` — NextAuth handler
- `src/auth.ts` — central NextAuth config with `trustHost: true` for reverse proxy support (Railway)

#### 2. Login & Register Pages
- `/login` — dark-themed login form with error handling
- `/register` — registration form with client-side validation (password match, min 8 chars)
- Redirect logic: authenticated users skip login/register → go directly to dashboard

#### 3. Route Protection — `src/proxy.ts`
- Replaces deprecated `middleware.ts` (Next.js 16 convention)
- Protects `/dashboard/*` — unauthenticated users redirected to `/login`
- Logged-in users redirected away from `/login` and `/register`
- Always runs on Node.js runtime (no Edge runtime conflict)

#### 4. Email Drawer UI
- `EmailDrawer` component — slide-out panel for composing and sending outreach emails
- `SendEmailButton` — simplified trigger button that opens the drawer
- Email sending via `/api/leads/[id]/send-email` → **Resend API**
- Records `sent_at` timestamp to database after successful send

#### 5. Session Provider & Dashboard Integration
- `src/app/providers.tsx` — wraps app with `SessionProvider`
- Dashboard shows logged-in user info + logout button
- `useSession` hook used throughout dashboard components

#### 6. AI Outreach Email Generation
- `src/lib/ai/generator.ts` — generates cold outreach emails via **OpenRouter API**
- Detailed prompt: professional tone, word limits, subject + body format
- Fallback template used when API is unavailable or times out
- `/api/outreach` — generates draft for a lead
- `/api/outreach/send` — sends the draft via Resend

> ⚠️ **Known Limitation:** AI email generation via OpenRouter can be **slow or unreliable** depending on the selected free model (e.g., `arcee-ai/trinity-large-preview:free`). Response times can exceed 10–30 seconds. The system falls back to a template automatically, but the AI-generated quality is inconsistent. **This area needs improvement** — consider switching to a faster paid model or implementing a streaming response.

---

## Sprint 2.5 — Database Migration & User Data Isolation
*Merged into `main` — April 2026*

### ✅ Features Delivered

#### 7. Automatic DB Schema Migration
- `src/instrumentation.ts` — triggers `initSchema()` on Next.js server start (Node.js runtime only)
- `scripts/migrate.ts` — manual migration script for local/production use
- Tables created automatically: `users`, `user_preferences`, `leads`, `logs`
- All `ALTER TABLE` statements are idempotent (`IF NOT EXISTS`)
- **Fixed schema ordering bug:** `users` table is now created before `leads` to avoid FK constraint errors on fresh databases

#### 8. User Data Isolation (Multi-tenant Leads)
- Added `user_id INTEGER REFERENCES users(id)` column to `leads` table
- `getLeads(limit, offset, userId)` — filters leads by authenticated user
- `getLeadsCount(userId)` — counts only current user's leads
- `deleteAllLeads(userId)` — deletes only current user's leads
- `upsertLead(lead, userId)` — associates new lead with the creating user
- `src/lib/auth/session.ts` — helper `getSessionUserId()` to extract user ID from session

**API routes updated for isolation:**
| Route | Change |
|-------|--------|
| `GET /api/leads` | Returns only current user's leads |
| `DELETE /api/leads?all=true` | Deletes only current user's leads |
| `POST /api/scrape-leads` | Associates scraped leads with `userId` |
| `GET /api/export` | Exports only current user's leads as CSV |
| `POST /api/leads/[id]/send-email` | Checks lead ownership before sending |

---

## Deep Enrichment Engine (DEE) — Sprint 3
*In progress*

### ✅ Architecture Implemented

A full modular enrichment pipeline following the DEE specification:

```
API → Queue (BullMQ) → Worker → Pipeline → Sources → Normalizer → Validator → Confidence Scorer → DB
```

#### Source Adapters (`src/enrichment/sources/`)
| Adapter | Purpose |
|---------|---------|
| `serp-adapter.ts` | DuckDuckGo/Yahoo scraping for business discovery |
| `website-adapter.ts` | Enhanced crawler: emails, phones, social links |
| `directory-adapter.ts` | YellowPages, Yelp, BBB scraping |
| `social-adapter.ts` | LinkedIn, Instagram, Facebook detection |
| `dns-adapter.ts` | DNS/MX record validation |
| `whois-adapter.ts` | Domain WHOIS lookup |

#### Pipeline (`src/enrichment/pipeline/`)
- `seed-extractor.ts` — normalizes business input
- `hypothesis-generator.ts` — generates 3–5 search queries per lead
- `normalizer.ts` — converts raw data to unified schema
- `fallback-strategy.ts` — SERP → Playwright → DNS → mark failed

#### Scoring (`src/enrichment/scoring/`)
- `confidence-engine.ts` — weighted formula: source reliability (40%) + field match (30%) + freshness (20%) + cross-validation (10%)
- `cross-validator.ts` — Levenshtein fuzzy matching across sources
- Threshold: ≥0.75 auto-commit, 0.5–0.74 low confidence, <0.5 discard

#### Queue System (`src/enrichment/queue/`)
- `bullmq-queue.ts` — BullMQ job queue (backed by Redis)
- `dee-queue.ts` — queue factory with job management
- `dee-worker.ts` — parallel worker processing

#### Database (`src/enrichment/db/`)
- `dee-schema.ts` — schema for `enrichment_audit` table
- `dee-queries.ts` — CRUD helpers for enrichment results

#### Tests (`src/enrichment/__tests__/`)
- Full test coverage: 15 test files covering each module

---

## Deployment — Railway + Docker
*April 2026*

- **Dockerfile** — multi-stage build (deps → builder → runner)
  - Runner base: `mcr.microsoft.com/playwright:v1.48.0-focal` (Chromium pre-installed)
  - Node.js v20 installed in runner stage
  - Next.js standalone output
- **`railway.json`** — Railway config using Dockerfile builder
- **Docker Hub:** `widisuandana/xtool-app:latest`
- **Health check:** `GET /api/health` → `{"status":"ok"}`

### Fixes Applied During Deployment
| Issue | Fix |
|-------|-----|
| `Route segment config not allowed in proxy.ts` | Removed `export const runtime = 'nodejs'` from `proxy.ts` |
| `playwright: not found` in Docker runner | Removed redundant `RUN npx playwright install` — base image already has browsers |
| `UntrustedHost` error on Railway domain | Added `trustHost: true` to NextAuth config |
| Schema FK error on fresh Railway DB | Moved `CREATE TABLE users` before `ALTER TABLE leads ADD COLUMN user_id` |

---

## Known Issues & Planned Improvements

| Area | Status | Notes |
|------|--------|-------|
| AI Email Generation (OpenRouter) | ⚠️ Needs improvement | Free models are slow (10–30s latency). Fallback to template works but quality varies. Consider paid model or streaming. |
| Railway auto-redeploy on Docker push | 🔧 Manual | No webhook set up yet. Requires manual "Redeploy" click in Railway Dashboard after `docker push`. |
| Deep Enrichment Engine (DEE) | 🚧 In progress | Architecture complete, source adapters built. Integration with dashboard UI pending. |
| Email verification | ❌ Not implemented | No SMTP verification for extracted emails yet. |

---

## Environment Variables Required

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | JWT signing secret |
| `NEXTAUTH_URL` | Public app URL (e.g. `https://xtool-app-production.up.railway.app`) |
| `RESEND_API_KEY` | Resend email delivery |
| `RESEND_FROM_EMAIL` | Sender email address |
| `RESEND_FROM_NAME` | Sender display name |
| `OPENROUTER_API_KEY` | AI email generation |
| `OPENROUTER_MODEL` | Model to use (default: free tier, slow) |
