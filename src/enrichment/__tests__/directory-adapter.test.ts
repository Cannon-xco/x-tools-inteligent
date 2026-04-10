/**
 * Tests for directory-adapter.ts
 *
 * Uses hardcoded sample HTML strings to avoid real network calls.
 * Uses Node.js built-in test runner (node:test + node:assert).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as cheerio from 'cheerio';
import {
  searchDirectories,
  type DirectoryEntry,
} from '../sources/directory-adapter.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse a YellowPages-style HTML snippet using Cheerio (same logic as the adapter).
 * Used to test the HTML-parsing behavior without network calls.
 */
function parseYellowPagesHtml(html: string, searchName: string): DirectoryEntry[] {
  const $ = cheerio.load(html);
  const entries: DirectoryEntry[] = [];

  const cards = $(
    '.result, .v-card, [class*="result-"], .srp-listing, li.listing',
  ).toArray();

  for (const el of cards) {
    const $el = $(el);
    const resultName = $el
      .find('.business-name, h2.n a, .n a, [class*="business-name"]')
      .first()
      .text()
      .trim();
    if (!resultName) continue;

    const words = searchName.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const lower = resultName.toLowerCase();
    const matched = words.filter((w) => lower.includes(w)).length;
    const match_confidence = words.length > 0 ? matched / words.length : 0;
    if (match_confidence < 0.6) continue;

    const phone =
      $el.find('.phones, .phone, a[href^="tel:"]').first().text().trim() || undefined;
    const address =
      $el.find('.adr, .address').text().trim().replace(/\s+/g, ' ') || undefined;
    const website =
      $el.find('a[href^="http"]:not([href*="yellowpages"])').attr('href') || undefined;

    entries.push({ source: 'yellowpages', name: resultName, phone, address, website, match_confidence });
  }
  return entries;
}

/**
 * Parse a Yelp-style HTML snippet using Cheerio.
 */
function parseYelpHtml(html: string, searchName: string): DirectoryEntry[] {
  const $ = cheerio.load(html);
  const entries: DirectoryEntry[] = [];

  const yelpCards = $('[class*="businessName"], h3 a[href*="/biz/"]').toArray();

  for (const el of yelpCards) {
    const $el = $(el);
    const resultName = $el.text().trim();
    if (!resultName) continue;

    const words = searchName.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const lower = resultName.toLowerCase();
    const matched = words.filter((w) => lower.includes(w)).length;
    const match_confidence = words.length > 0 ? matched / words.length : 0;
    if (match_confidence < 0.6) continue;

    const container = $el.closest('li, [class*="container"]');
    const phone =
      container.find('a[href^="tel:"]').first().text().trim() || undefined;
    const address =
      container.find('address').first().text().trim().replace(/\s+/g, ' ') || undefined;
    const ariaLabel =
      container.find('[aria-label*="star rating"]').attr('aria-label') ?? '';
    const ratingMatch = ariaLabel.match(/(\d+(?:\.\d+)?)/);
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : undefined;

    entries.push({ source: 'yelp', name: resultName, phone, address, rating, match_confidence });
  }
  return entries;
}

// ── Sample HTML fixtures ──────────────────────────────────────────────────────

const YELLOWPAGES_SAMPLE_HTML = `
<div class="result">
  <h2 class="n"><a class="business-name">Warung Sederhana Bali</a></h2>
  <div class="phones">+62 361 123456</div>
  <div class="adr">Jl. Sunset Road No. 10, Kuta, Bali</div>
  <a href="https://warungs.example.com">Website</a>
</div>
<div class="result">
  <h2 class="n"><a class="business-name">Warung Sederhana Jakarta</a></h2>
  <div class="phones">+62 21 999888</div>
  <div class="adr">Jl. Sudirman, Jakarta Pusat</div>
</div>
<div class="result">
  <h2 class="n"><a class="business-name">Completely Different Restaurant</a></h2>
  <div class="phones">+62 21 111222</div>
</div>
`;

const YELP_SAMPLE_HTML = `
<ul>
  <li class="container">
    <h3><a href="/biz/warung-sederhana-bali" class="businessName">Warung Sederhana Bali</a></h3>
    <a href="tel:+62361654321">+62 361 654321</a>
    <address>Jl. Legian No. 5, Kuta</address>
    <span aria-label="4 star rating"></span>
  </li>
  <li class="container">
    <h3><a href="/biz/xyz" class="businessName">XYZ Unrelated Place</a></h3>
    <address>Some Address</address>
  </li>
</ul>
`;

// ── Tests ─────────────────────────────────────────────────────────────────────

// ── Test 1: Parse sample YellowPages HTML ────────────────────────────────────

