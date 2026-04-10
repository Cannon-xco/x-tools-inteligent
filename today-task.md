# 🚀 FINAL EXECUTION PROMPT — XTools Deep Enrichment Engine (DEE)

## 🧠 CONTEXT

You are working on an existing SaaS system called **XTools Intelligent**, a Next.js-based lead generation platform that:

* Scrapes local businesses (Google Maps)
* Performs basic website enrichment (SEO, tech, signals)
* Scores leads
* Generates AI outreach

Current limitation:

> Enrichment stops at website-level and lacks **contact-level intelligence** (emails, phones, socials, decision-makers).

---

# 🎯 OBJECTIVE

Build a new subsystem called:

> **Deep Enrichment Engine (DEE)**

This system must:

* Transform incomplete leads into **fully enriched, actionable prospects**
* Extract:

  * Verified emails
  * Phone numbers
  * Social profiles (LinkedIn, Instagram, Facebook)
  * Secondary websites
  * Decision-makers (if possible)
* Use **multi-source enrichment + cross-validation + confidence scoring**

---

# 🧱 ARCHITECTURE REQUIREMENT

You MUST implement this architecture:

```
API (Next.js)
   ↓
Queue (Redis + BullMQ)
   ↓
Worker (parallel processing)
   ↓
Enrichment Engine (core pipeline)
   ↓
Source Adapters (modular)
   ↓
Normalization Layer
   ↓
Validation Layer
   ↓
Confidence Scoring Engine
   ↓
Database (PostgreSQL + audit log)
```

---

# ⚙️ CORE PIPELINE (STRICT ORDER)

## 1. SEED EXTRACTION

Input:

```
{
  name,
  address,
  city,
  domain,
  phone,
  niche
}
```

Tasks:

* Normalize:

  * lowercase
  * remove special characters
  * trim whitespace
* Generate `normalized_name`

---

## 2. HYPOTHESIS GENERATION

Generate 3–5 high-quality search queries:

Examples:

```
"[business name] [city] contact"
"[business name] email"
"site:linkedin.com/company [business name]"
"site:instagram.com [business name]"
"[domain] contact"
```

Goal:

* Maximize discovery of external sources

---

## 3. MULTI-SOURCE FETCHING (PARALLEL)

You MUST implement adapters as independent modules:

```
/src/enrichment/sources/
  serp.ts
  website.ts
  directory.ts
  social.ts
  dns.ts
  whois.ts
```

### REQUIRED APPROACHES (MULTI-STRATEGY)

#### A. SERP ADAPTER

* Use DuckDuckGo / Yahoo scraping OR API
* Extract:

  * official website
  * social links
  * directories

#### B. WEBSITE ADAPTER (ENHANCED)

* Reuse existing crawler but upgrade:

  * email extraction:

    * regex (standard + obfuscated)
    * decode patterns: `info [at] domain.com`, `%40`, HTML entities
  * phone extraction:

    * regex global formats
  * social extraction:

    * anchor tag pattern match

#### C. DIRECTORY ADAPTER

Scrape:

* YellowPages
* Yelp
* BBB

Extract:

* phone
* address
* sometimes email

#### D. SOCIAL ADAPTER

Detect:

* LinkedIn company page
* Instagram business profile
* Facebook page

Extract:

* profile URLs
* possible contact info

#### E. INFRASTRUCTURE ADAPTER

* DNS lookup
* MX record validation
* WHOIS

Use cases:

* validate domain
* verify email domain

---

## 4. DATA NORMALIZATION

Convert all raw data into unified schema:

```
{
  emails: string[],
  phones: string[],
  socials: {
    linkedin?: string,
    instagram?: string,
    facebook?: string
  },
  people: [
    { name: string, title: string }
  ]
}
```

Rules:

* deduplicate
* normalize phone to international format
* lowercase emails
* remove invalid entries

---

## 5. CROSS-VALIDATION ENGINE

Compare data across sources:

Examples:

* Same email appears in 2+ sources → boost confidence
* Domain matches business website → boost
* Name + city match → boost

Implement:

```
validateAcrossSources(field, values[]) => score
```

---

## 6. CONFIDENCE SCORING ENGINE

You MUST implement scoring formula:

```
confidence =
  (sourceReliability * 0.4) +
  (fieldMatch * 0.3) +
  (freshness * 0.2) +
  (crossValidation * 0.1)
```

### Source Reliability Weights:

* Official website: 0.9
* Directory: 0.7
* SERP snippet: 0.5
* Raw scrape: 0.4

### Rules:

* ≥ 0.75 → auto commit
* 0.5–0.74 → mark as LOW CONFIDENCE
* < 0.5 → discard

---

## 7. MULTI-APPROACH SCORING STRATEGY (IMPORTANT)

You MUST combine:

### Approach 1 — Deterministic

* Rule-based scoring

### Approach 2 — Heuristic

* Fuzzy matching (Levenshtein similarity)
* Domain similarity
* Pattern detection

### Approach 3 — Redundancy Boost

* Same value across multiple sources increases confidence

---

## 8. DATABASE DESIGN (MANDATORY)

### Extend `leads` table:

Add:

```
verified_emails JSON
verified_phones JSON
verified_socials JSON
confidence_scores JSON
```

### Create NEW TABLE:

```
enrichment_audit
```

Fields:

```
lead_id
field_name
value
source
confidence
raw_snippet
timestamp
```

---

## 9. QUEUE SYSTEM (MANDATORY)

Implement using:

* Redis
* BullMQ

Flow:

```
User clicks "Deep Enrich"
→ Job added to queue
→ Worker processes
→ Result saved
→ Event emitted
```

---

## 10. FALLBACK STRATEGY

If primary sources fail:

```
SERP → Playwright scrape → DNS/WHOIS → mark failed
```

---

# ⚡ PERFORMANCE REQUIREMENTS

* Parallel execution using Promise.all
* Timeout per source: 15 seconds
* Use AbortController
* Rate limiting + exponential backoff
* Cache DNS/WHOIS for 24h

---

# 🖥 UI REQUIREMENTS

Display enriched data with confidence:

```
Email: info@company.com   ✅ 92%
Phone: +628123...         ⚠️ 63%
LinkedIn: Found           ✅
```

Features:

* Deep Enrich button
* Real-time progress
* Field-level confidence badges

---

# 📊 SUCCESS METRICS

* Data completeness ≥ 85%
* Enrichment success ≥ 70%
* Processing time < 10 seconds
* Manual research ≈ 0

---

# 🚨 CRITICAL RISKS

1. False positives → solved with scoring
2. Rate limits → use retry + proxy
3. Performance → queue + timeout
4. Data inconsistency → normalization

---

# 🧪 MVP SCOPE (PHASE 1)

You MUST deliver:

* Email discovery (real extraction)
* Phone enrichment
* Social detection
* Confidence scoring (basic)
* Queue system
* Audit log

---

# 🧭 FINAL INSTRUCTION

Build this as a **modular, extensible system**, not a hack.

Each component MUST:

* Be isolated
* Be testable
* Be replaceable

DO NOT tightly couple logic.

---

# 🔥 END GOAL

Transform system from:

> scraper

into:

> **intelligence-grade lead enrichment engine**

---

Execute this with production-level quality.
