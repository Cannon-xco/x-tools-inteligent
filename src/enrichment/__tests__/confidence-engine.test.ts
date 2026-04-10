// ============================================================
// Tests: Confidence Scoring Engine + Cross-Validator
// Run: npx tsx src/enrichment/__tests__/confidence-engine.test.ts
// ============================================================

import { calculateConfidence, scoreAllFields, calculateOverallConfidence } from '../scoring/confidence-engine';
import { validateAcrossSources, validateEmailDomain, calculateTotalBoost } from '../scoring/cross-validator';

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ ${testName}`);
      passed++;
    } else {
      console.log(`  ❌ ${testName}`);
      failed++;
    }
  }

  const now = new Date();

  console.log('\n🧪 Confidence Engine Tests\n');

  // ── Test 1: High confidence (official website source) ──

  console.log('Test 1: High confidence from official website');
  {
    const result = calculateConfidence(
      'email',
      'info@example.com',
      [{ name: 'dee_website_adapter:mailto', reliability: 0.95, timestamp: now }],
      0.2
    );

    assert(result.confidence >= 0.7, `Confidence >= 0.7 (got ${result.confidence})`);
    assert(result.status === 'VERIFIED', `Status is VERIFIED (got ${result.status})`);
    assert(result.field === 'email', 'Field type is email');
    assert(result.sources.length === 1, 'Has 1 source');
  }

  // ── Test 2: Low confidence (single raw source) ─────────

  console.log('\nTest 2: Low confidence from raw scrape');
  {
    const oldDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
    const result = calculateConfidence(
      'phone',
      '12345',
      [{ name: 'raw_scrape', reliability: 0.4, timestamp: oldDate }],
      0
    );

    assert(result.confidence < 0.5, `Confidence < 0.5 (got ${result.confidence})`);
    assert(result.status === 'DISCARDED', `Status is DISCARDED (got ${result.status})`);
  }

  // ── Test 3: Multi-source boost ─────────────────────────

  console.log('\nTest 3: Multi-source boost');
  {
    const result = calculateConfidence(
      'email',
      'contact@business.com',
      [
        { name: 'dee_website_adapter:regex', reliability: 0.85, timestamp: now },
        { name: 'directory', reliability: 0.7, timestamp: now },
        { name: 'dee_serp_adapter', reliability: 0.5, timestamp: now },
      ],
      0.3
    );

    assert(result.confidence >= 0.65, `Multi-source confidence >= 0.65 (got ${result.confidence})`);
    assert(result.sources.length === 3, 'Has 3 sources');
    assert(
      result.status === 'VERIFIED' || result.status === 'LOW_CONFIDENCE',
      `Status is VERIFIED or LOW_CONFIDENCE (got ${result.status})`
    );
  }

  // ── Test 4: Empty sources → DISCARDED ──────────────────

  console.log('\nTest 4: Empty sources');
  {
    const result = calculateConfidence('email', 'test@test.com', [], 0);
    assert(result.confidence === 0, 'Confidence is 0');
    assert(result.status === 'DISCARDED', 'Status is DISCARDED');
  }

  // ── Test 5: Batch scoring ──────────────────────────────

  console.log('\nTest 5: scoreAllFields batch');
  {
    const results = scoreAllFields([
      {
        field: 'email',
        value: 'info@biz.com',
        sources: [{ name: 'dee_website_adapter:mailto', timestamp: now }],
        crossValidationScore: 0.2,
      },
      {
        field: 'phone',
        value: '+628123456789',
        sources: [
          { name: 'dee_website_adapter:tel_link', timestamp: now },
          { name: 'directory', timestamp: now },
        ],
        crossValidationScore: 0.3,
      },
    ]);

    assert(results.length === 2, 'Returned 2 results');
    assert(results[0].field === 'email', 'First is email');
    assert(results[1].field === 'phone', 'Second is phone');
  }

  // ── Test 6: Overall confidence ─────────────────────────

  console.log('\nTest 6: calculateOverallConfidence');
  {
    const results = [
      { value: 'a@b.com', field: 'email' as const, confidence: 0.9, status: 'VERIFIED' as const, sources: [] },
      { value: '+123', field: 'phone' as const, confidence: 0.6, status: 'LOW_CONFIDENCE' as const, sources: [] },
    ];
    const overall = calculateOverallConfidence(results);
    assert(overall > 0, `Overall > 0 (got ${overall})`);
    assert(overall <= 1, `Overall <= 1 (got ${overall})`);
  }

  console.log('\n🧪 Cross-Validator Tests\n');

  // ── Test 7: Cross-validation with matching sources ─────

  console.log('Test 7: Cross-validation matching');
  {
    const result = validateAcrossSources('email', [
      { value: 'info@biz.com', source: 'website' },
      { value: 'info@biz.com', source: 'directory' },
      { value: 'other@biz.com', source: 'serp' },
    ]);

    assert(result.matchCount === 2, `Match count is 2 (got ${result.matchCount})`);
    assert(result.boostScore >= 0.2, `Boost >= 0.2 (got ${result.boostScore})`);
    assert(result.matchingSources.includes('website'), 'Includes website source');
    assert(result.matchingSources.includes('directory'), 'Includes directory source');
  }

  // ── Test 8: Email domain matches business website ──────

  console.log('\nTest 8: Email domain validation');
  {
    const boost = validateEmailDomain('info@mybusiness.com', 'https://www.mybusiness.com');
    assert(boost > 0, `Domain match boost > 0 (got ${boost})`);

    const noBoost = validateEmailDomain('info@gmail.com', 'https://mybusiness.com');
    assert(noBoost === 0, `No boost for mismatched domain (got ${noBoost})`);
  }

  // ── Test 9: Total boost calculation ────────────────────

  console.log('\nTest 9: Total boost calculation');
  {
    const boost = calculateTotalBoost(
      'email',
      'info@mybiz.com',
      ['dee_website_adapter', 'directory', 'serp'],
      { businessWebsite: 'https://mybiz.com' }
    );

    assert(boost >= 0.2, `Total boost >= 0.2 with 3 sources (got ${boost})`);
    assert(boost <= 1.0, `Total boost <= 1.0 (got ${boost})`);
  }

  // ── Test 10: Empty cross-validation ────────────────────

  console.log('\nTest 10: Empty cross-validation');
  {
    const result = validateAcrossSources('phone', []);
    assert(result.matchCount === 0, 'Match count is 0');
    assert(result.boostScore === 0, 'Boost is 0');
  }

  // ── Summary ────────────────────────────────────────────

  console.log(`\n${'═'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'═'.repeat(40)}\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
