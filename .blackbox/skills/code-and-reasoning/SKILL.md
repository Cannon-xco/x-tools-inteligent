---

name: code-and-reasoning
description: Execute complex engineering tasks by combining structured reasoning with production-grade code generation. Use this skill when implementing multi-module systems, pipelines, or distributed architectures such as enrichment engines, scrapers, or backend services.
---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# 🧠 Code And Reasoning

## 🎯 Purpose

This skill is designed to:

* Break down complex engineering problems into **clear, deterministic steps**
* Guide agents to produce **modular, production-ready code**
* Ensure **correct architecture decisions**, not just code generation
* Prevent shallow or fragmented implementations

---

# ⚙️ CORE INSTRUCTIONS (MANDATORY EXECUTION STYLE)

When using this skill, ALWAYS follow this sequence:

---

## 1. 🔍 Understand the System Context

Before writing any code:

* Identify:

  * System type (e.g. pipeline, API, worker, scraper)
  * Existing architecture (monolith, microservice, queue-based)
  * Input/output contracts
* Clarify:

  * What already exists
  * What needs to be built

---

## 2. 🧩 Decompose into Modules

Break the task into **clear, isolated components**:

Example:

* Core engine
* Adapters
* Processing layer
* Scoring logic
* Infrastructure (queue, DB)

Each module MUST:

* Have a single responsibility
* Be independently testable
* Avoid tight coupling

---

## 3. 🧠 Define Data Flow First

Before coding, define:

```ts
Input → Transform → Output
```

Example:

```ts
Lead → Enrichment → Normalized Data → Scored Output
```

You MUST:

* Specify intermediate formats
* Avoid implicit transformations
* Keep schemas consistent

---

## 4. 🏗 Design Before Coding

For each module:

* Define function signatures
* Define expected inputs/outputs
* Define dependencies

DO NOT jump directly to implementation.

---

## 5. 💻 Implement in Layers

Follow strict layering:

1. Core logic (pure functions)
2. Adapters (external data)
3. Orchestration (pipeline)
4. Infrastructure (queue, API, DB)

---

## 6. ⚡ Enforce Execution Rules

You MUST enforce:

* Parallel execution where applicable (`Promise.all`)
* Timeouts for all external calls
* Retry with exponential backoff
* Graceful failure (never crash pipeline)

---

## 7. 🧪 Add Validation & Safety

Always include:

* Input validation
* Data normalization
* Deduplication
* Error boundaries

---

## 8. 📊 Add Scoring / Decision Logic (If Applicable)

If system involves uncertainty:

* Implement deterministic scoring
* Use weighted formulas
* Define thresholds for:

  * accept
  * review
  * reject

---

## 9. 💾 Persistence Strategy

If data is stored:

* Define schema updates
* Use idempotent operations (UPSERT)
* Log changes (audit trail)

---

## 10. 🔌 Integration Layer

Ensure:

* API endpoints are minimal and clean
* Workers handle heavy tasks
* UI receives structured results

---

# 🚫 ANTI-PATTERNS (DO NOT DO)

* ❌ Writing monolithic functions
* ❌ Mixing scraping + scoring + DB in one file
* ❌ No validation / normalization
* ❌ Hardcoding logic inside adapters
* ❌ Ignoring timeouts or retries
* ❌ Returning inconsistent data structures

---

# ✅ EXPECTED OUTPUT FORMAT

When executing tasks, ALWAYS produce:

1. Architecture breakdown
2. Module structure (folders/files)
3. Function-level design
4. Clean TypeScript implementation
5. Example input/output

---

# 🧪 EXAMPLES

---

## Example 1 — Building an Enrichment Pipeline

### Step 1 — Define Flow

```ts
Lead → Fetch Sources → Normalize → Validate → Score → Output
```

---

### Step 2 — Define Modules

```ts
src/enrichment/
  core/
    engine.ts
    pipeline.ts
    scorer.ts
  sources/
    serp.ts
    website.ts
```

---

### Step 3 — Function Design

```ts
async function runEnrichment(leadId: number): Promise<EnrichedResult>
```

---

### Step 4 — Output

```ts
{
  emails: [{ value: "info@abc.com", confidence: 0.91 }],
  phones: [{ value: "+628123", confidence: 0.82 }],
  socials: { linkedin: "...", instagram: "..." }
}
```

---

## Example 2 — Adapter Implementation

```ts
export async function fetchWebsiteData(url: string) {
  // fetch HTML
  // extract emails
  // return structured data
}
```

---

## Example 3 — Scoring Logic

```ts
function calculateConfidence(input) {
  return (
    input.sourceReliability * 0.4 +
    input.matchScore * 0.3 +
    input.freshness * 0.2 +
    input.crossValidation * 0.1
  );
}
```

---

# 🧭 FINAL PRINCIPLE

You are NOT just writing code.

You are:

> Designing a system that must be scalable, testable, and production-ready.

Every decision must prioritize:

* clarity
* modularity
* correctness
* performance

---

# 🚀 END
