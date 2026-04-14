// ============================================================
// Tests: DEE Queue — createQueue factory & InMemoryQueue API
// Runner: vitest
// ============================================================

import { describe, it, expect, afterEach, vi } from 'vitest';
import { createQueue, addDeepEnrichJob, getJobStatus, getQueueStats } from '../queue/dee-queue';
import type { DeepEnrichInput } from '../types';

const sampleInput: DeepEnrichInput = {
  leadId: 1,
  name: 'Warung Makan Sari',
  address: 'Jl. Sudirman No. 5, Jakarta',
  domain: 'warungtested.com',
};

// ── Factory selection ──────────────────────────────────────────

describe('createQueue factory', () => {
  afterEach(() => {
    delete process.env.REDIS_URL;
    vi.resetModules();
  });

  it('returns InMemoryQueue when REDIS_URL is not set', () => {
    delete process.env.REDIS_URL;
    const queue = createQueue();
    // InMemoryQueue has no .queue property (BullMQ-specific)
    expect(typeof queue.add).toBe('function');
    expect(typeof queue.getJob).toBe('function');
    expect(typeof queue.getStatus).toBe('function');
    expect(typeof queue.onProcess).toBe('function');
    expect(typeof queue.waitForJob).toBe('function');
    expect(typeof queue.getStats).toBe('function');
    expect(typeof queue.cleanup).toBe('function');
  });

  it('InMemoryQueue instance satisfies full IDeeQueue contract', async () => {
    const queue = createQueue();
    const jobId = await queue.add(sampleInput);
    expect(typeof jobId).toBe('string');
    expect(jobId.length).toBeGreaterThan(0);
  });
});

// ── InMemoryQueue behaviour ────────────────────────────────────

describe('InMemoryQueue — job lifecycle', () => {
  it('newly added job has status "queued"', async () => {
    const jobId = await addDeepEnrichJob(sampleInput.leadId, sampleInput);
    const status = await getJobStatus(jobId);
    expect(status).toBe('queued');
  });

  it('getJobStatus returns null for unknown jobId', async () => {
    const status = await getJobStatus('nonexistent-id-000');
    expect(status).toBeNull();
  });

  it('getQueueStats includes the newly added job in total', async () => {
    const before = await getQueueStats();
    await addDeepEnrichJob(sampleInput.leadId, sampleInput);
    const after = await getQueueStats();
    expect(after.total).toBeGreaterThan(before.total);
  });

  it('processed job transitions from queued → processing → completed', async () => {
    // Use createQueue directly to control onProcess
    const queue = createQueue();

    const jobId = await queue.add(sampleInput);
    expect(await queue.getStatus(jobId)).toBe('queued');

    // Register a processor that resolves immediately
    queue.onProcess(async (job) => ({
      leadId: job.input.leadId,
      emails: [],
      phones: [],
      socials: {},
      people: [],
      overallConfidence: 0.9,
      sources_used: ['test'],
      duration_ms: 1,
      enriched_at: new Date().toISOString(),
    }));

    // Wait up to 3 seconds for the job to complete
    const result = await queue.waitForJob(jobId, 3000);
    expect(result?.status).toBe('completed');
  });

  it('processor error sets job status to failed', async () => {
    const queue = createQueue();
    const jobId = await queue.add(sampleInput);

    queue.onProcess(async () => {
      throw new Error('Simulated processor error');
    });

    const result = await queue.waitForJob(jobId, 3000);
    expect(result?.status).toBe('failed');
    expect(result?.error).toContain('Simulated processor error');
  });

  it('cleanup removes completed jobs and returns count', async () => {
    const queue = createQueue();
    const jobId = await queue.add(sampleInput);

    queue.onProcess(async (job) => ({
      leadId: job.input.leadId,
      emails: [],
      phones: [],
      socials: {},
      people: [],
      overallConfidence: 0.5,
      sources_used: [],
      duration_ms: 1,
      enriched_at: new Date().toISOString(),
    }));

    await queue.waitForJob(jobId, 3000);

    // cleanup with maxAge=-1: age > -1 is always true → removes all completed/failed jobs
    const cleaned = queue.cleanup(-1);
    expect(cleaned).toBeGreaterThanOrEqual(1);
  });
});
