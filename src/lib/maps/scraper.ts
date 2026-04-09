// ============================================================
// GOOGLE MAPS SCRAPER — Playwright
// Sources local business listings from Google Maps
// ============================================================

import { chromium, type Browser, type Page } from 'playwright';
import { createHash } from 'crypto';
import type { BusinessListing } from '@/types';
import { insertLog } from '@/lib/db/client';

// ── Helpers ──────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function randomDelay(min = 2000, max = 5000): Promise<void> {
  return sleep(Math.floor(Math.random() * (max - min) + min));
}

function hashBusiness(name: string, address: string, phone: string): string {
  return createHash('sha256')
    .update(`${name.toLowerCase().trim()}|${address.toLowerCase().trim()}|${phone.trim()}`)
    .digest('hex')
    .slice(0, 16);
}

function log(level: 'info' | 'warn' | 'error', message: string, data?: unknown) {
  insertLog(level, `[maps] ${message}`, data);
  console[level](`[maps] ${message}`, data ?? '');
}

// ── Selectors (with fallbacks for Google Maps DOM changes) ───

const SELECTORS = {
  resultsPanel: [
    'div[role="feed"]',
    'div.m6QErb[aria-label]',
    'div.m6QErb',
  ],
  resultItem: [
    'div.Nv2PK',
    'a[jsaction*="pane.resultSection"]',
    'div[jsaction*="pane.result"]',
  ],
  name: [
    'div.qBF1Pd',
    'span.fontHeadlineSmall',
    '[aria-label]',
  ],
  rating: [
    'span.MW4etd',
    'span[aria-label*="stars"]',
  ],
  reviewCount: [
    'span.UY7F9',
    'span[aria-label*="reviews"]',
  ],
  address: [
    'div.W4Etmd span:not(.MW4etd)',
    'span.LrzXr',
    'div[class*="address"]',
  ],
  phone: [
    'span[data-dtype="d3ph"]',
    '[data-item-id*="phone"]',
  ],
  website: [
    'a[data-item-id*="authority"]',
    'a[href*="http"][jsaction*="website"]',
  ],
} as const;

// ── Core scraper ──────────────────────────────────────────────

export interface ScraperOptions {
  keyword: string;
  location: string;
  limit?: number;
  headless?: boolean;
  retries?: number;
}

export async function scrapeGoogleMaps(
  opts: ScraperOptions
): Promise<BusinessListing[]> {
  const { keyword, location, limit = 20, headless = true, retries = 3 } = opts;

  let attempt = 0;
  while (attempt < retries) {
    attempt++;
    try {
      log('info', `Attempt ${attempt}/${retries}: Searching "${keyword}" in "${location}"`);
      const results = await runScrape(keyword, location, limit, headless);
      log('info', `Found ${results.length} businesses`);
      return results;
    } catch (err) {
      log('error', `Attempt ${attempt} failed`, err instanceof Error ? err.message : err);
      if (attempt < retries) {
        await sleep(3000 * attempt); // exponential back-off
      }
    }
  }

  log('error', 'All scrape attempts failed, returning empty');
  return [];
}

