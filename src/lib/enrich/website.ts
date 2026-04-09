// ============================================================
// WEBSITE ENRICHMENT ORCHESTRATOR — Hybrid Scraper
//
// Strategy (tiered, in order of speed/cost):
//   1. fetch() + Cheerio  → fast, works for ~80% of local biz sites
//   2. Playwright fallback → for JS-heavy sites or when fetch blocked
//
// Extracts (all provenance-tracked):
//   - SEO: title, meta desc, viewport, H1
//   - Signals: SSL, contact form, booking system, social links, emails
//   - Tech: CMS, analytics, booking platforms, JS frameworks
// ============================================================

import * as cheerio from 'cheerio';
import type { EnrichmentData, WebsiteSignals, EnrichedField } from '@/types';
import { extractSeo } from './seo';
import { detectTech } from './tech';
import { insertLog } from '@/lib/db/client';

const SOURCE = 'website_scan';
const DEFAULT_TIMEOUT = parseInt(process.env.ENRICHMENT_TIMEOUT_MS ?? '12000');

// Whether to use Playwright as enrichment fallback (can disable for speed)
const USE_PLAYWRIGHT_FALLBACK = process.env.ENRICHMENT_USE_PLAYWRIGHT !== 'false';

function field<T>(value: T, confidence = 0.9): EnrichedField<T> {
  return { value, source: SOURCE, confidence };
}

function log(level: 'info' | 'warn' | 'error', msg: string, data?: unknown) {
  insertLog(level, `[enrich] ${msg}`, data);
}

// ── Types ─────────────────────────────────────────────────────

interface FetchResult {
  html: string;
  finalUrl: string;
  statusCode: number;
  headers: Record<string, string>;
  duration_ms: number;
  method: 'fetch' | 'playwright';
}

// ── Tier 1: Fast fetch() ──────────────────────────────────────

async function fetchWithHttp(url: string, timeoutMs: number): Promise<FetchResult> {
  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
  const start = Date.now();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(normalizedUrl, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        // Realistic browser User-Agent to avoid basic bot blocks
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    const html = await res.text();
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => { headers[k] = v; });

    return {
      html,
      finalUrl: res.url,
      statusCode: res.status,
      headers,
      duration_ms: Date.now() - start,
      method: 'fetch',
    };
  } finally {
    clearTimeout(timer);
  }
}

// ── Tier 2: Playwright (JS-rendered sites) ────────────────────

async function fetchWithPlaywright(url: string, timeoutMs: number): Promise<FetchResult> {
  const { chromium } = await import('playwright');
  const normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
  const start = Date.now();

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
      ],
    });

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      locale: 'en-US',
      viewport: { width: 1280, height: 800 },
    });

    // Block heavy resources — we only need rendered HTML
    await context.route('**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf,mp4,mp3,avi}', (r) =>
      r.abort()
    );

    const page = await context.newPage();

    let statusCode = 200;
    const responseHeaders: Record<string, string> = {};

    page.on('response', (res) => {
      if (res.url() === page.url() || res.url() === normalizedUrl) {
        statusCode = res.status();
        res.headers() && Object.assign(responseHeaders, res.headers());
      }
    });

    await page.goto(normalizedUrl, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });

    // Wait briefly for JS-rendered content
    await page.waitForTimeout(2000);

    // Scroll down to trigger lazy-load content
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(500);

    const html = await page.content();
    const finalUrl = page.url();

    return {
      html,
      finalUrl,
      statusCode,
      headers: responseHeaders,
      duration_ms: Date.now() - start,
      method: 'playwright',
    };
  } finally {
    await browser?.close().catch(() => {});
  }
}

// ── Heuristic: does HTML look like meaningful content? ────────

function isUsableFetchResult(html: string, statusCode: number): boolean {
  if (statusCode >= 400) return false;
  if (!html || html.length < 500) return false;

  // Signs that fetch returned a JS SPA shell (not rendered content)
  const hasBodyText = /<body[^>]*>[\s\S]{200,}<\/body>/i.test(html);
  const isJsSpaShell =
    html.includes('<div id="root"></div>') ||
    html.includes('<div id="app"></div>') ||
    html.includes('<noscript>You need to enable JavaScript') ||
    html.includes('<noscript>JavaScript is required');

  // If HTML body is tiny but has SPA shell markers, it needs Playwright
  const bodyContent = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                          .replace(/<style[\s\S]*?<\/style>/gi, '')
                          .replace(/<[^>]+>/g, ' ')
                          .replace(/\s+/g, ' ').trim();

  const tooFewWords = bodyContent.split(' ').filter(Boolean).length < 30;

  if (isJsSpaShell && tooFewWords) return false;
  if (!hasBodyText) return false;

  return true;
}

// ── Unified fetch with intelligent tiering ────────────────────

