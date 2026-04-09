// ============================================================
// SEARCH ENGINE DISCOVERY (DuckDuckGo Lite)
// Fallback technique to find websites and social media links 
// when missing from local maps listings.
// ============================================================

import * as cheerio from 'cheerio';
import { insertLog } from '@/lib/db/client';
import { EnrichedField } from '@/types';

function log(level: 'info' | 'warn' | 'error', msg: string) {
  insertLog(level, `[search] ${msg}`);
}

export interface DiscoveredSignals {
  website?: string;
  websiteSource?: 'search_engine';
  socialLinks: string[];
}

// Common directories & platforms that are NOT a business's official website
const DIRECTORY_DOMAINS = [
  'tripadvisor.com', 'yelp.com', 'agoda.com', 'booking.com', 'traveloka.com',
  'yellowpages.com', 'foursquare.com', 'zomato.com', 'opentable.com',
  'linkedin.com/company', 'facebook.com', 'instagram.com', 'instagram.com/p/',
  'twitter.com', 'x.com', 'tiktok.com', 'pinterest.com', 'youtube.com',
  'grab.com', 'gofood.co.id', 'shopeefood', 'tokopedia.com', 'shopee.co.id',
  'google.com', 'duckduckgo.com', 'bing.com', 'mapquest.com', 'waze.com',
  'business.site', // Google Business auto-generated subdomains (often dead now)
];

const SOCIAL_DOMAINS = [
  'instagram.com/', 'facebook.com/', 'linkedin.com/company/', 
  'tiktok.com/@', 'twitter.com/', 'x.com/', 'youtube.com/', 'linktr.ee/'
];

export async function discoverBusinessLinks(
  businessName: string,
  location: string
): Promise<DiscoveredSignals> {
  const query = encodeURIComponent(`${businessName} ${location}`);
  const url = `https://search.yahoo.com/search?p=${query}`;

  try {
    log('info', `Searching Yahoo for: ${businessName} in ${location}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), parseInt(process.env.ENRICHMENT_TIMEOUT_MS ?? '12000'));
    
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!res.ok) {
      log('warn', `Yahoo Search failed with HTTP ${res.status}`);
      return { socialLinks: [] };
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    let websiteUrl: string | undefined;
    const socialLinks = new Set<string>();

    $('a').each((_, el) => {
      let rawUrl = $(el).attr('href');
      if (!rawUrl) return;

      // Extract cleanly from Yahoo redirect structure
      const match = rawUrl.match(/\/RU=([^/]+)/);
      if (match) {
        try {
           rawUrl = decodeURIComponent(match[1]);
        } catch { /* ignore bad encoding */ }
      }

      if (!rawUrl.startsWith('http')) return;
      if (rawUrl.includes('yahoo.com')) return;

      const urlLower = rawUrl.toLowerCase();
      const tryHost = (u: string) => { try { return new URL(u).hostname; } catch { return ''; } };
      const host = tryHost(rawUrl);
      if (!host) return;

      // Check if it's a social profile
      for (const social of SOCIAL_DOMAINS) {
        if (urlLower.includes(social)) {
          // Avoid grabbing single posts instead of profiles
          if (!urlLower.includes('/p/') && !urlLower.includes('/status/') && !urlLower.includes('/shorts/')) {
            socialLinks.add(rawUrl);
          }
          return;
        }
      }

      // Check if it's an official website (not a directory)
      const isDirectory = DIRECTORY_DOMAINS.some(d => host.includes(d));
      if (!isDirectory && !websiteUrl) {
         websiteUrl = rawUrl;
      }
    });

    log('info', `Found: Website(${websiteUrl || 'none'}) Socials(${socialLinks.size})`);

    return {
      website: websiteUrl,
      websiteSource: websiteUrl ? 'search_engine' : undefined,
      socialLinks: Array.from(socialLinks)
    };

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log('error', `Search engine discovery failed: ${errorMsg}`);
    return { socialLinks: [] };
  }
}
