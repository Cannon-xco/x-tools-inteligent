// ============================================================
// DATA NORMALIZER TEST SUITE
// Tests for normalizer.ts - Data Normalization Layer
// ============================================================

import {
  normalizeEnrichmentData,
  NormalizedEnrichmentData,
  RawDataSource,
} from '../pipeline/normalizer';

describe('normalizeEnrichmentData', () => {
  describe('Email Normalization and Filtering', () => {
    it('should normalize emails to lowercase and trim whitespace', () => {
      const sources: RawDataSource[] = [
        {
          source: 'website',
          emails: ['  Info@Example.COM  ', 'CONTACT@BUSINESS.IO'],
        },
      ];

      const result: NormalizedEnrichmentData = normalizeEnrichmentData(sources);

      expect(result.emails).toHaveLength(2);
      expect(result.emails[0].value).toBe('info@example.com');
      expect(result.emails[1].value).toBe('contact@business.io');
    });

    it('should remove mailto: prefix from emails', () => {
      const sources: RawDataSource[] = [
        {
          source: 'website',
          emails: ['mailto:info@example.com', 'MAILTO:contact@site.com'],
        },
      ];

      const result: NormalizedEnrichmentData = normalizeEnrichmentData(sources);

      expect(result.emails).toHaveLength(2);
      expect(result.emails[0].value).toBe('info@example.com');
      expect(result.emails[1].value).toBe('contact@site.com');
    });

    it('should filter out invalid email formats', () => {
      const sources: RawDataSource[] = [
        {
          source: 'scrape',
          emails: [
            'valid@example.com',
            'invalid-email',
            '@nodomain.com',
            'noat_symbol.com',
            'spaces in@email.com',
          ],
        },
      ];

      const result: NormalizedEnrichmentData = normalizeEnrichmentData(sources);

      expect(result.emails).toHaveLength(1);
      expect(result.emails[0].value).toBe('valid@example.com');
    });

    it('should filter out known junk emails', () => {
      const sources: RawDataSource[] = [
        {
          source: 'website',
          emails: [
            'contact@business.com',
            'noreply@example.com',
            'no-reply@service.io',
            'info@company.co',
            'example@example.com',
            'donotreply@system.com',
          ],
        },
      ];

      const result: NormalizedEnrichmentData = normalizeEnrichmentData(sources);

      const values = result.emails.map(e => e.value);
      expect(values).toContain('contact@business.com');
      expect(values).toContain('info@company.co');
      expect(values).not.toContain('noreply@example.com');
      expect(values).not.toContain('no-reply@service.io');
      expect(values).not.toContain('example@example.com');
      expect(values).not.toContain('donotreply@system.com');
    });

    it('should deduplicate emails keeping highest confidence', () => {
      const sources: RawDataSource[] = [
        {
          source: 'website', // Higher reliability
          emails: ['contact@business.com'],
        },
        {
          source: 'scrape', // Lower reliability
          emails: ['contact@business.com'],
        },
      ];

      const result: NormalizedEnrichmentData = normalizeEnrichmentData(sources);

      expect(result.emails).toHaveLength(1);
      expect(result.emails[0].value).toBe('contact@business.com');
      expect(result.emails[0].source).toBe('website');
      expect(result.emails[0].confidence).toBeGreaterThan(0.8);
    });
  });

  describe('Phone E.164 Conversion', () => {
    it('should convert Indonesian mobile numbers to E.164', () => {
      const sources: RawDataSource[] = [
        {
          source: 'website',
          phones: ['081234567890', '082112345678'],
        },
      ];

      const result: NormalizedEnrichmentData = normalizeEnrichmentData(sources);

      expect(result.phones).toHaveLength(2);
      expect(result.phones[0].value).toBe('+6281234567890');
      expect(result.phones[1].value).toBe('+6282112345678');
    });

    it('should handle phone numbers with various formats', () => {
      const sources: RawDataSource[] = [
        {
          source: 'directory',
          phones: [
            '+62 812-3456-7890',
            '(021) 1234-5678',
            '62 811-2222-3333',
            '555.123.4567',
          ],
        },
      ];

      const result: NormalizedEnrichmentData = normalizeEnrichmentData(sources);

      expect(result.phones[0].value).toBe('+6281234567890');
      expect(result.phones[1].value).toBe('+622112345678');
      expect(result.phones[2].value).toBe('+6281122223333');
    });

    it('should remove phone extensions', () => {
      const sources: RawDataSource[] = [
        {
          source: 'website',
          phones: [
            '+1-555-123-4567 ext 123',
            '+62 21 1234 5678 x 101',
            '021-1234-5678 ext. 5',
          ],
        },
      ];

      const result: NormalizedEnrichmentData = normalizeEnrichmentData(sources);

      expect(result.phones[0].value).toBe('+15551234567');
      expect(result.phones[1].value).toBe('+622112345678');
      expect(result.phones[2].value).toBe('+622112345678');
    });

    it('should filter out invalid phone numbers', () => {
      const sources: RawDataSource[] = [
        {
          source: 'scrape',
          phones: [
            '123', // Too short
            '+12345678901234567890', // Too long
            '', // Empty
            'abc-def-ghij', // No digits
          ],
        },
      ];

      const result: NormalizedEnrichmentData = normalizeEnrichmentData(sources);

      expect(result.phones).toHaveLength(0);
    });

    it('should deduplicate phones after normalization', () => {
      const sources: RawDataSource[] = [
        {
          source: 'website',
          phones: ['081234567890', '+6281234567890', '62 812 3456 7890'],
        },
      ];

      const result: NormalizedEnrichmentData = normalizeEnrichmentData(sources);

      expect(result.phones).toHaveLength(1);
      expect(result.phones[0].value).toBe('+6281234567890');
    });
  });

  describe('Social URL Normalization', () => {
    it('should categorize social URLs by platform', () => {
      const sources: RawDataSource[] = [
        {
          source: 'serp',
          socialUrls: [
            'https://linkedin.com/company/acme-corp',
            'https://instagram.com/acme_official',
            'https://facebook.com/acmecorp',
            'https://twitter.com/acme',
            'https://tiktok.com/@acme',
            'https://youtube.com/@acme',
          ],
        },
      ];

      const result: NormalizedEnrichmentData = normalizeEnrichmentData(sources);

      expect(result.socials.linkedin).toBe('https://linkedin.com/company/acme-corp');
      expect(result.socials.instagram).toBe('https://instagram.com/acme_official');
      expect(result.socials.facebook).toBe('https://facebook.com/acmecorp');
      expect(result.socials.twitter).toBe('https://twitter.com/acme');
      expect(result.socials.tiktok).toBe('https://tiktok.com/@acme');
      expect(result.socials.youtube).toBe('https://youtube.com/@acme');
    });

    it('should convert http to https', () => {
      const sources: RawDataSource[] = [
        {
          source: 'website',
          socialUrls: [
            'http://instagram.com/business',
            'http://facebook.com/page',
          ],
        },
      ];

      const result: NormalizedEnrichmentData = normalizeEnrichmentData(sources);

      expect(result.socials.instagram).toBe('https://instagram.com/business');
      expect(result.socials.facebook).toBe('https://facebook.com/page');
    });

    it('should remove trailing slashes', () => {
      const sources: RawDataSource[] = [
        {
          source: 'website',
          socialUrls: ['https://linkedin.com/company/acme/'],
        },
      ];

      const result: NormalizedEnrichmentData = normalizeEnrichmentData(sources);

      expect(result.socials.linkedin).toBe('https://linkedin.com/company/acme');
    });

    it('should remove tracking parameters', () => {
      const sources: RawDataSource[] = [
        {
          source: 'serp',
          socialUrls: [
            'https://instagram.com/business?utm_source=google&utm_medium=cpc',
            'https://facebook.com/page?ref=homepage&fbclid=abc123',
            'https://youtube.com/@channel?igshid=xyz789',
          ],
        },
      ];

      const result: NormalizedEnrichmentData = normalizeEnrichmentData(sources);

      expect(result.socials.instagram).toBe('https://instagram.com/business');
      expect(result.socials.facebook).toBe('https://facebook.com/page');
      expect(result.socials.youtube).toBe('https://youtube.com/@channel');
    });

    it('should lowercase social URLs', () => {
      const sources: RawDataSource[] = [
        {
          source: 'website',
          socialUrls: ['https://LINKEDIN.com/COMPANY/AcmeCorp'],
        },
      ];

      const result: NormalizedEnrichmentData = normalizeEnrichmentData(sources);

      expect(result.socials.linkedin).toBe('https://linkedin.com/company/acmecorp');
    });
  });

  describe('Merging from Multiple Sources', () => {
    it('should merge data from 3 different sources', () => {
      const sources: RawDataSource[] = [
        {
          source: 'website',
          emails: ['info@company.com'],
          phones: ['+1-555-123-4567'],
          socialUrls: ['https://linkedin.com/company/company'],
          people: [{ name: 'John Doe', title: 'CEO' }],
        },
        {
          source: 'directory',
          emails: ['contact@company.com'],
          phones: ['+1-555-987-6543'],
          socialUrls: ['https://facebook.com/company'],
        },
        {
          source: 'serp',
          emails: ['support@company.com'],
          socialUrls: ['https://twitter.com/company'],
        },
      ];

      const result: NormalizedEnrichmentData = normalizeEnrichmentData(sources);

      expect(result.emails).toHaveLength(3);
      expect(result.phones).toHaveLength(2);
      expect(result.socials.linkedin).toBeDefined();
      expect(result.socials.facebook).toBeDefined();
      expect(result.socials.twitter).toBeDefined();
      expect(result.people).toHaveLength(1);
    });

    it('should track source for each data point', () => {
      const sources: RawDataSource[] = [
        { source: 'website', emails: ['web@company.com'] },
        { source: 'directory', emails: ['dir@company.com'] },
        { source: 'serp', emails: ['serp@company.com'] },
      ];

      const result: NormalizedEnrichmentData = normalizeEnrichmentData(sources);

      const webEmail = result.emails.find(e => e.value === 'web@company.com');
      const dirEmail = result.emails.find(e => e.value === 'dir@company.com');
      const serpEmail = result.emails.find(e => e.value === 'serp@company.com');

      expect(webEmail?.source).toBe('website');
      expect(dirEmail?.source).toBe('directory');
      expect(serpEmail?.source).toBe('serp');
    });
  });

  describe('Confidence-based Deduplication', () => {
    it('should keep highest confidence when duplicates found', () => {
      const sources: RawDataSource[] = [
        {
          source: 'website', // 0.9 reliability
          emails: ['contact@company.com'],
        },
        {
          source: 'scrape', // 0.4 reliability
          emails: ['contact@company.com'],
        },
      ];

      const result: NormalizedEnrichmentData = normalizeEnrichmentData(sources);

      expect(result.emails).toHaveLength(1);
      expect(result.emails[0].source).toBe('website');
      expect(result.emails[0].confidence).toBeGreaterThan(0.8);
    });

    it('should sort results by confidence descending', () => {
      const sources: RawDataSource[] = [
        { source: 'scrape', emails: ['scrape@company.com'] },
        { source: 'serp', emails: ['serp@company.com'] },
        { source: 'website', emails: ['website@company.com'] },
        { source: 'directory', emails: ['directory@company.com'] },
      ];

      const result: NormalizedEnrichmentData = normalizeEnrichmentData(sources);

      // Website should have highest confidence, scrape lowest
      expect(result.emails[0].source).toBe('website');
      expect(result.emails[0].confidence).toBeGreaterThanOrEqual(
        result.emails[result.emails.length - 1].confidence
      );
    });

    it('should calculate different confidence for different sources', () => {
      const sources: RawDataSource[] = [
        { source: 'official', emails: ['official@test.com'] },
        { source: 'website', emails: ['website@test.com'] },
        { source: 'linkedin', emails: ['linkedin@test.com'] },
        { source: 'directory', emails: ['directory@test.com'] },
        { source: 'serp', emails: ['serp@test.com'] },
        { source: 'scrape', emails: ['scrape@test.com'] },
      ];

      const result: NormalizedEnrichmentData = normalizeEnrichmentData(sources);

      const confidences: Record<string, number> = {};
      for (const email of result.emails) {
        confidences[email.source] = email.confidence;
      }

      expect(confidences['official']).toBeGreaterThan(confidences['website']);
      expect(confidences['website']).toBeGreaterThan(confidences['linkedin']);
      expect(confidences['linkedin']).toBeGreaterThan(confidences['directory']);
      expect(confidences['directory']).toBeGreaterThan(confidences['serp']);
      expect(confidences['serp']).toBeGreaterThan(confidences['scrape']);
    });

    it('should preserve original value alongside normalized value', () => {
      const sources: RawDataSource[] = [
        {
          source: 'website',
          emails: ['  INFO@COMPANY.COM  '],
          phones: ['+1 (555) 123-4567 ext 101'],
        },
      ];

      const result: NormalizedEnrichmentData = normalizeEnrichmentData(sources);

      expect(result.emails[0].value).toBe('info@company.com');
      expect(result.emails[0].original).toBe('  INFO@COMPANY.COM  ');

      expect(result.phones[0].value).toBe('+15551234567');
      expect(result.phones[0].original).toBe('+1 (555) 123-4567 ext 101');
    });
  });

  describe('People Data Processing', () => {
    it('should process people with titles', () => {
      const sources: RawDataSource[] = [
        {
          source: 'linkedin',
          people: [
            { name: 'Jane Smith', title: 'Marketing Director' },
            { name: 'Bob Johnson', title: 'CTO' },
          ],
        },
      ];

      const result: NormalizedEnrichmentData = normalizeEnrichmentData(sources);

      expect(result.people).toHaveLength(2);
      expect(result.people[0].name).toBe('Jane Smith');
      expect(result.people[0].title).toBe('Marketing Director');
      expect(result.people[0].source).toBe('linkedin');
      expect(result.people[0].confidence).toBeGreaterThan(0.7);
    });

    it('should handle missing titles', () => {
      const sources: RawDataSource[] = [
        {
          source: 'website',
          people: [{ name: 'Alice Brown', title: '' }],
        },
      ];

      const result: NormalizedEnrichmentData = normalizeEnrichmentData(sources);

      expect(result.people[0].title).toBe('Unknown');
    });

    it('should filter out empty names', () => {
      const sources: RawDataSource[] = [
        {
          source: 'scrape',
          people: [
            { name: 'Valid Person', title: 'Manager' },
            { name: '', title: 'CEO' },
            { name: '   ', title: 'Director' },
          ],
        },
      ];

      const result: NormalizedEnrichmentData = normalizeEnrichmentData(sources);

      expect(result.people).toHaveLength(1);
      expect(result.people[0].name).toBe('Valid Person');
    });
  });

  describe('Complete Integration', () => {
    it('should handle complex real-world scenario', () => {
      const sources: RawDataSource[] = [
        {
          source: 'website',
          emails: ['contact@acme.com', 'INFO@ACME.COM', 'noreply@acme.com'],
          phones: ['+1 555-ACME-123', '555-987-6543 ext 5'],
          socialUrls: [
            'https://linkedin.com/company/acme',
            'https://instagram.com/acme_official',
          ],
          people: [
            { name: 'Wile E. Coyote', title: 'Product Manager' },
          ],
        },
        {
          source: 'directory',
          emails: ['support@acme.com', 'contact@acme.com'],
          phones: ['+1 (555) 123-4567'],
          socialUrls: [
            'https://facebook.com/AcmeCorp?utm_source=directory',
          ],
        },
        {
          source: 'serp',
          socialUrls: [
            'http://twitter.com/acme',
            'https://youtube.com/@acme',
          ],
        },
      ];

      const result: NormalizedEnrichmentData = normalizeEnrichmentData(sources);

      // Emails: 2 valid unique (noreply filtered, duplicate contact deduped)
      expect(result.emails).toHaveLength(2);
      const emailValues = result.emails.map(e => e.value);
      expect(emailValues).toContain('contact@acme.com');
      expect(emailValues).toContain('support@acme.com');

      // Phones: 2 unique (extensions removed, duplicates resolved)
      expect(result.phones).toHaveLength(2);

      // Socials: all 4 platforms
      expect(result.socials.linkedin).toBeDefined();
      expect(result.socials.instagram).toBeDefined();
      expect(result.socials.facebook).toBeDefined();
      expect(result.socials.twitter).toBeDefined();
      expect(result.socials.youtube).toBeDefined();

      // People: 1
      expect(result.people).toHaveLength(1);

      // Verify tracking params removed
      expect(result.socials.facebook).not.toContain('utm_source');
    });
  });
});
