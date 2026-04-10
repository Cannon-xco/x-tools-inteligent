// ============================================================
// DEEP ENRICHMENT ENGINE — Enhanced Website Adapter
//
// Advanced extraction of emails, phones, social profiles, and
// decision-makers from raw HTML. Multi-strategy approach with
// confidence scoring per extracted field.
//
// ⛔ This is a NEW file. Does NOT modify existing enrichment code.
// ============================================================

import * as cheerio from 'cheerio';
import type { WebsiteAdapterResult, ExtractedContact } from '../types';

const SOURCE = 'dee_website_adapter';

// ── False-positive filters ───────────────────────────────────

const EMAIL_BLACKLIST_PATTERNS = [
  /\.(png|jpg|jpeg|gif|svg|css|js|webp|ico|woff|woff2|ttf|eot)$/i,
  /sentry\.io/i,
  /example\.com/i,
  /yourdomain/i,
  /wixpress\.com/i,
  /cloudflare/i,
  /localhost/i,
  /test@/i,
  /noreply@/i,
  /no-reply@/i,
  /mailer-daemon/i,
  /postmaster@/i,
  /webmaster@/i,
  /@sentry\./i,
  /@wix\./i,
  /@mailchimp\./i,
];

const SOCIAL_PLATFORMS: Record<string, RegExp> = {
  linkedin: /linkedin\.com\/(?:company|in)\//i,
  instagram: /instagram\.com\//i,
  facebook: /facebook\.com\//i,
  twitter: /(?:twitter\.com|x\.com)\//i,
  tiktok: /tiktok\.com\/@/i,
  youtube: /youtube\.com\/(?:@|channel|c)\//i,
};

const SOCIAL_POST_FILTERS = [
  '/p/', '/status/', '/reel/', '/shorts/', '/watch?v=',
  '/stories/', '/live/', '/s/', '/events/',
];

const SOCIAL_GENERIC_FILTERS = [
  '/login', '/signup', '/help', '/about', '/legal',
  '/privacy', '/terms', '/explore', '/search', '/hashtag',
  '/share', '/sharer',
];

// ── Title patterns for decision-maker detection ──────────────

const TITLE_PATTERNS = [
  /\b(?:CEO|CTO|CFO|COO|CMO|CIO)\b/i,
  /\b(?:founder|co-founder|cofounder)\b/i,
  /\b(?:owner|director|president|partner)\b/i,
  /\b(?:manager|head|lead|chief|principal)\b/i,
  /\b(?:supervisor|coordinator|executive)\b/i,
];

const TEAM_SECTION_PATTERNS = [
  /about\s*us/i, /our\s*team/i, /meet\s*the\s*team/i,
  /leadership/i, /management/i, /our\s*people/i,
  /team\s*members/i, /staff/i,
];

// ── Email Extraction ─────────────────────────────────────────

/**
 * Extract emails using multiple strategies:
 * 1. mailto: links (highest confidence)
 * 2. Standard regex on text content
 * 3. Obfuscated patterns in raw HTML
 * 4. JavaScript concatenation patterns
 */
