# DEE Architecture & Data Flow

Deep Enrichment Engine (DEE) — XTools Intelligent

```mermaid
flowchart TD
    A([Dashboard\nUser clicks Deep Enrich]) -->|POST /api/leads/:id/enrich| B[API Route\nValidate lead\nSet status=processing]
    B -->|addDeepEnrichJob| C[(InMemoryQueue\nfuture: Redis/BullMQ)]
    C -->|processJob| D[DEE Worker]

    D --> E1[1. Seed Extractor\nnormalize name/city/domain]
    E1 --> E2[2. Hypothesis Generator\n3-7 SERP queries]
    E2 --> E3[3. Parallel Adapters\nPromise.allSettled]

    E3 --> S1[Website Adapter\nRegex + Playwright\nconf: 0.9]
    E3 --> S2[SERP Adapter\nDuckDuckGo + Yahoo\nconf: 0.5]
    E3 --> S3[Directory Adapter\nYP + Yelp + BBB + Chamber\nconf: 0.7]
    E3 --> S4[DNS Adapter\nA / MX / AAAA\ncache 24h]
    E3 --> S5[WHOIS Adapter\nRDAP lookup\ncache 24h]

    S1 & S2 & S3 & S4 & S5 -->|raw contacts| E4[Social Adapter\nDetect + verify\nLinkedIn/Instagram/FB]

    E4 --> E5[4. Normalization\nDedup + E.164 phone\nlowercase email]
    E5 --> E6[5. Cross-Validation\nMulti-source boost\ndomain match]
    E6 --> E7[6. Confidence Scoring\n0.4×src + 0.3×field\n+ 0.2×fresh + 0.1×cross]

    E7 -->|≥0.75 VERIFIED| DB1[(PostgreSQL\nleads table)]
    E7 -->|0.5-0.74 LOW_CONFIDENCE| DB1
    E7 -->|<0.5 DISCARDED| DB2[(enrichment_audit\naudit log)]
    E7 --> DB2

    DB1 -->|enrichment_status=completed\nor limit_reached| F[API Response]
    F -->|result JSON| G([Dashboard\nConfidence badges\nReal-time polling /status])
```

## Fallback Chain

```
fetch() → Playwright (JS-heavy sites) → DNS/WHOIS → mark limit_reached
```

## Database Schema

```sql
-- leads table (DEE columns)
ALTER TABLE leads ADD COLUMN verified_emails      TEXT;  -- JSON
ALTER TABLE leads ADD COLUMN verified_phones      TEXT;  -- JSON
ALTER TABLE leads ADD COLUMN verified_socials     TEXT;  -- JSON
ALTER TABLE leads ADD COLUMN confidence_scores    TEXT;  -- JSON
ALTER TABLE leads ADD COLUMN deep_enrichment_json TEXT;
ALTER TABLE leads ADD COLUMN deep_enriched_at     TIMESTAMP;
ALTER TABLE leads ADD COLUMN enrichment_status    TEXT;  -- processing|completed|failed|limit_reached

-- enrichment_audit table
CREATE TABLE enrichment_audit (
  id          SERIAL PRIMARY KEY,
  lead_id     INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  field_name  TEXT NOT NULL,
  value       TEXT NOT NULL,
  source      TEXT NOT NULL,
  confidence  REAL NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  raw_snippet TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Confidence Formula

```
confidence = (sourceReliability × 0.4)
           + (fieldMatchScore   × 0.3)
           + (freshnessWeight   × 0.2)
           + (crossValidation   × 0.1)

sourceReliability: website=0.9, directory=0.7, serp=0.5, scrape=0.4
threshold: ≥0.75 → VERIFIED | 0.5–0.74 → LOW_CONFIDENCE | <0.5 → DISCARDED
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/leads/:id/enrich` | Trigger deep enrichment |
| `GET`  | `/api/leads/:id/enrich/status` | Poll enrichment status |
| `POST` | `/api/deep-enrich` | Legacy endpoint (backward compat) |
| `GET`  | `/api/deep-enrich?id=:id` | Legacy status check |
| `POST` | `/api/admin/purge-pii` | Purge audit log entries older than 7 days |
