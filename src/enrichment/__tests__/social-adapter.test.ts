/**
 * Tests for social-adapter.ts
 *
 * Uses Node.js built-in test runner (node:test + node:assert).
 * Run with: node --experimental-strip-types src/enrichment/__tests__/social-adapter.test.ts
 * Or:       npx tsx src/enrichment/__tests__/social-adapter.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectSocialProfiles, enrichSocials } from '../sources/social-adapter.js';

// ── Test 1: Detect LinkedIn company URL ──────────────────────────────────────

describe('detectSocialProfiles', () => {
  it('detects a LinkedIn company URL', () => {
    const urls = ['https://linkedin.com/company/example-corp'];
    const profiles = detectSocialProfiles(urls, 'test');

    assert.equal(profiles.length, 1);
    assert.equal(profiles[0].platform, 'linkedin');
    assert.equal(profiles[0].url, 'https://linkedin.com/company/example-corp');
    assert.equal(profiles[0].verified, false);
    assert.equal(profiles[0].source, 'test');
  });

  // ── Test 2: Detect Instagram profile and filter out posts (/p/) ─────────

  it('detects Instagram profile and filters out posts', () => {
    const urls = [
      'https://instagram.com/example_bali',        // ✅ profile
      'https://instagram.com/p/CXYZabc12345/',     // ❌ post — should be filtered
      'https://www.Instagram.com/example_bali/?igshid=abc123', // ✅ profile (needs normalize)
    ];
    const profiles = detectSocialProfiles(urls, 'website_html');

    // Only one unique instagram profile (posts filtered, duplicate platform collapsed)
    assert.equal(profiles.length, 1);
    assert.equal(profiles[0].platform, 'instagram');
    // Normalized: lowercase, no www, no tracking params, no trailing slash
    assert.equal(profiles[0].url, 'https://instagram.com/example_bali');
  });

  // ── Test 3: URL normalization removes tracking params and enforces HTTPS ─

  it('normalizes URLs — removes tracking params, trailing slash, enforces HTTPS', () => {
    const urls = [
      'http://www.Facebook.com/ExampleBali/?ref=bookmarks&fbclid=xyz',
    ];
    const profiles = detectSocialProfiles(urls, 'serp');

    assert.equal(profiles.length, 1);
    const url = profiles[0].url;
    assert.ok(url.startsWith('https://'), 'should enforce HTTPS');
    assert.ok(!url.includes('www.'), 'should strip www');
    assert.ok(!url.includes('ref='), 'should remove ref param');
    assert.ok(!url.includes('fbclid='), 'should remove fbclid param');
    assert.ok(!url.endsWith('/'), 'should remove trailing slash');
  });

  // ── Test 4: Mix of valid and invalid URLs ────────────────────────────────

  it('handles a mix of valid and invalid URLs', () => {
    const urls = [
      'https://linkedin.com/company/my-biz',         // ✅ linkedin
      'https://instagram.com/mybiz',                  // ✅ instagram
      'https://facebook.com/login',                   // ❌ generic login page
      'https://twitter.com/search?q=example',         // ❌ search page
      'https://example.com/about-us',                 // ❌ not a social platform
      'https://tiktok.com/@mybizaccount',             // ✅ tiktok
      'https://youtube.com/watch?v=dQw4w9WgXcQ',     // ❌ individual video
      'https://youtube.com/@mybizofficial',           // ✅ youtube channel
      '',                                              // ❌ empty string
    ];
    const profiles = detectSocialProfiles(urls, 'serp');

    const platforms = profiles.map((p) => p.platform).sort();
    assert.deepEqual(platforms, ['instagram', 'linkedin', 'tiktok', 'youtube']);
  });

  // ── Test 5: Empty input returns empty result ─────────────────────────────

  it('returns empty array for empty input', () => {
    const profiles = detectSocialProfiles([], 'test');
    assert.equal(profiles.length, 0);
  });
});

// ── Test for enrichSocials (async, no verify) ────────────────────────────────

describe('enrichSocials', () => {
  it('returns SocialAdapterResult with correct shape (verify: false)', async () => {
    const urls = [
      'https://linkedin.com/company/acme-id',
      'https://instagram.com/acme.id',
    ];
    const result = await enrichSocials(urls, 'test', { verify: false });

    assert.equal(typeof result.total_found, 'number');
    assert.equal(typeof result.duration_ms, 'number');
    assert.ok(Array.isArray(result.profiles));
    assert.ok(typeof result.socials === 'object');
    assert.equal(result.total_found, 2);
    assert.equal(result.socials.linkedin, 'https://linkedin.com/company/acme-id');
    assert.equal(result.socials.instagram, 'https://instagram.com/acme.id');
  });

  it('returns empty result for empty URL list', async () => {
    const result = await enrichSocials([], 'test');
    assert.equal(result.total_found, 0);
    assert.deepEqual(result.profiles, []);
  });
});
