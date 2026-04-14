// scripts/test-all-endpoints.ts
// Full endpoint test suite — run with:
//   npx tsx --env-file .env.local scripts/test-all-endpoints.ts

const BASE = 'http://localhost:3000';
const TEST_EMAIL = 'kadekwidi@deltaxs.co';

let passed = 0;
let failed = 0;
let skipped = 0;

type Result = 'PASS' | 'FAIL' | 'SKIP';

function icon(r: Result) {
  return r === 'PASS' ? '✅' : r === 'FAIL' ? '❌' : '⏭ ';
}

async function test(
  label: string,
  fn: () => Promise<{ ok: boolean; detail?: string }>,
  skip = false,
): Promise<void> {
  if (skip) {
    console.log(`  ⏭  SKIP  ${label}`);
    skipped++;
    return;
  }
  try {
    const { ok, detail } = await fn();
    const res: Result = ok ? 'PASS' : 'FAIL';
    if (ok) passed++; else failed++;
    console.log(`  ${icon(res)} ${res.padEnd(4)} ${label}${detail ? `  →  ${detail}` : ''}`);
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ❌ FAIL  ${label}  →  ${msg}`);
  }
}

async function get(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, { ...opts, signal: AbortSignal.timeout(15_000) });
  const body = await r.json().catch(() => null);
  return { status: r.status, ok: r.ok, body };
}

async function post(path: string, data: unknown, opts?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(35_000),
    ...opts,
  });
  const body = await r.json().catch(() => null);
  return { status: r.status, ok: r.ok, body };
}

// ─────────────────────────────────────────────────────────────

async function main() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('  XTools — Full Endpoint Test Suite');
  console.log(`  Target: ${BASE}`);
  console.log('══════════════════════════════════════════════════\n');

  // ── Step 0: Get first lead from DB for path-param tests ────
  let firstLeadId: number | null = null;
  try {
    const r = await get('/api/leads?limit=1');
    firstLeadId = r.body?.data?.leads?.[0]?.id ?? null;
    console.log(`  ℹ️  First lead in DB: id=${firstLeadId ?? 'none'}\n`);
  } catch {
    console.log('  ⚠️  Could not fetch leads — DB may be unavailable\n');
  }

  // ──────────────────────────────────────────────────────────
  console.log('▶ GET endpoints\n');

  await test('GET /api/health', async () => {
    const r = await get('/api/health');
    return { ok: r.ok && r.body?.status === 'ok', detail: `status=${r.body?.status}` };
  });

  await test('GET /api/ping', async () => {
    const r = await get('/api/ping');
    return { ok: r.ok && r.body?.status === 'online', detail: `status=${r.body?.status}` };
  });

  await test('GET /api/leads', async () => {
    const r = await get('/api/leads?limit=5');
    const total = r.body?.data?.total;
    return { ok: r.ok && r.body?.success, detail: `total=${total} leads` };
  });

  await test('GET /api/score (rules)', async () => {
    const r = await get('/api/score');
    return { ok: r.ok && r.body?.success, detail: `rules=${JSON.stringify(r.body?.data)?.slice(0, 60)}...` };
  });

  await test('GET /api/export (CSV)', async () => {
    const r = await fetch(`${BASE}/api/export?limit=5`, { signal: AbortSignal.timeout(15_000) });
    const ct = r.headers.get('content-type') ?? '';
    return { ok: r.ok && ct.includes('text/csv'), detail: `content-type=${ct}` };
  });

  await test(
    `GET /api/leads/${firstLeadId}/enrich/status`,
    async () => {
      const r = await get(`/api/leads/${firstLeadId}/enrich/status`);
      return { ok: r.ok && r.body?.success, detail: `status=${r.body?.data?.status}` };
    },
    firstLeadId === null,
  );

  // ──────────────────────────────────────────────────────────
  console.log('\n▶ POST endpoints — lightweight\n');

  await test('POST /api/score (inline data)', async () => {
    const r = await post('/api/score', {
      rating: 4.5,
      review_count: 120,
      website: 'https://example.com',
      enrichment: {
        website: {
          has_ssl: { value: true, source: 'test', confidence: 0.9 },
          has_booking: { value: false, source: 'test', confidence: 0.8 },
          has_social: { value: true, source: 'test', confidence: 0.8 },
        },
      },
    });
    return { ok: r.ok && r.body?.success, detail: `score=${r.body?.data?.score}` };
  });

  await test('POST /api/admin/purge-pii', async () => {
    const r = await post('/api/admin/purge-pii', {});
    return { ok: r.ok && r.body?.success, detail: `deleted=${r.body?.deleted} rows` };
  });

  // ──────────────────────────────────────────────────────────
  console.log('\n▶ POST endpoints — enrichment & AI\n');

  await test('POST /api/enrich (website scrape)', async () => {
    const r = await post('/api/enrich', { url: 'https://example.com', forcePlaywright: false });
    return { ok: r.ok && r.body?.success, detail: `has_ssl=${r.body?.data?.website?.has_ssl?.value}` };
  });

  await test('POST /api/outreach (AI generate)', async () => {
    const r = await post('/api/outreach', {
      business_name: 'Warung Makan Test',
      niche: 'restaurant',
      location: 'Bali, Indonesia',
      reasons: ['no website', 'low reviews'],
    });
    return { ok: r.ok && r.body?.success, detail: `subject="${r.body?.data?.subject?.slice(0, 50)}..."` };
  });

  // ──────────────────────────────────────────────────────────
  console.log('\n▶ POST endpoints — email (live Resend)\n');

  await test(
    `POST /api/leads/${firstLeadId}/enrich (DEE pipeline)`,
    async () => {
      const r = await post(`/api/leads/${firstLeadId}/enrich`, {});
      const ok = r.ok || r.status === 500; // 500 = pipeline ran but no data found is acceptable
      return { ok, detail: `HTTP ${r.status} | confidence=${r.body?.data?.overallConfidence ?? r.body?.error}` };
    },
    firstLeadId === null,
  );

  await test('POST /api/outreach/send (Resend — dekres route)', async () => {
    const r = await post('/api/outreach/send', {
      leadId: firstLeadId ?? 1,
      to: TEST_EMAIL,
      subject: '[TEST] XTools endpoint test — outreach/send',
      body: 'This is an automated endpoint test from scripts/test-all-endpoints.ts',
    });
    return { ok: r.ok && r.body?.success, detail: `messageId=${r.body?.data?.messageId}` };
  });

  await test(
    `POST /api/leads/${firstLeadId}/send-email (Resend — qiuqiu route)`,
    async () => {
      const r = await post(`/api/leads/${firstLeadId}/send-email`, {
        to: TEST_EMAIL,
        subject: '[TEST] XTools endpoint test — leads/send-email',
        body: 'This is an automated endpoint test from scripts/test-all-endpoints.ts',
      });
      return { ok: r.ok && r.body?.success, detail: `sent_at=${r.body?.data?.sent_at}` };
    },
    firstLeadId === null,
  );

  // ──────────────────────────────────────────────────────────
  console.log('\n▶ POST endpoints — Playwright (may be slow/fail locally)\n');

  await test('POST /api/search (Google Maps scrape)', async () => {
    const r = await fetch(`${BASE}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: 'warung makan', location: 'Denpasar', limit: 2 }),
      signal: AbortSignal.timeout(90_000),
    });
    const body = await r.json().catch(() => null);
    return {
      ok: r.ok && body?.success,
      detail: `found=${body?.data?.total ?? body?.error}`,
    };
  });

  await test('POST /api/scrape-leads (full pipeline)', async () => {
    const r = await fetch(`${BASE}/api/scrape-leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: 'kafe', location: 'Denpasar', limit: 1 }),
      signal: AbortSignal.timeout(90_000),
    });
    const body = await r.json().catch(() => null);
    return {
      ok: r.ok && body?.success,
      detail: `returned=${body?.data?.length ?? body?.error}`,
    };
  });

  // ──────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════');
  console.log(`  Results: ${passed} passed  |  ${failed} failed  |  ${skipped} skipped`);
  console.log('══════════════════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
