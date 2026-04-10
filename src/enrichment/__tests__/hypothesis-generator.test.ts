/**
 * @fileoverview Test suite for Hypothesis Generation Module
 *
 * @module src/enrichment/__tests__/hypothesis-generator.test
 */

import { generateHypotheses, SearchHypothesis } from '../pipeline/hypothesis-generator';

describe('generateHypotheses', () => {
  /**
   * Test Case 1: Business with short name (1-2 words)
   * Should generate standard queries without short variant
   */
  it('should generate queries for short business name (1-2 words)', () => {
    const input = {
      name: 'Warung Kopi',
      normalized_name: 'Warung Kopi',
      city: 'Denpasar',
    };

    const result = generateHypotheses(input);

    // Should not have short variant query
    const shortVariantQueries = result.filter((h: SearchHypothesis) =>
      h.rationale.includes('Short name variant')
    );
    expect(shortVariantQueries).toHaveLength(0);

    // Should have standard queries
    expect(result.some((h: SearchHypothesis) => h.query.includes('contact email'))).toBe(true);
    expect(result.some((h: SearchHypothesis) => h.target === 'social' && h.query.includes('instagram'))).toBe(true);
    expect(result.some((h: SearchHypothesis) => h.target === 'social' && h.query.includes('linkedin'))).toBe(true);

    // Should be within limit
    expect(result.length).toBeLessThanOrEqual(7);
  });

  /**
   * Test Case 2: Business with long name (> 3 words)
   * Should generate short variant query
   */
  it('should generate short variant for long business name (> 3 words)', () => {
    const input = {
      name: 'Warung Makan Sederhana Nusantara',
      normalized_name: 'Warung Makan Sederhana Nusantara',
      city: 'Denpasar',
    };

    const result = generateHypotheses(input);

    // Should have short variant query
    const shortVariantQuery = result.find((h: SearchHypothesis) =>
      h.rationale.includes('Short name variant')
    );
    expect(shortVariantQuery).toBeDefined();
    expect(shortVariantQuery?.query).toContain('"Warung Nusantara"');

    // Standard queries should still exist
    expect(result.some((h: SearchHypothesis) => h.query.includes('Warung Makan Sederhana Nusantara'))).toBe(true);
  });

  /**
   * Test Case 3: Business with domain available
   * Should include domain-specific queries
   */
  it('should include domain queries when domain is provided', () => {
    const input = {
      name: 'Warung Kopi',
      normalized_name: 'Warung Kopi',
      city: 'Denpasar',
      domain: 'https://warungkopi.com',
    };

    const result = generateHypotheses(input);

    // Should have domain contact query
    const domainContactQuery = result.find((h: SearchHypothesis) =>
      h.query === 'warungkopi.com contact'
    );
    expect(domainContactQuery).toBeDefined();
    expect(domainContactQuery?.target).toBe('website');
    expect(domainContactQuery?.priority).toBe(3);

    // Should have domain about query
    const domainAboutQuery = result.find((h: SearchHypothesis) =>
      h.query === 'warungkopi.com about'
    );
    expect(domainAboutQuery).toBeDefined();
    expect(domainAboutQuery?.target).toBe('website');
  });

  /**
   * Test Case 3b: Domain with path should be cleaned
   */
  it('should clean domain URL by removing protocol and path', () => {
    const input = {
      name: 'Test Business',
      normalized_name: 'Test Business',
      city: 'Jakarta',
      domain: 'https://example.com/path/to/page',
    };

    const result = generateHypotheses(input);

    const domainQuery = result.find((h: SearchHypothesis) =>
      h.query.includes('example.com contact')
    );
    expect(domainQuery).toBeDefined();
    expect(domainQuery?.query).toBe('example.com contact');
  });

  /**
   * Test Case 4: Business without domain and niche (minimal input)
   * Should generate basic queries only
   */
  it('should generate minimal queries when no domain or niche provided', () => {
    const input = {
      name: 'Warung Kecil',
      normalized_name: 'Warung Kecil',
      city: 'Surabaya',
    };

    const result = generateHypotheses(input);

    // Should have basic queries
    expect(result.length).toBeGreaterThanOrEqual(5);

    // Should NOT have domain queries
    const domainQueries = result.filter((h: SearchHypothesis) => h.target === 'website');
    expect(domainQueries).toHaveLength(0);

    // Should NOT have niche-specific query
    const nicheQuery = result.find((h: SearchHypothesis) =>
      h.rationale.includes('Name + niche + city')
    );
    expect(nicheQuery).toBeUndefined();

    // Should have general contact query with priority 5
    const generalQuery = result.find((h: SearchHypothesis) => h.priority === 5);
    expect(generalQuery).toBeDefined();
    expect(generalQuery?.target).toBe('general');
  });

  /**
   * Test Case 5: Verify sorting by priority (highest first)
   */
  it('should return queries sorted by priority descending (highest first)', () => {
    const input = {
      name: 'Toko Emas Makmur',
      normalized_name: 'Toko Emas Makmur',
      city: 'Bandung',
      domain: 'tokoemas.com',
      niche: 'jewelry',
    };

    const result = generateHypotheses(input);

    // Verify sorted by priority descending
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].priority).toBeGreaterThanOrEqual(result[i + 1].priority);
    }

    // Highest priority (5) should be first
    expect(result[0].priority).toBe(5);
    expect(result[0].rationale).toContain('Full name + city + contact keywords');
  });

  /**
   * Additional test: Max 7 queries limit
   */
  it('should never return more than 7 queries', () => {
    const input = {
      name: 'Very Long Business Name Enterprise Solutions',
      normalized_name: 'Very Long Business Name Enterprise Solutions',
      city: 'Jakarta',
      domain: 'https://verylongbusiness.com',
      niche: 'technology',
    };

    const result = generateHypotheses(input);

    expect(result.length).toBeLessThanOrEqual(7);
  });

  /**
   * Additional test: All queries have required fields
   */
  it('should have all required fields in each hypothesis', () => {
    const input = {
      name: 'Test Shop',
      normalized_name: 'Test Shop',
      city: 'Yogyakarta',
    };

    const result = generateHypotheses(input);

    result.forEach((hypothesis: SearchHypothesis) => {
      expect(hypothesis.query).toBeDefined();
      expect(typeof hypothesis.query).toBe('string');
      expect(hypothesis.priority).toBeDefined();
      expect(hypothesis.priority).toBeGreaterThanOrEqual(1);
      expect(hypothesis.priority).toBeLessThanOrEqual(5);
      expect(hypothesis.target).toBeDefined();
      expect(['general', 'email', 'social', 'website', 'phone']).toContain(hypothesis.target);
      expect(hypothesis.rationale).toBeDefined();
      expect(typeof hypothesis.rationale).toBe('string');
    });
  });

  /**
   * Additional test: Niche query generation
   */
  it('should generate niche-specific query when niche is provided', () => {
    const input = {
      name: 'Bakso Mantap',
      normalized_name: 'Bakso Mantap',
      city: 'Semarang',
      niche: 'restaurant',
    };

    const result = generateHypotheses(input);

    const nicheQuery = result.find((h: SearchHypothesis) =>
      h.rationale.includes('Name + niche + city')
    );
    expect(nicheQuery).toBeDefined();
    expect(nicheQuery?.query).toContain('Bakso Mantap');
    expect(nicheQuery?.query).toContain('restaurant');
    expect(nicheQuery?.query).toContain('Semarang');
    expect(nicheQuery?.priority).toBe(4);
  });

  /**
   * Additional test: Phone target query exists
   */
  it('should include phone-specific query', () => {
    const input = {
      name: 'Laundry Kilat',
      normalized_name: 'Laundry Kilat',
      city: 'Malang',
    };

    const result = generateHypotheses(input);

    const phoneQuery = result.find((h: SearchHypothesis) => h.target === 'phone');
    expect(phoneQuery).toBeDefined();
    expect(phoneQuery?.query).toContain('phone');
    expect(phoneQuery?.priority).toBe(2);
  });
});