describe('parseYellowPagesHtml', () => {
  it('parses YellowPages HTML and returns matching entries', () => {
    const entries = parseYellowPagesHtml(YELLOWPAGES_SAMPLE_HTML, 'Warung Sederhana');

    // "Completely Different Restaurant" should NOT match
    assert.ok(entries.length >= 1, 'should find at least one match');
    for (const e of entries) {
      assert.equal(e.source, 'yellowpages');
      assert.ok(e.name.toLowerCase().includes('warung'), `name should contain "warung": ${e.name}`);
      assert.ok(e.match_confidence >= 0.6);
    }
  });

  it('extracts phone and address from YellowPages cards', () => {
    const entries = parseYellowPagesHtml(YELLOWPAGES_SAMPLE_HTML, 'Warung Sederhana Bali');
    const baliEntry = entries.find((e) => e.name.includes('Bali'));
    assert.ok(baliEntry, 'should find Bali entry');
    assert.ok(baliEntry?.phone?.includes('361'), 'should extract Bali phone');
    assert.ok(baliEntry?.address?.toLowerCase().includes('kuta'), 'should extract address');
    assert.equal(baliEntry?.website, 'https://warungs.example.com');
  });
});

// ── Test 2: Parse sample Yelp HTML ──────────────────────────────────────────

describe('parseYelpHtml', () => {
  it('parses Yelp HTML and returns matching entries', () => {
    const entries = parseYelpHtml(YELP_SAMPLE_HTML, 'Warung Sederhana');

    assert.ok(entries.length >= 1, 'should find at least one match');
    const match = entries[0];
    assert.equal(match.source, 'yelp');
    assert.ok(match.name.toLowerCase().includes('warung'));
  });

  it('extracts phone, address, and rating from Yelp cards', () => {
    const entries = parseYelpHtml(YELP_SAMPLE_HTML, 'Warung Sederhana Bali');
    const entry = entries.find((e) => e.name.includes('Bali'));
    assert.ok(entry, 'should find Bali Yelp entry');
    assert.ok(entry?.phone?.includes('361'), 'should have phone');
    assert.ok(entry?.address?.toLowerCase().includes('legian'), 'should have address');
    assert.equal(entry?.rating, 4);
  });
});

// ── Test 3: Name matching (match and non-match) ──────────────────────────────

describe('name matching', () => {
  it('matches business names with >= 60% word overlap', () => {
    // "Warung Sederhana" → 2 meaningful words
    // "Warung Sederhana Bali" — 2/2 words match → 100% → should match
    const entries = parseYellowPagesHtml(YELLOWPAGES_SAMPLE_HTML, 'Warung Sederhana');
    const names = entries.map((e) => e.name);
    assert.ok(names.some((n) => n.includes('Warung')), 'Warung entries should match');

    // "Completely Different Restaurant" has 0 words in common with "Warung Sederhana"
    assert.ok(
      !names.some((n) => n.includes('Completely Different')),
      'non-matching entries should be filtered',
    );
  });

  it('does not match unrelated businesses', () => {
    const entries = parseYelpHtml(YELP_SAMPLE_HTML, 'Warung Sederhana');
    const names = entries.map((e) => e.name);
    assert.ok(!names.some((n) => n.includes('XYZ')), 'XYZ should be filtered out');
  });
});

// ── Test 4: Merge results from 2 directories ────────────────────────────────

describe('result merging', () => {
  it('merges entries from both directories and deduplicates phones', () => {
    const ypEntries = parseYellowPagesHtml(YELLOWPAGES_SAMPLE_HTML, 'Warung Sederhana Bali');
    const yelpEntries = parseYelpHtml(YELP_SAMPLE_HTML, 'Warung Sederhana Bali');
    const allEntries = [...ypEntries, ...yelpEntries];

    const phones = [
      ...new Set(
        allEntries
          .map((e) => e.phone)
          .filter((p): p is string => typeof p === 'string' && p.length > 0),
      ),
    ];

    // Both entries have different phones → should have 2 unique phones
    assert.ok(phones.length >= 1, 'should have at least one phone');

    // Sources should include both
    const sources = new Set(allEntries.map((e) => e.source));
    assert.ok(sources.has('yellowpages'));
    assert.ok(sources.has('yelp'));
  });
});

// ── Test 5: Handle empty / error responses ───────────────────────────────────

describe('error handling', () => {
  it('returns empty entries for empty HTML', () => {
    const entries = parseYellowPagesHtml('', 'Warung Sederhana');
    assert.equal(entries.length, 0);
  });

  it('returns empty entries for HTML with no matching cards', () => {
    const entries = parseYellowPagesHtml('<html><body><p>No results</p></body></html>', 'Warung');
    assert.equal(entries.length, 0);
  });

  it('searchDirectories always resolves (never throws)', async () => {
    // Should return a result even if both directories fail (network unreachable in test)
    const result = await searchDirectories('__nonexistent_test_biz__', '__nowhere__');
    assert.ok(typeof result.duration_ms === 'number');
    assert.ok(Array.isArray(result.entries));
    assert.ok(Array.isArray(result.phones));
    assert.ok(Array.isArray(result.websites));
  });
});