function extractEmails(html: string, $: cheerio.CheerioAPI): ExtractedContact[] {
  const found = new Map<string, ExtractedContact>();

  // Strategy 1: mailto: links (confidence 0.95)
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const email = href
      .replace(/^mailto:/i, '')
      .split('?')[0]
      .trim()
      .toLowerCase();
    if (isValidEmail(email) && !isBlacklistedEmail(email)) {
      if (!found.has(email) || found.get(email)!.confidence < 0.95) {
        found.set(email, { value: email, source: `${SOURCE}:mailto`, confidence: 0.95 });
      }
    }
  });

  // Strategy 2: Standard regex on full text (confidence 0.85)
  const textContent = $.text();
  const standardRegex = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g;
  let match;
  while ((match = standardRegex.exec(textContent)) !== null) {
    const email = match[0].toLowerCase();
    if (isValidEmail(email) && !isBlacklistedEmail(email)) {
      if (!found.has(email)) {
        found.set(email, { value: email, source: `${SOURCE}:regex`, confidence: 0.85 });
      }
    }
  }

  // Strategy 3: Obfuscated patterns in raw HTML (confidence 0.7)
  const obfuscatedPatterns = [
    // [at] / (at) / {at} variations
    /[a-zA-Z0-9._%+\-]+\s*(?:\[at\]|\(at\)|\{at\}|AT)\s*[a-zA-Z0-9.\-]+\s*(?:\[dot\]|\(dot\)|\{dot\}|DOT)\s*[a-zA-Z]{2,}/gi,
    // HTML entity &#64; = @ and &#46; = .
    /[a-zA-Z0-9._%+\-]+\s*(?:&#64;|&#x40;|%40)\s*[a-zA-Z0-9.\-]+\s*(?:&#46;|&#x2e;)\s*[a-zA-Z]{2,}/gi,
  ];

  for (const pattern of obfuscatedPatterns) {
    while ((match = pattern.exec(html)) !== null) {
      const cleaned = match[0]
        .replace(/\[at\]|\(at\)|\{at\}|&#64;|&#x40;|%40|\s+AT\s+/gi, '@')
        .replace(/\[dot\]|\(dot\)|\{dot\}|&#46;|&#x2e;|\s+DOT\s+/gi, '.')
        .replace(/\s/g, '')
        .toLowerCase();
      if (isValidEmail(cleaned) && !isBlacklistedEmail(cleaned)) {
        if (!found.has(cleaned)) {
          found.set(cleaned, { value: cleaned, source: `${SOURCE}:obfuscated`, confidence: 0.7 });
        }
      }
    }
  }

  // Strategy 4: JavaScript concatenation (confidence 0.6)
  const jsConcatPattern = /(?:document\.write|innerHTML\s*[+=])\s*\(\s*['"]([^'"]+)['"]\s*\+\s*['"]@['"]\s*\+\s*['"]([^'"]+)['"]\s*\)/gi;
  while ((match = jsConcatPattern.exec(html)) !== null) {
    const email = `${match[1]}@${match[2]}`.toLowerCase();
    if (isValidEmail(email) && !isBlacklistedEmail(email)) {
      if (!found.has(email)) {
        found.set(email, { value: email, source: `${SOURCE}:js_concat`, confidence: 0.6 });
      }
    }
  }

  return Array.from(found.values()).slice(0, 15);
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  if (!email || email.length > 100 || email.length < 5) return false;
  return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email);
}

/**
 * Check if email matches known false-positive patterns
 */
function isBlacklistedEmail(email: string): boolean {
  return EMAIL_BLACKLIST_PATTERNS.some((p) => p.test(email));
}

// ── Phone Extraction ─────────────────────────────────────────

/**
 * Extract phone numbers using multiple strategies:
 * 1. tel: links (highest confidence)
 * 2. WhatsApp links
 * 3. Regex patterns for international and local formats
 */
function extractPhones(html: string, $: cheerio.CheerioAPI): ExtractedContact[] {
  const found = new Map<string, ExtractedContact>();

  // Strategy 1: tel: links (confidence 0.95)
  $('a[href^="tel:"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const raw = href.replace(/^tel:/i, '').trim();
    const normalized = normalizePhone(raw);
    if (normalized && normalized.length >= 8) {
      if (!found.has(normalized)) {
        found.set(normalized, { value: normalized, source: `${SOURCE}:tel_link`, confidence: 0.95 });
      }
    }
  });

  // Strategy 2: WhatsApp links (confidence 0.9)
  const waPatterns = [
    /wa\.me\/(\d+)/gi,
    /whatsapp\.com\/send\?phone=(\d+)/gi,
    /api\.whatsapp\.com\/send\?phone=(\d+)/gi,
  ];
  for (const pattern of waPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const normalized = normalizePhone(`+${match[1]}`);
      if (normalized && normalized.length >= 8) {
        if (!found.has(normalized)) {
          found.set(normalized, { value: normalized, source: `${SOURCE}:whatsapp`, confidence: 0.9 });
        }
      }
    }
  }

  // Strategy 3: Regex on text content (confidence 0.7)
  const textContent = $.text().replace(/\s+/g, ' ');
  const phonePatterns = [
    /\+\d{1,3}[\s.\-]?\(?\d{1,4}\)?[\s.\-]?\d{2,4}[\s.\-]?\d{2,4}[\s.\-]?\d{0,4}/g,
    /\(0\d{1,3}\)\s?\d{3,4}[\s.\-]?\d{3,4}/g,
    /0\d{2,3}[\s.\-]\d{3,4}[\s.\-]\d{3,4}/g,
  ];

  for (const pattern of phonePatterns) {
    let match;
    while ((match = pattern.exec(textContent)) !== null) {
      const raw = match[0].trim();
      const normalized = normalizePhone(raw);
      if (normalized && normalized.length >= 8 && normalized.length <= 16) {
        if (!found.has(normalized)) {
          found.set(normalized, { value: normalized, source: `${SOURCE}:regex`, confidence: 0.7 });
        }
      }
    }
  }

  return Array.from(found.values()).slice(0, 10);
}

/**
 * Normalize phone number: strip non-digits except leading +
 */
function normalizePhone(raw: string): string {
  const hasPlus = raw.startsWith('+');
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length < 7) return '';
  return hasPlus ? `+${digits}` : digits;
}

// ── Social Extraction ────────────────────────────────────────

/**
 * Extract and categorize social media profile URLs from anchor tags.
 * Filters out individual posts, generic pages, and tracking params.
 */
function extractSocials($: cheerio.CheerioAPI): WebsiteAdapterResult['socials'] {
  const socials: WebsiteAdapterResult['socials'] = {};

  $('a[href]').each((_, el) => {
    const rawHref = $(el).attr('href') ?? '';
    if (!rawHref.startsWith('http')) return;

    const hrefLower = rawHref.toLowerCase();

    // Filter out posts and generic pages
    const isPost = SOCIAL_POST_FILTERS.some((f) => hrefLower.includes(f));
    const isGeneric = SOCIAL_GENERIC_FILTERS.some((f) => hrefLower.includes(f));
    if (isPost || isGeneric) return;

    for (const [platform, regex] of Object.entries(SOCIAL_PLATFORMS)) {
      if (regex.test(rawHref)) {
        const key = platform as keyof typeof socials;
        if (!socials[key]) {
          socials[key] = cleanSocialUrl(rawHref);
        }
      }
    }
  });

  return socials;
}

/**
 * Clean social URL: remove tracking params, ensure HTTPS, remove trailing slash
 */
function cleanSocialUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove common tracking params
    const trackingParams = [
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'ref', 'igshid', 'fbclid', 'gclid', 'twclid', 'si',
    ];
    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }
    parsed.protocol = 'https:';
    let cleaned = parsed.toString();
    // Remove trailing slash
    if (cleaned.endsWith('/')) cleaned = cleaned.slice(0, -1);
    return cleaned;
  } catch {
    return url;
  }
}

