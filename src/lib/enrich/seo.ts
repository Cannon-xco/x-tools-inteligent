// ============================================================
// SEO ENRICHMENT MODULE
// Extracts on-page SEO signals from a website's HTML
// ============================================================

import * as cheerio from 'cheerio';
import type { SeoData, EnrichedField } from '@/types';

const SOURCE = 'website_scan';

function field<T>(value: T, confidence = 0.9): EnrichedField<T> {
  return { value, source: SOURCE, confidence };
}

export function extractSeo(html: string, finalUrl: string): SeoData {
  const $ = cheerio.load(html);
  const seo: SeoData = {};

  // Page title
  const title = $('title').first().text().trim();
  if (title) {
    seo.title = field(title);
  }

  // Meta description
  const metaDesc =
    $('meta[name="description"]').attr('content') ||
    $('meta[property="og:description"]').attr('content') ||
    '';
  if (metaDesc.trim()) {
    seo.meta_description = field(metaDesc.trim());
  }

  // Viewport (mobile-friendly)
  const viewport = $('meta[name="viewport"]').attr('content');
  seo.has_viewport = field(!!viewport, 1.0);

  // Canonical URL
  const canonical =
    $('link[rel="canonical"]').attr('href') || finalUrl;
  if (canonical) {
    seo.canonical_url = field(canonical, 0.95);
  }

  // H1 tag
  const h1 = $('h1').first().text().trim();
  if (h1) {
    seo.h1 = field(h1, 0.95);
  }

  return seo;
}
