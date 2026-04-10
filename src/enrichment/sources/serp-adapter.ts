// ============================================================
// DEEP ENRICHMENT ENGINE — SERP Adapter
//
// Scrapes Yahoo Search and DuckDuckGo Lite for business info.
// Extracts official websites, social profiles, directory listings.
//
// ⛔ This is a NEW file. Does NOT modify existing enrichment code.
// ============================================================

import * as cheerio from 'cheerio';
import type { SerpResult, SerpSnippet } from '../types';

const SOURCE = 'dee_serp_adapter';
const REQUEST_TIMEOUT = 15_000;

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

// ── Directory domain filter ──────────────────────────────────

const DIRECTORY_DOMAINS = [
  'tripadvisor.com', 'yelp.com', 'agoda.com', 'booking.com', 'traveloka.com',
  'yellowpages.com', 'foursquare.com', 'zomato.com', 'opentable.com',
  'grab.com', 'gofood.co.id', 'shopeefood', 'tokopedia.com', 'shopee.co.id',
  'mapquest.com', 'waze.com', 'business.site', 'bbb.org', 'manta.com',
  'angi.com', 'thumbtack.com', 'homeadvisor.com', 'trustpilot.com',
];

const SOCIAL_DOMAINS = [
  'linkedin.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
  'tiktok.com', 'youtube.com', 'pinterest.com', 'linktr.ee', 't.me',
];

const SEARCH_ENGINE_DOMAINS = [
  'google.com', 'yahoo.com', 'bing.com', 'duckduckgo.com', 'baidu.com',
];

// ── URL Classification ───────────────────────────────────────

type UrlCategory = 'official' | 'social' | 'directory' | 'search_engine' | 'other';

/**
 * Classify a URL into category based on domain patterns.
 */
function categorizeUrl(url: string): UrlCategory {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return 'other';
  }

  if (SEARCH_ENGINE_DOMAINS.some((d) => host.includes(d))) return 'search_engine';
  if (SOCIAL_DOMAINS.some((d) => host.includes(d))) return 'social';
  if (DIRECTORY_DOMAINS.some((d) => host.includes(d))) return 'directory';
  return 'official';
}

/**
 * Check if a social URL is a profile (not a post/story).
 */
function isSocialProfile(url: string): boolean {
  const lower = url.toLowerCase();
  const postPatterns = ['/p/', '/status/', '/reel/', '/shorts/', '/watch?v=', '/stories/', '/events/'];
  return !postPatterns.some((p) => lower.includes(p));
}

// ── Fetch with timeout ───────────────────────────────────────

/**
 * Fetch a URL with AbortController timeout.
 */
async function fetchWithTimeout(url: string, timeoutMs: number = REQUEST_TIMEOUT): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ── Yahoo Search ─────────────────────────────────────────────

interface RawSearchResult {
  url: string;
  title: string;
  snippet: string;
}

/**
 * Search Yahoo and extract result URLs from redirect structure.
 */
async function searchYahoo(query: string): Promise<{
  results: RawSearchResult[];
  source: 'yahoo';
}> {
  const encodedQuery = encodeURIComponent(query);
  const searchUrl = `https://search.yahoo.com/search?p=${encodedQuery}`;

  const html = await fetchWithTimeout(searchUrl);
  const $ = cheerio.load(html);
  const results: RawSearchResult[] = [];
  const seenUrls = new Set<string>();

  $('a').each((_: number, el: cheerio.Element) => {
    let rawUrl = $(el).attr('href');
    if (!rawUrl) return;

    // Extract from Yahoo redirect structure /RU=.../
    const ruMatch = rawUrl.match(/\/RU=([^/]+)/);
    if (ruMatch) {
      try {
        rawUrl = decodeURIComponent(ruMatch[1]);
      } catch {
        return;
      }
    }

    if (!rawUrl.startsWith('http')) return;
    if (rawUrl.includes('yahoo.com')) return;

    // Deduplicate by hostname + pathname
    try {
      const parsed = new URL(rawUrl);
      const key = `${parsed.hostname}${parsed.pathname}`;
      if (seenUrls.has(key)) return;
      seenUrls.add(key);
    } catch {
      return;
    }

    const title = $(el).text().trim().slice(0, 200);
    const snippet = $(el).closest('div').text().trim().slice(0, 300);

    results.push({ url: rawUrl, title, snippet });
  });

  return { results, source: 'yahoo' };
}

// ── DuckDuckGo Lite Search ───────────────────────────────────

/**
 * Search DuckDuckGo Lite (HTML-only version) and extract results.
 */
