/**
 * Directory Adapter — Deep Enrichment Engine (DEE)
 *
 * Scrapes YellowPages and Yelp to extract contact info (phone, address, website)
 * for a target business. Uses Cheerio for HTML parsing.
 *
 * @module enrichment/sources/directory-adapter
 */

import * as cheerio from 'cheerio';

// ── Types ────────────────────────────────────────────────────────────────────

/** A single result entry from a business directory. */
export interface DirectoryEntry {
  /** Which directory this came from. */
  source: 'yellowpages' | 'yelp';
  /** Business name as found in the directory. */
  name: string;
  /** Phone number (raw string). */
  phone?: string;
  /** Address as found in the listing. */
  address?: string;
  /** Business website URL (if listed). */
  website?: string;
  /** Yelp star rating (if available). */
  rating?: number;
  /** How confident we are that this entry matches the searched business (0.0–1.0). */
  match_confidence: number;
}

/** Aggregated result from all directories searched. */
export interface DirectoryAdapterResult {
  /** All matched entries across directories. */
  entries: DirectoryEntry[];
  /** Deduplicated phone numbers from all entries. */
  phones: string[];
  /** Deduplicated website URLs from all entries. */
  websites: string[];
  /** Wall-clock time for the entire operation in ms. */
  duration_ms: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DIRECTORY_TIMEOUT = 15_000;

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Check whether a directory result name matches the searched business name.
 * At least 60% of non-trivial words must be present in the result name.
 *
 * @param searchName - The name we searched for.
 * @param resultName - The name returned by the directory.
 */
function isMatch(searchName: string, resultName: string): boolean {
  const searchWords = searchName
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (searchWords.length === 0) return true; // nothing meaningful to compare
  const resultLower = resultName.toLowerCase();
  const matchCount = searchWords.filter((w) => resultLower.includes(w)).length;
  return matchCount / searchWords.length >= 0.6;
}

/**
 * Calculate a numeric match_confidence (0.0–1.0) between two business names.
 *
 * @param searchName - Name that was searched.
 * @param resultName - Name found in the directory.
 */
function matchConfidence(searchName: string, resultName: string): number {
  const words = searchName
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (words.length === 0) return 0.5;
  const lower = resultName.toLowerCase();
  const matched = words.filter((w) => lower.includes(w)).length;
  return matched / words.length;
}

/**
 * Fetch HTML from a URL with a timeout and browser-like headers.
 * Returns `null` on any error (timeout, HTTP error, network failure).
 *
 * @param url     - Target URL.
 * @param timeout - Abort timeout in ms (default: DIRECTORY_TIMEOUT).
 */
async function fetchHtml(url: string, timeout: number = DIRECTORY_TIMEOUT): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── YellowPages ───────────────────────────────────────────────────────────────

/**
 * Search bisnis di YellowPages.
 *
 * Builds a YellowPages search URL, fetches the HTML, and parses result cards
 * using Cheerio to extract name, phone, address, and website.
 * Only entries whose names match the searched business are included.
 *
 * @param name - Business name to search for.
 * @param city - City / location to narrow the search.
 * @returns Array of `DirectoryEntry` with `source: 'yellowpages'`.
 */
export async function searchYellowPages(
  name: string,
  city: string,
): Promise<DirectoryEntry[]> {
  const searchUrl =
    `https://www.yellowpages.com/search?search_terms=${encodeURIComponent(name)}` +
    `&geo_location_terms=${encodeURIComponent(city)}`;

  const html = await fetchHtml(searchUrl);
  if (!html) return [];

  const $ = cheerio.load(html);
  const entries: DirectoryEntry[] = [];

  // YellowPages uses .result cards; try multiple selector variants for resilience.
  const cards = $(
    '.result, .v-card, [class*="result-"], .srp-listing, li.listing',
  ).toArray();

  for (const el of cards) {
    const $el = $(el);
    const resultName = $el
      .find(
        '.business-name, h2.n a, .n a, [class*="business-name"], a.business-name',
      )
      .first()
      .text()
      .trim();

    if (!resultName || !isMatch(name, resultName)) continue;

    const rawPhone =
      $el
        .find('.phones, .phone, [class*="phone"], a[href^="tel:"]')
        .first()
        .text()
        .trim()
        .replace(/\s+/g, ' ') || undefined;

    const rawAddress =
      $el
        .find('.adr, .address, [class*="address"], .street-address')
        .text()
        .trim()
        .replace(/\s+/g, ' ') || undefined;

    // External website link (exclude yellowpages.com itself)
    const websiteHref =
      $el
        .find('a[href^="http"]:not([href*="yellowpages.com"])')
        .attr('href') || undefined;

    entries.push({
      source: 'yellowpages',
      name: resultName,
      phone: rawPhone,
      address: rawAddress,
      website: websiteHref,
      match_confidence: matchConfidence(name, resultName),
    });
  }

  return entries;
}

// ── Yelp ──────────────────────────────────────────────────────────────────────

/**
 * Search bisnis di Yelp.
 *
 * Builds a Yelp search URL, fetches the HTML, and parses result cards
 * using Cheerio to extract name, phone, rating, and address.
 * Only entries whose names match the searched business are included.
 *
 * @param name - Business name to search for.
 * @param city - City / location to narrow the search.
 * @returns Array of `DirectoryEntry` with `source: 'yelp'`.
 */
export async function searchYelp(
  name: string,
  city: string,
): Promise<DirectoryEntry[]> {
  const searchUrl =
    `https://www.yelp.com/search?find_desc=${encodeURIComponent(name)}` +
    `&find_loc=${encodeURIComponent(city)}`;

  const html = await fetchHtml(searchUrl);
  if (!html) return [];

  const $ = cheerio.load(html);
  const entries: DirectoryEntry[] = [];

  // Yelp uses various class patterns; try multiple selectors.
  const yelpCards = $(
    '[class*="businessName"], h3 a[href*="/biz/"], .biz-name a, [data-testid="serp-ia-card"] h3',
  ).toArray();

  for (const el of yelpCards) {
    const $el = $(el);
    const resultName = $el.text().trim();
    if (!resultName || !isMatch(name, resultName)) continue;

    // Walk up to the closest card container
    const container = $el.closest(
      'li, [data-testid="serp-ia-card"], [class*="container"], [class*="result"]',
    );

    const rawPhone =
      container
        .find('[class*="phone"], a[href^="tel:"]')
        .first()
        .text()
        .trim() || undefined;

    const rawAddress =
      container
        .find('address, [class*="secondaryAttributes"], [class*="address"]')
        .first()
        .text()
        .trim()
        .replace(/\s+/g, ' ') || undefined;

    // Rating: Yelp embeds it in aria-label like "4 star rating"
    const ariaLabel =
      container
        .find('[aria-label*="star rating"], [class*="rating"]')
        .attr('aria-label') ?? '';
    const ratingMatch = ariaLabel.match(/(\d+(?:\.\d+)?)/);
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : undefined;

    entries.push({
      source: 'yelp',
      name: resultName,
      phone: rawPhone,
      address: rawAddress,
      rating,
      match_confidence: matchConfidence(name, resultName),
    });
  }

  return entries;
}

// ── Aggregator ────────────────────────────────────────────────────────────────

/**
 * Search di semua directories secara parallel.
 *
 * Runs YellowPages and Yelp searches concurrently and merges the results.
 * If one directory fails (timeout, HTTP error) the other's results are still returned.
 *
 * @param name - Business name to search for.
 * @param city - City / location for the search.
 * @returns Merged `DirectoryAdapterResult` with deduplicated phones and websites.
 */
export async function searchDirectories(
  name: string,
  city: string,
): Promise<DirectoryAdapterResult> {
  const start = Date.now();

  const [ypEntries, yelpEntries] = await Promise.all([
    searchYellowPages(name, city),
    searchYelp(name, city),
  ]);

  const entries: DirectoryEntry[] = [...ypEntries, ...yelpEntries];

  // Aggregate and deduplicate phones
  const phones = [
    ...new Set(
      entries
        .map((e) => e.phone)
        .filter((p): p is string => typeof p === 'string' && p.length > 0),
    ),
  ];

  // Aggregate and deduplicate websites
  const websites = [
    ...new Set(
      entries
        .map((e) => e.website)
        .filter((w): w is string => typeof w === 'string' && w.length > 0),
    ),
  ];

  return {
    entries,
    phones,
    websites,
    duration_ms: Date.now() - start,
  };
}
