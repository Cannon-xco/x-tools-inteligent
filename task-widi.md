 # Task: WIDI — Redis/BullMQ + Levenshtein + Code Review

**Branch:** `feat/queue-upgrade`
**Estimasi:** 1–2 hari
**Role:** Tech Lead — task paling kompleks, paralel dengan tim lain

---

## 🎯 Tujuan

1. Upgrade sistem queue dari in-memory ke Redis + BullMQ (production-ready)
2. Implementasi Levenshtein fuzzy matching di confidence engine
3. Code review semua PR dari tim

---

## ✅ TASK 1 — Redis + BullMQ Queue Upgrade

### Install packages

```bash
npm install bullmq ioredis
npm install -D @types/ioredis
```

### File yang dibuat

```
src/enrichment/queue/bullmq-queue.ts   ← implementasi baru
```

### Interface yang harus diimplementasikan

Lihat `src/enrichment/queue/dee-queue.ts` — ada interface `IDeeQueue`. Buat class `BullMQQueue` yang implements interface tersebut:

```typescript
// src/enrichment/queue/bullmq-queue.ts
import { Queue, Worker, QueueEvents } from 'bullmq';
import type { IDeeQueue, EnrichJob } from './dee-queue';

export class BullMQQueue implements IDeeQueue {
  private queue: Queue;
  private worker: Worker | null = null;

  constructor(redisUrl: string) {
    const connection = { url: redisUrl };
    this.queue = new Queue('dee-enrichment', { connection });
  }

  async enqueue(job: EnrichJob): Promise<string> {
    const bullJob = await this.queue.add('enrich', job, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
    return bullJob.id ?? '';
  }

  async startWorker(processor: (job: EnrichJob) => Promise<void>): Promise<void> {
    this.worker = new Worker(
      'dee-enrichment',
      async (job) => processor(job.data as EnrichJob),
      { connection: { url: process.env.REDIS_URL } }
    );
  }

  async getStatus(jobId: string): Promise<'pending' | 'processing' | 'completed' | 'failed'> {
    const job = await this.queue.getJob(jobId);
    if (!job) return 'failed';
    const state = await job.getState();
    if (state === 'completed') return 'completed';
    if (state === 'failed') return 'failed';
    if (state === 'active') return 'processing';
    return 'pending';
  }
}
```

### Factory function

Di `src/enrichment/queue/dee-queue.ts`, tambahkan factory yang memilih queue berdasarkan env:

```typescript
export function createQueue(): IDeeQueue {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const { BullMQQueue } = require('./bullmq-queue');
    return new BullMQQueue(redisUrl);
  }
  // Fallback ke in-memory (untuk development tanpa Redis)
  return new InMemoryQueue();
}
```

---

## ✅ TASK 2 — Levenshtein Fuzzy Matching di Confidence Engine

### File yang diubah

```
src/enrichment/scoring/confidence-engine.ts
```

### Yang harus diimplementasikan

Ganti fungsi similarity yang ada (word count-based) dengan Levenshtein distance:

```typescript
/**
 * Hitung Levenshtein distance antara dua string.
 * Digunakan untuk fuzzy matching nama bisnis.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Hitung similarity score 0-1 menggunakan Levenshtein.
 * 1.0 = identik, 0.0 = sama sekali berbeda.
 */
export function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const normA = a.toLowerCase().trim();
  const normB = b.toLowerCase().trim();
  if (normA === normB) return 1;
  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1;
  const dist = levenshteinDistance(normA, normB);
  return 1 - dist / maxLen;
}
```

Gunakan `stringSimilarity` di tempat yang sebelumnya menggunakan word count similarity untuk cross-validation nama bisnis.

---

## ✅ TASK 3 — Code Review Semua PR Tim

Setelah masing-masing anggota submit PR:

**Checklist per PR:**
- [ ] `npx tsc --noEmit` → 0 errors (jalankan lokal)
- [ ] Tidak ada hardcoded API key atau secret
- [ ] Tidak ada `console.log` yang tertinggal di production code
- [ ] Function punya JSDoc comment
- [ ] Logic sudah sesuai dengan task yang diberikan
- [ ] Tidak ada breaking change ke existing code

**PR yang harus di-review:**
- [ ] `feat/email-setup` (Yastika) — env + package install
- [ ] `feat/email-send-api` (Dekres) — API route
- [ ] `feat/send-email-button` (Prayoga) — component
- [ ] `feat/dashboard-email-ui` (Qiuqiu) — dashboard integration

---

## ✅ TASK 4 — Integration Testing Setelah Semua PR Merge

Setelah semua PR di-merge ke `main`:

1. Pull latest `main`
2. Jalankan `npm install` (untuk package baru dari Yastika)
3. Set `.env.local` dengan `RESEND_API_KEY` valid
4. Jalankan `npx tsc --noEmit` → harus 0 errors
5. Test end-to-end:
   - Search lead → generate outreach → klik "Send Email" → isi email → kirim
   - Cek inbox Resend dashboard: [resend.com/emails](https://resend.com/emails)
   - Cek badge "📨 Sent" muncul di lead row
   - Cek stats card "Sent" berubah

---

## 📋 Checklist Selesai

- [ ] `BullMQQueue` class sudah dibuat dan bisa di-swap dengan `InMemoryQueue`
- [ ] `levenshteinDistance` + `stringSimilarity` sudah ada di confidence engine
- [ ] `createQueue()` factory sudah bisa memilih berdasarkan `REDIS_URL` env
- [ ] Semua 4 PR dari tim sudah di-review dan diapprove
- [ ] Integration test end-to-end berhasil

---

## 🚀 Cara Submit

```bash
git checkout -b feat/queue-upgrade
git add src/enrichment/queue/bullmq-queue.ts src/enrichment/queue/dee-queue.ts src/enrichment/scoring/confidence-engine.ts
git commit -m "feat(queue): add BullMQ adapter + Levenshtein similarity for confidence engine"
git push origin feat/queue-upgrade
```
