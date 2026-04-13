// ============================================================
// DEEP ENRICHMENT ENGINE — Queue System
//
// In-memory job queue for deep enrichment processing.
// Designed with an abstract interface so Redis/BullMQ can
// replace InMemoryQueue without changing consumer code.
//
// ⛔ This is a NEW file. Does NOT modify existing code.
// ============================================================

import type { DeepEnrichInput, DeepEnrichResult, DeeJob, JobStatus } from '../types';

// ── Queue Interface ──────────────────────────────────────────

export interface IDeeQueue {
  add(input: DeepEnrichInput): Promise<string>;
  getJob(jobId: string): Promise<DeeJob | null>;
  getStatus(jobId: string): Promise<JobStatus | null>;
  updateJob(jobId: string, update: Partial<DeeJob>): Promise<void>;
  onProcess(handler: (job: DeeJob) => Promise<DeepEnrichResult>): void;
}

// ── In-Memory Queue Implementation ──────────────────────────

/**
 * Simple in-memory job queue for development and MVP.
 * Jobs are stored in a Map and processed sequentially.
 * Replace with Redis/BullMQ adapter for production scaling.
 */
class InMemoryQueue implements IDeeQueue {
  private jobs = new Map<string, DeeJob>();
  private pending: string[] = [];
  private processing = false;
  private handler: ((job: DeeJob) => Promise<DeepEnrichResult>) | null = null;
  private jobCounter = 0;
  private listeners = new Map<string, Array<(job: DeeJob) => void>>();

  /**
   * Add a new deep enrichment job to the queue.
   * @returns Job ID
   */
  async add(input: DeepEnrichInput): Promise<string> {
    const jobId = `dee_${Date.now()}_${++this.jobCounter}`;

    const job: DeeJob = {
      id: jobId,
      input,
      status: 'queued',
      createdAt: new Date(),
    };

    this.jobs.set(jobId, job);
    this.pending.push(jobId);

    // Trigger processing if handler is set
    this.processNext();

    return jobId;
  }

  /**
   * Get full job details by ID.
   */
  async getJob(jobId: string): Promise<DeeJob | null> {
    return this.jobs.get(jobId) ?? null;
  }

  /**
   * Get just the status of a job.
   */
  async getStatus(jobId: string): Promise<JobStatus | null> {
    const job = this.jobs.get(jobId);
    return job?.status ?? null;
  }

  /**
   * Update a job with partial data.
   */
  async updateJob(jobId: string, update: Partial<DeeJob>): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;
    Object.assign(job, update);
    this.jobs.set(jobId, job);

    // Notify listeners
    const jobListeners = this.listeners.get(jobId);
    if (jobListeners && (update.status === 'completed' || update.status === 'failed')) {
      for (const listener of jobListeners) {
        listener(job);
      }
      this.listeners.delete(jobId);
    }
  }

  /**
   * Register the job processing handler.
   * Only one handler is supported (last one wins).
   */
  onProcess(handler: (job: DeeJob) => Promise<DeepEnrichResult>): void {
    this.handler = handler;
    // Process any pending jobs
    this.processNext();
  }

  /**
   * Wait for a specific job to complete.
   * Returns the completed job or null on timeout.
   */
  async waitForJob(jobId: string, timeoutMs: number = 60_000): Promise<DeeJob | null> {
    const job = this.jobs.get(jobId);
    if (job && (job.status === 'completed' || job.status === 'failed')) {
      return job;
    }

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve(this.jobs.get(jobId) ?? null);
      }, timeoutMs);

      const listeners = this.listeners.get(jobId) || [];
      listeners.push((completedJob) => {
        clearTimeout(timer);
        resolve(completedJob);
      });
      this.listeners.set(jobId, listeners);
    });
  }

  /**
   * Get queue statistics.
   */
  getStats(): { total: number; queued: number; processing: number; completed: number; failed: number } {
    const jobs = Array.from(this.jobs.values());
    return {
      total: jobs.length,
      queued: jobs.filter((j) => j.status === 'queued').length,
      processing: jobs.filter((j) => j.status === 'processing').length,
      completed: jobs.filter((j) => j.status === 'completed').length,
      failed: jobs.filter((j) => j.status === 'failed').length,
    };
  }

  /**
   * Process the next pending job (sequential processing).
   */
  private async processNext(): Promise<void> {
    if (this.processing || !this.handler || this.pending.length === 0) return;

    this.processing = true;
    const jobId = this.pending.shift()!;
    const job = this.jobs.get(jobId);

    if (!job) {
      this.processing = false;
      this.processNext();
      return;
    }

    try {
      await this.updateJob(jobId, { status: 'processing', startedAt: new Date() });

      const result = await this.handler(job);

      await this.updateJob(jobId, {
        status: 'completed',
        result,
        completedAt: new Date(),
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await this.updateJob(jobId, {
        status: 'failed',
        error: errorMsg,
        completedAt: new Date(),
      });
    } finally {
      this.processing = false;
      // Process next job in queue
      this.processNext();
    }
  }

  /**
   * Clear all completed/failed jobs older than maxAge.
   */
  cleanup(maxAgeMs: number = 3600_000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, job] of this.jobs) {
      if (
        (job.status === 'completed' || job.status === 'failed') &&
        job.completedAt &&
        now - job.completedAt.getTime() > maxAgeMs
      ) {
        this.jobs.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// ── Singleton Instance ───────────────────────────────────────

let queueInstance: InMemoryQueue | null = null;

/**
 * Get the singleton queue instance.
 *
 * Currently uses InMemoryQueue (sufficient for single-instance Railway deploy).
 * When REDIS_URL is set AND `bullmq`/`ioredis` are installed, swap this
 * function to return a BullMQ-backed adapter that implements IDeeQueue.
 */
function getQueue(): InMemoryQueue {
  if (!queueInstance) {
    if (process.env.REDIS_URL) {
      console.warn(
        '[DEE Queue] REDIS_URL is set but BullMQ adapter is not installed. ' +
        'Falling back to InMemoryQueue. ' +
        'Run `npm install bullmq ioredis` and create src/enrichment/queue/bullmq-queue.ts ' +
        'to enable Redis-backed persistence.'
      );
    }
    queueInstance = new InMemoryQueue();
  }
  return queueInstance;
}

// ── Public API ───────────────────────────────────────────────

/**
 * Add a deep enrichment job to the queue.
 * @returns Job ID for tracking
 */
export async function addDeepEnrichJob(
  leadId: number,
  data: DeepEnrichInput
): Promise<string> {
  return getQueue().add({ ...data, leadId });
}

/**
 * Get the current status of a job.
 */
export async function getJobStatus(jobId: string): Promise<JobStatus | null> {
  return getQueue().getStatus(jobId);
}

/**
 * Get full job details including result.
 */
export async function getJobDetails(jobId: string): Promise<DeeJob | null> {
  return getQueue().getJob(jobId);
}

/**
 * Wait for a job to complete (blocks until done or timeout).
 */
export async function waitForJob(jobId: string, timeoutMs?: number): Promise<DeeJob | null> {
  return getQueue().waitForJob(jobId, timeoutMs);
}

/**
 * Register the job processing handler (called by dee-worker).
 */
export function registerProcessor(handler: (job: DeeJob) => Promise<DeepEnrichResult>): void {
  getQueue().onProcess(handler);
}

/**
 * Get queue statistics.
 */
export function getQueueStats() {
  return getQueue().getStats();
}

/**
 * Cleanup old completed/failed jobs.
 */
export function cleanupQueue(maxAgeMs?: number): number {
  return getQueue().cleanup(maxAgeMs);
}
