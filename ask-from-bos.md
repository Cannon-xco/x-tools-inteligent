# 📋 PROJECT BRIEF: XTools Deep Enrichment Engine (DEE)
Objective: Transform incomplete lead records into fully enriched, actionable prospects by algorithmically cross-referencing existing data against public web sources, directories, and infrastructure signals.

The Problem:
Current enrichment stops at the initial website scan. Missing emails, phone numbers, social profiles, or verified domains force users to manually research or discard otherwise high-intent leads. This breaks the automation promise and lowers outreach conversion.

### 🎯 Scope (Phase 1)
- Target Fields: Verified business email(s), phone number, official social profiles (LinkedIn, Facebook, Instagram), secondary/backup websites, key decision-maker names/titles.
- Trigger: User(Me/You) clicks Deep Enrich on a lead, OR auto-trigger for leads scoring Cold`/`Warm due to missing core fields.
- Out of Scope(Phase 1) Intent data, revenue/employee firmographics, GDPR-compliant consent tracking (to be addressed in Phase 2)

Success Metrics
| Metric | Baseline | Target |
|--------|----------|--------|
| Data Completeness Rate | ~60% | ≥85% |
| Manual Research Time per Lead | 4-8 mins | <10 secs |
| Enrichment Success Rate (fields filled) | N/A | ≥70% |
| User Retention on Enrich Feature | N/A | ≥80% weekly active usage |

---
## 🏗 System Architect Perspective: Algorithm & Data Flow Design
### 🧠 The Deep Enrichment Algorithm (Deterministic Pipeline)
1. Seed Extraction: Parse existing lead record. Isolate partial_name, city, address, domain, existing_email, niche.
2. Hypothesis Generation: Construct 3-5 targeted search queries:
   - "[Business Name] [City] official contact"
   - site:linkedin.com/company "[Business Name]"
   - MX/DNS lookup on partial domain
3. Multi-Source Fetching (Parallelized):
   - Search APIs → SERP results
   - Directory APIs/Scrapers → Yelp, BBB, YellowPages, Chamber of Commerce
   - Infrastructure → DNS, WHOIS, MX records
   - Social Graph → Open Graph tags, LinkedIn/Facebook public pages
4. Cross-Validation & Confidence Scoring:
     Confidence = (SourceReliability × 0.4) + (FieldMatchScore × 0.3) + (FreshnessWeight × 0.2) + (CrossSourceCorroboration × 0.1)
      - SourceReliability: Official API (0.9) > Directory (0.7) > Search snippet (0.5) > Scraped HTML (0.4)
   - FieldMatchScore: Exact name+city match = 1.0, fuzzy = 0.6
   - Threshold: Only auto-commit fields with Confidence ≥ 0.75. Lower scores go to pending_review or are flagged with ⚠️ Low Confidence.
5. Atomic Merge & Audit: Upsert into PostgreSQL. Log enrichment_audit table: field_filled, source, confidence, timestamp, raw_snippet.
6. Fallback Chain: If API fails → Playwright targeted scrape → DNS/WHOIS → Cache miss → Mark enrichment_limit_reached.

### 🌐 Architecture Diagram (Logical)[Dashboard] → POST /api/leads/:id/enrich
        ↓
[API Route] → Validates lead → Pushes job to Redis/BullMQ Queue
        ↓
[Worker Service] → Fetches seed → Parallel API/DNS/Scrape calls
        ↓
[Enrichment Engine] → Parses → Cross-validates → Scores confidence
        ↓
[DB Layer] → Atomic UPSERT + Audit log → Emits `enrichment:completed` event
        ↓
[Dashboard] → Polls/WebSocket → Updates UI with new fields + confidence badges

### ⚙️ DevOps & Performance Notes
- Rate limit all external calls. Implement exponential backoff.
- Cache DNS/WHOIS results for 24h to reduce redundant lookups.
- Use AbortController + 15s timeout per source to prevent queue blockage.
- Log raw payloads temporarily for debugging, then purge PII after 7 days.

---
## 📖 Technical Writer Perspective: Deliverables & Acceptance Criteria
### ✅ Final Output Definition
Upon completion, the team must deliver:
1. Code: src/enrichment/ module with source adapters, scoring engine, queue worker, and API route.
2. Database: Migrations for enrichment_status, confidence_scores, audit_log.
3. UI: Dashboard component with enrichment trigger, real-time progress, and field-level confidence indicators.
4. Documentation:
   - Architecture & Data Flow diagram (Mermaid/Excalidraw)