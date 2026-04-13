// ============================================================
// DEEP ENRICHMENT ENGINE — BullMQ Queue Adapter
//
// Redis-backed production queue using BullMQ.
// Implements the IDeeQueue interface so it can drop-in replace
// InMemoryQueue without any changes to consumer code.
//
// Activated automatically when REDIS_URL env var is set.
// Falls back to InMemoryQueue when REDIS_URL is absent.
// ============================================================

import { Queue, Worker, type ConnectionOptions, type JobState } from 'bullmq';
import type { IDeeQueue } from './dee-queue';
import type { DeepEnrichInput, DeepEnrichResult, DeeJob, JobStatus } from '../types';

// ── Helpers ──────────────────────────────────────────────────

/**
 * Map BullMQ job state string to the DEE JobStatus type.
 */
function mapBullState(state: JobState | 'unknown'): JobStatus {
  if (state === 'completed') return 'completed';
  if (state === 'failed') return 'failed';
  if (state === 'active') return 'processing';
  return 'queued';
}

// ── BullMQ Adapter ───────────────────────────────────────────

/**
 * Production queue adapter backed by Redis via BullMQ.
 * Implements IDeeQueue — use createQueue() to obtain an instance.
 *
 * Features:
 *  - Persistent jobs survive server restarts
 *  - Automatic retry with exponential backoff (3 attempts)
 *  - Concurrent worker support
 *  - Job TTL: completed jobs kept 1 hour, failed jobs 24 hours
 */
export class BullMQQueue implements IDeeQueue {
  private readonly queue: Queue;
  private worker: Worker | null = null;
  private readonly connection: ConnectionOptions;

  constructor(redisUrl: string) {
    this.connection = { url: redisUrl };
    this.queue = new Queue('dee-enrichment', {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 3600 },      // keep 1 hour
        removeOnFail: { age: 86400 },         // keep 24 hours
      },
    });
  }

  /**
   * Add a deep enrichment job to the Redis queue.
   * @returns BullMQ job ID string
   */
  async add(input: DeepEnrichInput): Promise<string> {
    const job = await this.queue.add('enrich', input);
    return job.id ?? '';
  }

  /**
   * Retrieve full job details by ID.
   * Reconstructs a DeeJob from BullMQ job data.
   */
  async getJob(jobId: string): Promise<DeeJob | null> {
    const job = await this.queue.getJob(jobId);
    if (!job) return null;

    const state = await job.getState();
    const status = mapBullState(state);

    return {
      id: job.id ?? jobId,
      input: job.data as DeepEnrichInput,
      status,
      result: job.returnvalue as DeepEnrichResult | undefined,
      error: job.failedReason ?? undefined,
      createdAt: new Date(job.timestamp),
      startedAt: job.processedOn ? new Date(job.processedOn) : undefined,
      completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
    };
  }

  /**
   * Get only the status of a job.
   */
  async getStatus(jobId: string): Promise<JobStatus | null> {
    const job = await this.queue.getJob(jobId);
    if (!job) return null;
    const state = await job.getState();
    return mapBullState(state);
  }

  /**
   * Update a job with partial data.
   * BullMQ manages status internally via the Worker —
   * this updates the stored job data payload when needed.
   */
  async updateJob(jobId: string, update: Partial<DeeJob>): Promise<void> {
    const job = await this.queue.getJob(jobId);
    if (!job) return;
    if (update.result !== undefined || update.error !== undefined) {
      await job.updateData({ ...job.data, _meta: update });
    }
  }

  /**
   * Register the job processing handler.
   * Creates a BullMQ Worker that calls the handler for each job.
   */
  onProcess(handler: (job: DeeJob) => Promise<DeepEnrichResult>): void {
    if (this.worker) {
      void this.worker.close();
    }

    this.worker = new Worker(
      'dee-enrichment',
      async (bullJob) => {
        const deeJob: DeeJob = {
          id: bullJob.id ?? '',
          input: bullJob.data as DeepEnrichInput,
          status: 'processing',
          createdAt: new Date(bullJob.timestamp),
          startedAt: new Date(),
        };
        return handler(deeJob);
      },
      { connection: this.connection }
    );

    this.worker.on('failed', (job, err) => {
      console.error(`[BullMQQueue] Job ${job?.id ?? '?'} failed:`, err.message);
    });
  }

  /**
   * Poll until a job completes or the timeout expires.
   */
  async waitForJob(jobId: string, timeoutMs: number = 60_000): Promise<DeeJob | null> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const job = await this.getJob(jobId);
      if (!job) return null;
      if (job.status === 'completed' || job.status === 'failed') return job;
      await new Promise((r) => setTimeout(r, 500));
    }
    return this.getJob(jobId);
  }

  /**
   * Return queue statistics from Redis.
   */
  async getStats(): Promise<{ total: number; queued: number; processing: number; completed: number; failed: number }> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);
    return {
      total: waiting + active + completed + failed,
      queued: waiting,
      processing: active,
      completed,
      failed,
    };
  }

  /**
   * BullMQ handles cleanup automatically via removeOnComplete/removeOnFail.
   * This is a no-op — returns 0 cleaned.
   */
  cleanup(_maxAgeMs?: number): number {
    return 0;
  }

  /**
   * Gracefully close the queue and worker connections.
   */
  async close(): Promise<void> {
    if (this.worker) await this.worker.close();
    await this.queue.close();
  }
}
