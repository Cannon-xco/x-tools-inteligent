# Auto Deep Enrichment Implementation Plan

## Objective
Modify `/api/scrape-leads` to automatically run deep-enrichment after lead creation.

## Current Flow
```
/api/scrape-leads → enrich Website + SEO + Tech → Save to DB
               ❌ LEAD TANPA deepEnrichment
```

## New Flow
```
/api/scrape-leads → enrich Website + SEO + Tech → Save to DB 
               → auto deep-enrich each lead → update DB with deepEnrichment
```

## Files to Modify

### 1. `src/app/api/scrape-leads/route.ts`
- Add import for DEE functions
- After lead upsert, auto-run deep-enrichment pipeline
- Update response with deep-enrichment data

### 2. `src/enrichment/queue/dee-queue.ts`
- Verify `addDeepEnrichJob` and `waitForJob` exports

### 3. `src/enrichment/pipeline/`
- May need to expose pipeline runner function

## Implementation Steps

1. **Add imports** to scrape-leads route:
```typescript
import { addDeepEnrichJob, waitForJob } from '@/enrichment/queue/dee-queue';
import { initDeeWorker } from '@/enrichment/queue/dee-worker';
```

2. **After upsertLead()**, add auto-deep-enrich:
```typescript
// Auto deep-enrich after lead is saved
try {
  initDeeWorker();
  const input = { leadId: lead.id, name: lead.name, address: lead.address, domain: lead.website };
  const jobId = await addDeepEnrichJob(lead.id, input);
  const job = await waitForJob(jobId, 30000);
  if (job?.result) {
    // Update lead with deep enrichment
    await updateLeadDeepEnrichment(lead.id, job.result);
  }
} catch (e) {
  console.error('Auto deep-enrich failed:', e);
}
```

3. **Return deepEnrichment in response**

## Testing Plan

1. Test POST `/api/scrape-leads` with new keyword/location
2. Check leads have `deepEnrichment` field populated
3. Verify emails, phones, socials extracted

## Risk/Considerations

- Timeout: Deep-enrich takes ~3-5 seconds per lead
- Need to handle rate limiting
- Concurrent leads: use queue with concurrency control

## Status
- [x] Plan created
- [x] Implement changes
- [x] Test endpoint
- [x] Verify data in DB

## Files Modified
1. `src/app/api/scrape-leads/route.ts` - Added auto deep-enrichment
2. `src/lib/db/client.ts` - Added `updateLeadDeepEnrichment()` function

## Test Result
- ✅ Lead 36: deepEnrichment with 8 phones, 1 social, 83% confidence
- ✅ Lead saved to DB with all data