async function runScrape(
  keyword: string,
  location: string,
  limit: number,
  headless: boolean
): Promise<BusinessListing[]> {
  const query = encodeURIComponent(`${keyword} ${location}`);
  const url = `https://www.google.com/maps/search/${query}`;

  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await chromium.launch({
      headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      locale: 'en-US',
      viewport: { width: 1280, height: 800 },
    });

    page = await context.newPage();

    // Block images/fonts for speed
    await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf}', (r) => r.abort());

    log('info', `Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await randomDelay(2000, 3000);

    // Handle consent/cookie dialogs
    await dismissConsent(page);

    // Find the results panel
    const panelEl = await findPanel(page);
    if (!panelEl) {
      log('warn', 'Results panel not found — page may have changed structure');
    }

    // Scroll to load more results
    const collected = await scrollAndCollect(page, limit);
    return collected;
  } finally {
    await page?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
}

async function dismissConsent(page: Page): Promise<void> {
  try {
    const consentSelectors = [
      'button[aria-label="Accept all"]',
      'button[aria-label*="Accept"]',
      'button:has-text("Accept all")',
      'button:has-text("I agree")',
      'form[action*="consent"] button',
    ];
    for (const sel of consentSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click();
        await sleep(1500);
        break;
      }
    }
  } catch {
    // Consent dialog may not be present
  }
}

async function findPanel(page: Page) {
  for (const sel of SELECTORS.resultsPanel) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
      return el;
    }
  }
  return null;
}

async function scrollAndCollect(page: Page, limit: number): Promise<BusinessListing[]> {
  const seen = new Set<string>();
  const results: BusinessListing[] = [];

  let lastCount = 0;
  let noNewCount = 0;

  for (let scrollPass = 0; scrollPass < 20; scrollPass++) {
    // Extract all visible items
    const items = await extractListings(page);

    for (const item of items) {
      const key = hashBusiness(item.name, item.address, item.phone ?? '');
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ ...item, hash: key });
      }
    }

    if (results.length >= limit) break;

    // Check for end-of-results marker
    const endMsg = await page.locator('span:has-text("You\'ve reached the end of the list")').isVisible({ timeout: 500 }).catch(() => false);
    if (endMsg) {
      log('info', "Reached end of results list");
      break;
    }

    // Scroll the panel
    await page.evaluate(() => {
      const panels = [
        document.querySelector('div[role="feed"]'),
        document.querySelector('div.m6QErb[aria-label]'),
        document.querySelector('div.m6QErb'),
      ].filter(Boolean);
      if (panels[0]) {
        (panels[0] as HTMLElement).scrollBy(0, 800);
      } else {
        window.scrollBy(0, 800);
      }
    });

    await randomDelay(2000, 4000);

    if (results.length === lastCount) {
      noNewCount++;
      if (noNewCount >= 3) {
        log('info', 'No new results after 3 scroll attempts — stopping');
        break;
      }
    } else {
      noNewCount = 0;
    }
    lastCount = results.length;
  }

  return results.slice(0, limit);
}

async function extractListings(page: Page): Promise<BusinessListing[]> {
  // Try to extract from the DOM using evaluate
  const raw = await page.evaluate(() => {
    const results: Array<{
      name: string;
      address: string;
      phone: string;
      maps_url: string;
      website: string;
      rating: number;
      review_count: number;
      place_id: string;
    }> = [];

    // Google Maps result cards
    const cards = document.querySelectorAll('div.Nv2PK, div[jsaction] a[jsaction*="pane.resultSection"]');

    cards.forEach((card) => {
      try {
        const el = card as HTMLElement;

        // Name
        const nameEl =
          el.querySelector('div.qBF1Pd') ||
          el.querySelector('span.fontHeadlineSmall') ||
          el.querySelector('[aria-label]');
        const name = (nameEl?.textContent || (nameEl as HTMLElement)?.getAttribute('aria-label') || '').trim();

        if (!name) return;

        // Rating
        const ratingEl = el.querySelector('span.MW4etd');
        const rating = ratingEl ? parseFloat(ratingEl.textContent || '0') : 0;

        // Review count
        const reviewEl = el.querySelector('span.UY7F9');
        const reviewText = reviewEl?.textContent?.replace(/[^0-9]/g, '') ?? '0';
        const review_count = parseInt(reviewText, 10) || 0;

        // Address / extra info spans
        const infoSpans = el.querySelectorAll('div.W4Etmd span, div[class*="address"] span');
        let address = '';
        let phone = '';
        infoSpans.forEach((span) => {
          const text = span.textContent?.trim() ?? '';
          if (!text) return;
          if (/^\+?\d[\d\s\-().]{6,}$/.test(text)) {
            phone = text;
          } else if (!address && text.length > 5) {
            address = text;
          }
        });

      // Website and Maps URL
      let website = '';
      let maps_url = '';
      const socialDomains = ['instagram.com', 'facebook.com', 'twitter.com', 'x.com', 'linkedin.com', 'tiktok.com', 'linktr.ee', 'bio.link', 'bio.site', 'wa.me', 'google.com/maps'];

      // Find the specific website link icon/button
      let websiteEl = el.querySelector('a[data-item-id*="authority"]') as HTMLAnchorElement | null;
      if (!websiteEl) {
        // Fallback for different languages (Website, Situs Web)
        const allLinks = Array.from(el.querySelectorAll('a[href^="http"]')) as HTMLAnchorElement[];
        websiteEl = allLinks.find(a => {
          const label = (a.getAttribute('aria-label') || '').toLowerCase();
          return label.includes('website') || label.includes('situs');
        }) || null;
      }

      if (websiteEl && websiteEl.href) {
        const rawHref = websiteEl.href.toLowerCase();
        // Check if it's a social domain or google maps itself
        const isSocialOrMaps = socialDomains.some(domain => rawHref.includes(domain));
        if (!isSocialOrMaps) {
          website = websiteEl.href;
        }
      }

      // Place ID and Maps URL
      let place_id = '';
      
      const anchors = Array.from(el.querySelectorAll('a')) as HTMLAnchorElement[];
      if (el.tagName === 'A') anchors.push(el as HTMLAnchorElement);

      const placeLink = anchors.find(a => a.href && (a.href.includes('/maps/place/') || a.href.includes('/maps/search/'))) 
        || anchors.find(a => a.href && a.href.includes('google.com/maps/'));

      if (placeLink && placeLink.href) {
        const match = placeLink.href.match(/ChIJ[A-Za-z0-9_-]+/);
        place_id = match ? match[0] : '';
        maps_url = placeLink.href.split('?')[0]; // Strip tracking params
      }

      // Final fallback if absolutely nothing found, use the first anchor
      if (!maps_url && anchors.length > 0) {
         maps_url = anchors[0].href;
      }


      results.push({ name, address, phone, website, maps_url, rating, review_count, place_id });
    } catch {
      // Skip malformed cards
    }
  });

  return results;
});

return raw.map((r) => ({
  name: r.name,
  address: r.address,
  phone: r.phone || undefined,
  maps_url: r.maps_url || undefined,
  website: r.website || undefined,
  rating: r.rating || undefined,
  review_count: r.review_count || undefined,
  place_id: r.place_id || undefined,
}));
}
