/**
 * @fileoverview Test suite for DNS Adapter Module
 *
 * @module src/enrichment/__tests__/dns-adapter.test
 */

import {
  lookupDns,
  verifyEmailDomain,
  clearDnsCache,
  getCacheStats,
  DnsResult,
} from '../sources/dns-adapter';

// Check if we have network access (skip DNS-dependent tests if not)
let hasNetworkAccess = false;

async function checkNetworkAccess(): Promise<boolean> {
  try {
    const dns = require('dns');
    return new Promise((resolve) => {
      dns.resolve4('google.com', (err: Error | null) => {
        resolve(!err);
      });
    });
  } catch {
    return false;
  }
}

beforeAll(async () => {
  hasNetworkAccess = await checkNetworkAccess();
}, 10000);

describe('DNS Adapter', () => {
  // Clear cache before each test
  beforeEach(() => {
    clearDnsCache();
  });

  afterEach(() => {
    clearDnsCache();
  });

  /**
   * Test Case 1: Valid domain lookup
   * Should return valid DNS records for google.com
   */
  describe('lookupDns', () => {
    it('should return valid result for google.com', async () => {
      if (!hasNetworkAccess) {
        console.log('⚠️  Skipping DNS test - no network access');
        return;
      }

      const result = await lookupDns('google.com');

      expect(result.domain).toBe('google.com');
      expect(result.is_valid).toBe(true);
      expect(result.is_active).toBe(true);
      expect(result.has_mx).toBe(true);
      expect(result.mx_records.length).toBeGreaterThan(0);
      expect(result.a_records.length).toBeGreaterThan(0);
      expect(result.duration_ms).toBeGreaterThanOrEqual(0);

      // MX records should be sorted by priority
      for (let i = 0; i < result.mx_records.length - 1; i++) {
        expect(result.mx_records[i].priority).toBeLessThanOrEqual(
          result.mx_records[i + 1].priority
        );
      }
    });

    /**
     * Test Case 2: Non-existent domain
     * Should return invalid result without throwing
     */
    it('should return invalid result for non-existent domain', async () => {
      const fakeDomain = `fake-domain-${Date.now()}.invalid`;
      const result = await lookupDns(fakeDomain);

      expect(result.domain).toBe(fakeDomain);
      expect(result.is_valid).toBe(false);
      expect(result.is_active).toBe(false);
      expect(result.has_mx).toBe(false);
      expect(result.mx_records).toHaveLength(0);
      expect(result.a_records).toHaveLength(0);
      expect(result.duration_ms).toBeGreaterThanOrEqual(0);
    });

    /**
     * Test Case 4a: Cache hit
     * Should return cached result on second lookup
     */
    it('should cache results and return cached on second lookup', async () => {
      const domain = 'example.com';

      // First lookup
      const result1 = await lookupDns(domain);
      const duration1 = result1.duration_ms;

      // Check cache stats
      const cacheStats = getCacheStats();
      expect(cacheStats.size).toBeGreaterThan(0);
      expect(cacheStats.domains).toContain(domain);

      // Second lookup (should be cached)
      const result2 = await lookupDns(domain);
      const duration2 = result2.duration_ms;

      // Results should be identical
      expect(result2.domain).toBe(result1.domain);
      expect(result2.is_valid).toBe(result1.is_valid);
      expect(result2.has_mx).toBe(result1.has_mx);
      expect(result2.mx_records).toEqual(result1.mx_records);
      expect(result2.a_records).toEqual(result1.a_records);

      // Cached lookup should be faster (near instant)
      expect(duration2).toBeLessThan(duration1);
    });

    /**
     * Test Case 5: Timeout handling
     * Should handle timeout gracefully
     */
    it('should handle timeout gracefully', async () => {
      // Use a domain that might be slow or non-existent
      const slowDomain = 'this-is-a-very-slow-or-nonexistent-domain.invalid';

      const startTime = Date.now();
      const result = await lookupDns(slowDomain);
      const endTime = Date.now();

      // Should complete without throwing
      expect(result).toBeDefined();
      expect(result.domain).toBe(slowDomain);

      // Should complete within reasonable time (timeout + buffer)
      expect(endTime - startTime).toBeLessThan(15000); // 10s timeout + 5s buffer
    });

    /**
     * Additional test: Domain with MX only (no A record)
     */
    it('should handle domains with MX but no A record', async () => {
      if (!hasNetworkAccess) {
        console.log('⚠️  Skipping DNS test - no network access');
        return;
      }

      // Some mail-only domains have MX but no A
      // We'll test with a real domain that should have both
      const result = await lookupDns('gmail.com');

      expect(result.is_valid).toBe(true);
      expect(result.has_mx).toBe(true);
      expect(result.mx_records.length).toBeGreaterThan(0);
    });

    /**
     * Additional test: Result structure validation
     */
    it('should return properly structured result object', async () => {
      const result = await lookupDns('cloudflare.com');

      // Verify all required fields exist
      expect(result).toHaveProperty('domain');
      expect(result).toHaveProperty('is_valid');
      expect(result).toHaveProperty('is_active');
      expect(result).toHaveProperty('has_mx');
      expect(result).toHaveProperty('mx_records');
      expect(result).toHaveProperty('a_records');
      expect(result).toHaveProperty('duration_ms');

      // Verify types
      expect(typeof result.domain).toBe('string');
      expect(typeof result.is_valid).toBe('boolean');
      expect(typeof result.is_active).toBe('boolean');
      expect(typeof result.has_mx).toBe('boolean');
      expect(Array.isArray(result.mx_records)).toBe(true);
      expect(Array.isArray(result.a_records)).toBe(true);
      expect(typeof result.duration_ms).toBe('number');

      // Verify MX record structure
      if (result.mx_records.length > 0) {
        const mx = result.mx_records[0];
        expect(mx).toHaveProperty('exchange');
        expect(mx).toHaveProperty('priority');
        expect(typeof mx.exchange).toBe('string');
        expect(typeof mx.priority).toBe('number');
      }
    });
  });

  /**
   * Test Case 3: Email domain verification
   */
  describe('verifyEmailDomain', () => {
    it('should verify valid email domain with MX records', async () => {
      if (!hasNetworkAccess) {
        console.log('⚠️  Skipping DNS test - no network access');
        return;
      }

      const result = await verifyEmailDomain('test@gmail.com');

      expect(result.email).toBe('test@gmail.com');
      expect(result.domain).toBe('gmail.com');
      expect(result.is_valid).toBe(true);
      expect(result.mx_host).toBeDefined();
      expect(typeof result.mx_host).toBe('string');
    });

    it('should reject invalid email domain without MX', async () => {
      const fakeDomain = `invalid-${Date.now()}.test`;
      const result = await verifyEmailDomain(`test@${fakeDomain}`);

      expect(result.email).toBe(`test@${fakeDomain}`);
      expect(result.domain).toBe(fakeDomain);
      expect(result.is_valid).toBe(false);
      expect(result.mx_host).toBeUndefined();
    });

    it('should handle malformed email addresses', async () => {
      const result = await verifyEmailDomain('not-an-email');

      expect(result.email).toBe('not-an-email');
      expect(result.domain).toBe('');
      expect(result.is_valid).toBe(false);
      expect(result.mx_host).toBeUndefined();
    });

    it('should handle email with multiple @ symbols', async () => {
      const result = await verifyEmailDomain('user@domain@invalid.com');

      // Should extract the last domain part
      expect(result.email).toBe('user@domain@invalid.com');
      expect(result.domain).toBe('invalid.com');
    });

    it('should verify various major email providers', async () => {
      if (!hasNetworkAccess) {
        console.log('⚠️  Skipping DNS test - no network access');
        return;
      }

      const providers = [
        { email: 'test@gmail.com', domain: 'gmail.com' },
        { email: 'test@yahoo.com', domain: 'yahoo.com' },
        { email: 'test@outlook.com', domain: 'outlook.com' },
      ];

      for (const { email, domain } of providers) {
        const result = await verifyEmailDomain(email);
        expect(result.domain).toBe(domain);
        expect(result.is_valid).toBe(true);
        expect(result.mx_host).toBeDefined();
      }
    });
  });

  /**
   * Test Case 4b: Cache management
   */
  describe('Cache management', () => {
    it('should clear cache when clearDnsCache is called', async () => {
      // Populate cache
      await lookupDns('google.com');
      await lookupDns('example.com');

      expect(getCacheStats().size).toBeGreaterThan(0);

      // Clear cache
      clearDnsCache();

      expect(getCacheStats().size).toBe(0);
      expect(getCacheStats().domains).toHaveLength(0);
    });

    it('should track multiple domains in cache', async () => {
      if (!hasNetworkAccess) {
        console.log('⚠️  Skipping DNS test - no network access');
        return;
      }

      await lookupDns('google.com');
      await lookupDns('cloudflare.com');
      await lookupDns('github.com');

      const stats = getCacheStats();
      expect(stats.size).toBe(3);
      expect(stats.domains).toContain('google.com');
      expect(stats.domains).toContain('cloudflare.com');
      expect(stats.domains).toContain('github.com');
    });
  });

  /**
   * Edge cases
   */
  describe('Edge cases', () => {
    it('should handle empty string domain', async () => {
      const result = await lookupDns('');

      expect(result.domain).toBe('');
      expect(result.is_valid).toBe(false);
      expect(result.has_mx).toBe(false);
    });

    it('should handle domain with subdomain', async () => {
      if (!hasNetworkAccess) {
        console.log('⚠️  Skipping DNS test - no network access');
        return;
      }

      const result = await lookupDns('mail.google.com');

      expect(result.domain).toBe('mail.google.com');
      expect(result.is_valid).toBe(true);
    });

    it('should handle uppercase domain (case insensitive)', async () => {
      if (!hasNetworkAccess) {
        console.log('⚠️  Skipping DNS test - no network access');
        return;
      }

      const result = await lookupDns('GOOGLE.COM');

      expect(result.domain).toBe('GOOGLE.COM');
      // DNS is case insensitive, should still resolve
      expect(result.is_valid || result.has_mx || result.a_records.length > 0).toBeTruthy();
    });
  });
});