async function searchDuckDuckGo(query: string): Promise<{
  results: RawSearchResult[];
  source: 'duckduckgo';
}> {
  const encodedQuery = encodeURIComponent(query);
  const searchUrl = `https://lite.duckduckgo.com/lite/?q=${encodedQuery}`;

  const html = await fetchWithTimeout(searchUrl);
  const $ = cheerio.load(html);
  const results: RawSearchResult[] = [];
  const seenUrls = new Set<string>();

  // DDG Lite uses table rows for results
  $('a.result-link, a[rel="nofollow"]').each((_: number, el: cheerio.Element) => {
    const rawUrl = $(el).attr('href');
    if (!rawUrl || !rawUrl.startsWith('http')) return;
    if (rawUrl.includes('duckduckgo.com')) return;

    try {
      const parsed = new URL(rawUrl);
      const key = `${parsed.hostname}${parsed.pathname}`;
      if (seenUrls.has(key)) return;
      seenUrls.add(key);
    } catch {
      return;
    }

    const title = $(el).text().trim().slice(0, 200);
    // Find snippet in the next table cell or sibling
    const snippet = $(el).closest('tr').next('tr').find('td.result-snippet').text().trim().slice(0, 300)
      || $(el).parent().next().text().trim().slice(0, 300);

    results.push({ url: rawUrl, title, snippet });
  });

  return { results, source: 'duckduckgo' };
}

// ── Result Merging ───────────────────────────────────────────

/**
 * Merge and deduplicate results from multiple search engines.
 * Prioritizes: official website > social profiles > directory listings.
 */
function mergeResults(
  ...searchResults: Array<{ results: RawSearchResult[]; source: 'yahoo' | 'duckduckgo' }>
): SerpResult {
  let officialWebsite: string | undefined;
  const socialProfiles = new Set<string>();
  const directoryListings = new Set<string>();
  const snippets: SerpSnippet[] = [];
  const seenHosts = new Set<string>();

  for (const { results, source } of searchResults) {
    for (const r of results) {
      // Deduplicate by hostname
      let host: string;
      try {
        host = new URL(r.url).hostname.toLowerCase();
      } catch {
        continue;
      }

      const category = categorizeUrl(r.url);

      if (category === 'search_engine') continue;

      if (category === 'official' && !officialWebsite && !seenHosts.has(host)) {
        officialWebsite = r.url;
      }

      if (category === 'social' && isSocialProfile(r.url) && !seenHosts.has(host)) {
        socialProfiles.add(r.url);
      }

      if (category === 'directory' && !seenHosts.has(host)) {
        directoryListings.add(r.url);
      }

      seenHosts.add(host);

      if (r.snippet && snippets.length < 10) {
        snippets.push({ text: r.snippet, url: r.url, source });
      }
    }
  }

  return {
    officialWebsite,
    socialProfiles: Array.from(socialProfiles),
    directoryListings: Array.from(directoryListings),
    snippets,
    duration_ms: 0,
  };
}

// ── Main Export ──────────────────────────────────────────────

/**
 * Search for business information across multiple search engines.
 * Yahoo is tried first; DuckDuckGo is used as fallback or additional source.
 * Never throws — returns empty result on total failure.
 *
 * @param businessName - Name of the business
 * @param location - Business location / city
 * @param queries - Optional custom queries (overrides auto-generated)
 * @returns SerpResult with categorized URLs and snippets
 */
export async function searchBusiness(
  businessName: string,
  location: string,
  queries?: string[]
): Promise<SerpResult> {
  const start = Date.now();

  // Build default query if none provided
  const searchQueries = queries && queries.length > 0
    ? queries
    : [`"${businessName}" ${location} contact`];

  const allYahooResults: RawSearchResult[] = [];
  const allDdgResults: RawSearchResult[] = [];

  for (const query of searchQueries.slice(0, 3)) {
    // Try Yahoo first
    try {
      const yahoo = await searchYahoo(query);
      allYahooResults.push(...yahoo.results);
    } catch {
      // Yahoo failed — try DDG for this query
      try {
        const ddg = await searchDuckDuckGo(query);
        allDdgResults.push(...ddg.results);
      } catch {
        // Both failed for this query — continue to next
      }
    }
  }

  // If Yahoo got results but DDG didn't run yet, optionally try DDG for coverage
  if (allYahooResults.length > 0 && allDdgResults.length === 0 && searchQueries.length > 0) {
    try {
      const ddg = await searchDuckDuckGo(searchQueries[0]);
      allDdgResults.push(...ddg.results);
    } catch {
      // DDG supplementary search failed — that's ok
    }
  }

  const merged = mergeResults(
    { results: allYahooResults, source: 'yahoo' },
    { results: allDdgResults, source: 'duckduckgo' }
  );

  merged.duration_ms = Date.now() - start;
  return merged;
}
