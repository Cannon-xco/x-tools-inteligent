// ============================================================
// Tests: Levenshtein Fuzzy Matching — cross-validator additions
// Runner: vitest
// ============================================================

import { describe, it, expect } from 'vitest';
import { stringSimilarity, validateNameMatch, calculateTotalBoost } from '../scoring/cross-validator';

describe('stringSimilarity (Levenshtein)', () => {
  it('identical strings return 1.0', () => {
    expect(stringSimilarity('Acme Corp', 'Acme Corp')).toBe(1);
  });

  it('case-insensitive: same string different case returns 1.0', () => {
    expect(stringSimilarity('ACME CORP', 'acme corp')).toBe(1);
  });

  it('completely different short strings return low score', () => {
    const score = stringSimilarity('abc', 'xyz');
    expect(score).toBeLessThan(0.5);
  });

  it('empty first string returns 0', () => {
    expect(stringSimilarity('', 'hello')).toBe(0);
  });

  it('empty second string returns 0', () => {
    expect(stringSimilarity('hello', '')).toBe(0);
  });

  it('both empty strings returns 0', () => {
    expect(stringSimilarity('', '')).toBe(0);
  });

  it('one character different in long string returns high score', () => {
    const score = stringSimilarity('Warung Makan Sari', 'Warung Makan Sori');
    expect(score).toBeGreaterThan(0.9);
  });

  it('minor spelling variant returns >= 0.75', () => {
    const score = stringSimilarity('PT Maju Bersama', 'PT Maju Bersamma');
    expect(score).toBeGreaterThanOrEqual(0.75);
  });

  it('completely different strings returns < 0.5', () => {
    const score = stringSimilarity('Restoran Padang', 'Bengkel Motor Jaya');
    expect(score).toBeLessThan(0.5);
  });

  it('score is always between 0 and 1', () => {
    const pairs = [
      ['abc', 'abcd'],
      ['', 'test'],
      ['Hello World', 'Hello World'],
      ['a', 'zzzzzzzzz'],
    ];
    for (const [a, b] of pairs) {
      const score = stringSimilarity(a, b);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

describe('validateNameMatch', () => {
  it('very similar names return BOOST_NAME_CITY_MATCH (0.1)', () => {
    const boost = validateNameMatch('Acme Corporation', 'Acme Coorporation');
    expect(boost).toBe(0.1);
  });

  it('identical names return boost', () => {
    expect(validateNameMatch('Toko Baju Murah', 'Toko Baju Murah')).toBe(0.1);
  });

  it('completely different names return 0', () => {
    expect(validateNameMatch('Restoran Padang', 'Bengkel Mobil Jaya')).toBe(0);
  });

  it('empty nameA returns 0', () => {
    expect(validateNameMatch('', 'Acme Corp')).toBe(0);
  });

  it('empty nameB returns 0', () => {
    expect(validateNameMatch('Acme Corp', '')).toBe(0);
  });

  it('threshold boundary — just above 0.75 returns boost', () => {
    // "abcdefgh" vs "abcdefgx" = 1 char diff out of 8 = 0.875
    const boost = validateNameMatch('abcdefgh', 'abcdefgx');
    expect(boost).toBe(0.1);
  });

  it('threshold boundary — significantly below 0.75 returns 0', () => {
    // very different short strings
    const boost = validateNameMatch('abc', 'xyz');
    expect(boost).toBe(0);
  });
});

describe('calculateTotalBoost with businessName context', () => {
  it('person field with matching businessName gets name boost', () => {
    const boost = calculateTotalBoost(
      'person',
      'PT Maju Bersama',
      ['dee_website_adapter', 'directory'],
      { businessName: 'PT Maju Bersamma' }  // typo variant
    );
    // multi-source boost (0.2) + name match boost (0.1) = 0.3
    expect(boost).toBeGreaterThanOrEqual(0.3);
  });

  it('person field with no businessName context — no name boost', () => {
    const boost = calculateTotalBoost(
      'person',
      'Someone Name',
      ['dee_website_adapter'],
      {}
    );
    // Only 1 source — no multi-source boost, no name boost
    expect(boost).toBe(0);
  });

  it('email field ignores businessName (not applicable)', () => {
    const boost = calculateTotalBoost(
      'email',
      'info@mybiz.com',
      ['dee_website_adapter', 'directory'],
      { businessName: 'My Biz', businessWebsite: 'https://mybiz.com' }
    );
    // multi-source (0.2) + domain match (0.15) = 0.35
    expect(boost).toBeGreaterThanOrEqual(0.35);
  });
});