async function smartFetch(url: string, timeoutMs: number): Promise<FetchResult> {
  // Try fast fetch first
  try {
    const result = await fetchWithHttp(url, timeoutMs);

    if (isUsableFetchResult(result.html, result.statusCode)) {
      log('info', `fetch() OK for ${url} (${result.statusCode}, ${result.html.length} bytes)`);
      return result;
    }

    // fetch() returned something, but it looks like a JS shell
    if (USE_PLAYWRIGHT_FALLBACK) {
      log('info', `fetch() got JS shell, falling back to Playwright for ${url}`);
      return await fetchWithPlaywright(url, timeoutMs + 5000);
    }

    return result; // return what we have
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);

    // Specific conditions that warrant Playwright retry
    const shouldTryPlaywright =
      USE_PLAYWRIGHT_FALLBACK &&
      (msg.includes('abort') ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('certificate') ||
        msg.includes('SSL') ||
        msg.includes('403') ||
        msg.includes('blocked'));

    if (shouldTryPlaywright) {
      log('warn', `fetch() failed (${msg}), trying Playwright for ${url}`);
      return await fetchWithPlaywright(url, timeoutMs + 5000);
    }

    throw fetchErr;
  }
}

// ── Signal extractor ──────────────────────────────────────────

function extractWebsiteSignals(
  html: string,
  finalUrl: string,
  headers: Record<string, string>,
  has_booking_tech: boolean
): WebsiteSignals {
  const $ = cheerio.load(html);
  const signals: WebsiteSignals = {};

  // ── SSL ───────────────────────────────────────────────────
  signals.has_ssl = {
    value: finalUrl.startsWith('https://'),
    source: 'url_check',
    confidence: 1.0,
  };

  // ── Contact form ─────────────────────────────────────────
  const contactKeywords = /contact|message|enquiry|inquiry|reach|get.?in.?touch|send.?us|hubungi/i;
  let contactForm = false;
  $('form').each((_, form) => {
    const text = $(form).text().toLowerCase();
    const action = ($(form).attr('action') ?? '').toLowerCase();
    const hasEmailInput = $(form).find('input[type="email"], input[name*="email"], input[id*="email"]').length > 0;
    const hasMessageInput = $(form).find('textarea, input[name*="message"]').length > 0;
    if (contactKeywords.test(text) || contactKeywords.test(action) || hasEmailInput || hasMessageInput) {
      contactForm = true;
    }
  });
  // Also check for links to contact page or WhatsApp
  const hasWhatsApp = /wa\.me|whatsapp\.com\/send/i.test(html);
  signals.has_contact_form = field(contactForm || hasWhatsApp, 0.85);

  // ── Booking / appointment ─────────────────────────────────
  const bookingKeywords =
    /book\s*(now|appointment|online)?|schedule|reserve|appointment|make\s*a\s*(booking|reservation)|pesan\s*sekarang|buat\s*janji/i;
  const allText = $('body').text();
  const buttonText = $('a, button').map((_, el) => $(el).text()).get().join(' ');
  signals.has_booking = field(has_booking_tech || bookingKeywords.test(buttonText), 0.8);

  // ── Social links ──────────────────────────────────────────
  const socialPatterns: Record<string, RegExp> = {
    facebook:  /facebook\.com\//i,
    instagram: /instagram\.com\//i,
    twitter:   /twitter\.com\/|x\.com\//i,
    linkedin:  /linkedin\.com\//i,
    tiktok:    /tiktok\.com\//i,
    youtube:   /youtube\.com\//i,
    pinterest: /pinterest\.com\//i,
    telegram:  /t\.me\//i,
  };

  const foundSocials: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    for (const [platform, re] of Object.entries(socialPatterns)) {
      if (re.test(href) && !foundSocials.includes(platform)) {
        foundSocials.push(platform);
      }
    }
  });

  signals.social_links = field(foundSocials, 0.95);
  signals.has_social = field(foundSocials.length > 0, 0.95);

  // ── Email extraction ──────────────────────────────────────
  const emails = new Set<string>();

  // mailto: links (highest confidence)
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const email = href.replace('mailto:', '').split('?')[0].trim().toLowerCase();
    if (email.includes('@') && email.length < 100) emails.add(email);
  });

  // Regex scan in all text content
  const emailRegex = /\b[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\b/g;
  const fullText = $.text();
  let emailMatch;
  while ((emailMatch = emailRegex.exec(fullText)) !== null) {
    const e = emailMatch[0].toLowerCase();
    // Filter out false positives (image filenames, sentry DSNs, etc.)
    if (
      !/(\.png|\.jpg|\.gif|\.svg|\.css|\.js|sentry\.io|example\.com|yourdomain)$/i.test(e) &&
      e.length < 80
    ) {
      emails.add(e);
    }
  }

  // Also scan raw HTML for obfuscated emails (common on local biz sites)
  const htmlEmailRegex = /[a-zA-Z0-9._%+\-]+\s*(?:@|&#64;|%40|AT)\s*[a-zA-Z0-9.\-]+\s*(?:\.|&#46;|DOT)\s*[a-zA-Z]{2,}/gi;
  let rawMatch;
  while ((rawMatch = htmlEmailRegex.exec(html)) !== null) {
    const cleaned = rawMatch[0]
      .replace(/&#64;|%40|\s+AT\s+/gi, '@')
      .replace(/&#46;|\s+DOT\s+/gi, '.')
      .replace(/\s/g, '')
      .toLowerCase();
    if (cleaned.includes('@') && cleaned.length < 80) {
      emails.add(cleaned);
    }
  }

  signals.emails = field([...emails].slice(0, 10), 0.9);

  // ── Phone on page ─────────────────────────────────────────
  const phoneOnPage =
    $('a[href^="tel:"]').length > 0 ||
    /(\+?[\d\s\-().]{8,})/.test(allText.slice(0, 5000));
  signals.has_phone_on_page = field(phoneOnPage, 0.8);

  return signals;
}

// ── Main enrichment function ──────────────────────────────────

export interface EnrichmentOptions {
  url: string;
  retries?: number;
  timeout?: number;
  forcePlaywright?: boolean; // override to always use Playwright
}

export async function enrichWebsite(opts: EnrichmentOptions): Promise<EnrichmentData> {
  const { url, retries = 2, timeout = DEFAULT_TIMEOUT, forcePlaywright = false } = opts;
  const errors: string[] = [];
  const startTime = Date.now();
  let lastError = '';

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      log('info', `Enriching ${url} (attempt ${attempt}/${retries})`);

      let fetchResult: FetchResult;

      if (forcePlaywright) {
        log('info', `Using Playwright (forced) for ${url}`);
        fetchResult = await fetchWithPlaywright(url, timeout);
      } else {
        fetchResult = await smartFetch(url, timeout);
      }

      const { html, finalUrl, statusCode, headers, duration_ms, method } = fetchResult;

      if (statusCode >= 400) {
        errors.push(`HTTP ${statusCode} on attempt ${attempt} via ${method}`);
        if (attempt < retries) continue;
      }

      log('info', `Fetched ${url} via ${method} — ${html.length} bytes, ${duration_ms}ms`);

      // Run all data extractors
      const seo = extractSeo(html, finalUrl);
      const { tech, has_booking_tech } = detectTech(html, headers);
      const website = extractWebsiteSignals(html, finalUrl, headers, has_booking_tech);

      const result: EnrichmentData = {
        seo,
        website,
        tech,
        raw_url: url,
        final_url: finalUrl,
        status_code: statusCode,
        enriched_at: new Date().toISOString(),
        errors: errors.length > 0 ? errors : undefined,
        duration_ms: Date.now() - startTime,
      };

      log(
        'info',
        `✅ ${url} — SSL:${website.has_ssl?.value ? '✓' : '✗'} ` +
        `Social:${website.has_social?.value ? '✓' : '✗'} ` +
        `Booking:${website.has_booking?.value ? '✓' : '✗'} ` +
        `Emails:${website.emails?.value?.length ?? 0} ` +
        `Tech:${tech.detected_tech?.value?.join(',') ?? 'none'} ` +
        `[${method}]`
      );

      return result;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      errors.push(`Attempt ${attempt}: ${lastError}`);
      log('warn', `Enrichment attempt ${attempt} failed for ${url}: ${lastError}`);

      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 2500 * attempt));
      }
    }
  }

  log('error', `All enrichment attempts failed for ${url}: ${lastError}`);

  return {
    raw_url: url,
    enriched_at: new Date().toISOString(),
    errors,
    duration_ms: Date.now() - startTime,
  };
}

// ── Flatten for scoring context ───────────────────────────────

export interface FlatEnrichment {
  has_ssl: boolean;
  has_contact_form: boolean;
  has_booking: boolean;
  has_social: boolean;
  has_website: boolean;
  emails: string[];
  social_links: string[];
  detected_tech: string[];
  cms?: string;
}

export function flattenEnrichment(enrichment?: EnrichmentData): FlatEnrichment {
  if (!enrichment) {
    return {
      has_ssl: false,
      has_contact_form: false,
      has_booking: false,
      has_social: false,
      has_website: false,
      emails: [],
      social_links: [],
      detected_tech: [],
    };
  }

  return {
    has_ssl: enrichment.website?.has_ssl?.value ?? false,
    has_contact_form: enrichment.website?.has_contact_form?.value ?? false,
    has_booking: enrichment.website?.has_booking?.value ?? false,
    has_social: enrichment.website?.has_social?.value ?? false,
    has_website: !!enrichment.final_url,
    emails: enrichment.website?.emails?.value ?? [],
    social_links: enrichment.website?.social_links?.value ?? [],
    detected_tech: enrichment.tech?.detected_tech?.value ?? [],
    cms: enrichment.tech?.cms?.value,
  };
}
