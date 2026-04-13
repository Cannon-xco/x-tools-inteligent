// ============================================================
// Tests: Confidence Scoring Engine + Cross-Validator
// Runner: vitest
// ============================================================

import { describe, it, expect } from 'vitest';
import { calculateConfidence, scoreAllFields, calculateOverallConfidence } from '../scoring/confidence-engine';
import { validateAcrossSources, validateEmailDomain, calculateTotalBoost } from '../scoring/cross-validator';

const now = new Date();

describe('Confidence Engine', () => {
  it('Test 1: High confidence from official website source', () => {
    const result = calculateConfidence(
      'email',
      'info@example.com',
      [{ name: 'dee_website_adapter:mailto', reliability: 0.95, timestamp: now }],
      0.2
    );
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result.status).toBe('VERIFIED');
    expect(result.field).toBe('email');
    expect(result.sources).toHaveLength(1);
  });

  it('Test 2: Low confidence from raw scrape → DISCARDED', () => {
    const oldDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const result = calculateConfidence(
      'phone',
      '12345',
      [{ name: 'raw_scrape', reliability: 0.4, timestamp: oldDate }],
      0
    );
    expect(result.confidence).toBeLessThan(0.5);
    expect(result.status).toBe('DISCARDED');
  });

  it('Test 3: Multi-source boost', () => {
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
    expect(result.confidence).toBeGreaterThanOrEqual(0.65);
    expect(result.sources).toHaveLength(3);
    expect(['VERIFIED', 'LOW_CONFIDENCE']).toContain(result.status);
  });

  it('Test 4: Empty sources → DISCARDED with confidence 0', () => {
    const result = calculateConfidence('email', 'test@test.com', [], 0);
    expect(result.confidence).toBe(0);
    expect(result.status).toBe('DISCARDED');
  });

  it('Test 5: scoreAllFields batch returns correct fields', () => {
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
    expect(results).toHaveLength(2);
    expect(results[0].field).toBe('email');
    expect(results[1].field).toBe('phone');
  });

  it('Test 6: calculateOverallConfidence returns value in [0, 1]', () => {
    const results = [
      { value: 'a@b.com', field: 'email' as const, confidence: 0.9, status: 'VERIFIED' as const, sources: [] },
      { value: '+123', field: 'phone' as const, confidence: 0.6, status: 'LOW_CONFIDENCE' as const, sources: [] },
    ];
    const overall = calculateOverallConfidence(results);
    expect(overall).toBeGreaterThan(0);
    expect(overall).toBeLessThanOrEqual(1);
  });
});

describe('Cross-Validator', () => {
  it('Test 7: Cross-validation with matching sources', () => {
    const result = validateAcrossSources('email', [
      { value: 'info@biz.com', source: 'website' },
      { value: 'info@biz.com', source: 'directory' },
      { value: 'other@biz.com', source: 'serp' },
    ]);
    expect(result.matchCount).toBe(2);
    expect(result.boostScore).toBeGreaterThanOrEqual(0.2);
    expect(result.matchingSources).toContain('website');
    expect(result.matchingSources).toContain('directory');
  });

  it('Test 8: Email domain validation boost', () => {
    const boost = validateEmailDomain('info@mybusiness.com', 'https://www.mybusiness.com');
    expect(boost).toBeGreaterThan(0);

    const noBoost = validateEmailDomain('info@gmail.com', 'https://mybusiness.com');
    expect(noBoost).toBe(0);
  });

  it('Test 9: Total boost calculation with 3 sources', () => {
    const boost = calculateTotalBoost(
      'email',
      'info@mybiz.com',
      ['dee_website_adapter', 'directory', 'serp'],
      { businessWebsite: 'https://mybiz.com' }
    );
    expect(boost).toBeGreaterThanOrEqual(0.2);
    expect(boost).toBeLessThanOrEqual(1.0);
  });

  it('Test 10: Empty cross-validation returns zero boost', () => {
    const result = validateAcrossSources('phone', []);
    expect(result.matchCount).toBe(0);
    expect(result.boostScore).toBe(0);
  });
});