// ── Decision-Maker Detection ─────────────────────────────────

/**
 * Best-effort detection of decision-makers from team/about sections.
 * Scans for name + title proximity patterns.
 */
function extractPeople($: cheerio.CheerioAPI): Array<{ name: string; title: string; confidence: number }> {
  const people: Array<{ name: string; title: string; confidence: number }> = [];
  const seen = new Set<string>();

  // Find team/about sections
  const teamSections: cheerio.Cheerio<cheerio.Element>[] = [];

  $('section, div, article').each((_, el) => {
    const text = $(el).text().slice(0, 200);
    if (TEAM_SECTION_PATTERNS.some((p) => p.test(text))) {
      teamSections.push($(el));
    }
  });

  // If no explicit team sections, scan the entire body (lower confidence)
  const targets = teamSections.length > 0 ? teamSections : [$('body')];
  const baseConfidence = teamSections.length > 0 ? 0.7 : 0.4;

  for (const section of targets) {
    // Pattern 1: <h3>Name</h3> followed by <p>Title</p> in the same container
    section.find('h2, h3, h4').each((_, heading) => {
      const name = $(heading).text().trim();
      if (!name || name.length > 60 || name.split(' ').length < 2 || name.split(' ').length > 5) return;

      // Look for title in the next sibling or parent's children
      const nextEl = $(heading).next('p, span, div, h5, h6');
      const titleText = nextEl.text().trim();

      if (titleText && TITLE_PATTERNS.some((p) => p.test(titleText))) {
        const key = `${name.toLowerCase()}|${titleText.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          people.push({
            name: name.slice(0, 60),
            title: titleText.slice(0, 80),
            confidence: baseConfidence,
          });
        }
      }
    });

    // Pattern 2: Cards with name + title in the same wrapper
    section.find('.team-member, .member, .person, [class*="team"], [class*="staff"]').each((_, card) => {
      const allText = $(card).text().trim();
      const lines = allText.split(/\n/).map((l) => l.trim()).filter(Boolean);

      if (lines.length >= 2) {
        const possibleName = lines[0];
        const possibleTitle = lines[1];

        if (
          possibleName.split(' ').length >= 2 &&
          possibleName.split(' ').length <= 5 &&
          possibleName.length <= 60 &&
          TITLE_PATTERNS.some((p) => p.test(possibleTitle))
        ) {
          const key = `${possibleName.toLowerCase()}|${possibleTitle.toLowerCase()}`;
          if (!seen.has(key)) {
            seen.add(key);
            people.push({
              name: possibleName.slice(0, 60),
              title: possibleTitle.slice(0, 80),
              confidence: baseConfidence - 0.1,
            });
          }
        }
      }
    });
  }

  return people.slice(0, 10);
}

// ── HTML Fetching ────────────────────────────────────────────

const DEFAULT_TIMEOUT = parseInt(process.env.ENRICHMENT_TIMEOUT_MS ?? '12000');
const USE_PLAYWRIGHT = process.env.ENRICHMENT_USE_PLAYWRIGHT !== 'false';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/**
 * Fetch HTML from URL using fast fetch(), with optional Playwright fallback.
 */
async function fetchHtml(url: string): Promise<{ html: string; method: 'fetch' | 'playwright' }> {
  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;

  // Try fast fetch first
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    const res = await fetch(normalizedUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
    });

    clearTimeout(timer);
    const html = await res.text();

    // Check if usable (not a JS SPA shell)
    if (res.status < 400 && html.length > 500 && !isSpaShell(html)) {
      return { html, method: 'fetch' };
    }

    // Fall through to Playwright if fetch result is not usable
    if (!USE_PLAYWRIGHT) return { html, method: 'fetch' };
  } catch {
    if (!USE_PLAYWRIGHT) throw new Error(`fetch() failed for ${url}`);
  }

  // Playwright fallback
  const { chromium } = await import('playwright');
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    const context = await browser.newContext({ userAgent: BROWSER_UA, viewport: { width: 1280, height: 800 } });
    await context.route('**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf,mp4,mp3}', (r) => r.abort());

    const page = await context.newPage();
    await page.goto(normalizedUrl, { waitUntil: 'domcontentloaded', timeout: DEFAULT_TIMEOUT + 5000 });
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(500);

    const html = await page.content();
    return { html, method: 'playwright' };
  } finally {
    await browser?.close().catch(() => {});
  }
}

/**
 * Detect if HTML is a JS SPA shell (not rendered content)
 */
function isSpaShell(html: string): boolean {
  const shellMarkers = [
    '<div id="root"></div>',
    '<div id="app"></div>',
    '<noscript>You need to enable JavaScript',
    '<noscript>JavaScript is required',
  ];
  const hasMarker = shellMarkers.some((m) => html.includes(m));
  if (!hasMarker) return false;

  const bodyContent = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return bodyContent.split(' ').filter(Boolean).length < 30;
}

// ── Main Export ──────────────────────────────────────────────

/**
 * Extract contact information from a website URL or provided HTML.
 *
 * @param url - The website URL to analyze
 * @param html - Optional pre-fetched HTML (skips fetching step)
 * @returns WebsiteAdapterResult with emails, phones, socials, and people
 */
export async function extractFromWebsite(
  url: string,
  html?: string
): Promise<WebsiteAdapterResult> {
  const start = Date.now();
  let fetchMethod: WebsiteAdapterResult['fetch_method'] = 'provided';
  let rawHtml = html ?? '';

  // Fetch HTML if not provided
  if (!html) {
    try {
      const result = await fetchHtml(url);
      rawHtml = result.html;
      fetchMethod = result.method;
    } catch {
      return {
        emails: [],
        phones: [],
        socials: {},
        people: [],
        raw_html_length: 0,
        fetch_method: 'fetch',
        duration_ms: Date.now() - start,
      };
    }
  }

  const $ = cheerio.load(rawHtml);

  // Run all extractors
  const emails = extractEmails(rawHtml, $);
  const phones = extractPhones(rawHtml, $);
  const socials = extractSocials($);
  const people = extractPeople($);

  return {
    emails,
    phones,
    socials,
    people,
    raw_html_length: rawHtml.length,
    fetch_method: fetchMethod,
    duration_ms: Date.now() - start,
  };
}
