// ============================================================
// TECH DETECTION MODULE
// Detects CMS, frameworks, and analytics tools from HTML
// ============================================================

import * as cheerio from 'cheerio';
import type { TechData, EnrichedField } from '@/types';

const SOURCE = 'tech_detection';

function field<T>(value: T, confidence = 0.8): EnrichedField<T> {
  return { value, source: SOURCE, confidence };
}

interface TechSignature {
  name: string;
  category: 'cms' | 'analytics' | 'framework' | 'ecommerce' | 'booking' | 'other';
  patterns: Array<{
    type: 'html' | 'header' | 'url' | 'script' | 'meta';
    pattern: RegExp;
    confidence?: number;
  }>;
}

const SIGNATURES: TechSignature[] = [
  // CMS
  { name: 'WordPress', category: 'cms', patterns: [
    { type: 'html', pattern: /wp-content|wp-includes|wordpress/i },
    { type: 'meta', pattern: /WordPress/i },
    { type: 'url', pattern: /\/wp-json\//i },
  ]},
  { name: 'Wix', category: 'cms', patterns: [
    { type: 'html', pattern: /wix\.com|wixstatic\.com/i },
    { type: 'meta', pattern: /Wix\.com/i },
  ]},
  { name: 'Squarespace', category: 'cms', patterns: [
    { type: 'html', pattern: /squarespace\.com|Static\.SQUARESPACE_URLS/i },
  ]},
  { name: 'Shopify', category: 'ecommerce', patterns: [
    { type: 'html', pattern: /Shopify\.theme|cdn\.shopify\.com/i },
  ]},
  { name: 'Webflow', category: 'cms', patterns: [
    { type: 'html', pattern: /webflow\.com/i },
  ]},
  { name: 'Joomla', category: 'cms', patterns: [
    { type: 'html', pattern: /\/components\/com_|Joomla!/i },
  ]},
  { name: 'Drupal', category: 'cms', patterns: [
    { type: 'html', pattern: /Drupal\.settings|drupal\.org/i },
  ]},
  { name: 'Ghost', category: 'cms', patterns: [
    { type: 'html', pattern: /ghost-theme|ghost\.io/i },
  ]},
  // Analytics
  { name: 'Google Analytics', category: 'analytics', patterns: [
    { type: 'html', pattern: /google-analytics\.com|gtag\(|GoogleAnalyticsObject/i },
  ]},
  { name: 'Google Tag Manager', category: 'analytics', patterns: [
    { type: 'html', pattern: /googletagmanager\.com/i },
  ]},
  { name: 'Facebook Pixel', category: 'analytics', patterns: [
    { type: 'html', pattern: /connect\.facebook\.net\/en_US\/fbevents/i },
  ]},
  // Frameworks
  { name: 'React', category: 'framework', patterns: [
    { type: 'html', pattern: /__REACT_DEVTOOLS_GLOBAL_HOOK__|react\.development|react-dom|react/i },
    { type: 'html', pattern: /data-reactroot|data-react/i },
  ]},
  { name: 'Next.js', category: 'framework', patterns: [
    { type: 'html', pattern: /__NEXT_DATA__/i },
  ]},
  { name: 'Vue.js', category: 'framework', patterns: [
    { type: 'html', pattern: /vue\.runtime|vuejs\.org/i },
  ]},
  { name: 'Angular', category: 'framework', patterns: [
    { type: 'html', pattern: /ng-version|angular\.min/i },
  ]},
  // Booking
  { name: 'Calendly', category: 'booking', patterns: [
    { type: 'html', pattern: /calendly\.com/i },
  ]},
  { name: 'Acuity Scheduling', category: 'booking', patterns: [
    { type: 'html', pattern: /acuityscheduling\.com/i },
  ]},
  { name: 'Booksy', category: 'booking', patterns: [
    { type: 'html', pattern: /booksy\.com/i },
  ]},
  { name: 'Fresha', category: 'booking', patterns: [
    { type: 'html', pattern: /fresha\.com/i },
  ]},
  { name: 'SimplyBook', category: 'booking', patterns: [
    { type: 'html', pattern: /simplybook\.me/i },
  ]},
  // Infrastructure / Other
  { name: 'Cloudflare', category: 'other', patterns: [
    { type: 'html', pattern: /cloudflare/i },
    { type: 'header', pattern: /cloudflare/i },
  ]},
];

export interface TechDetectionResult {
  tech: TechData;
  has_booking_tech: boolean;
}

export function detectTech(html: string, headers: Record<string, string> = {}): TechDetectionResult {
  const $ = cheerio.load(html);
  const htmlLower = html; // keep original case for regex
  const headerStr = JSON.stringify(headers);

  const detected: Array<{ name: string; category: string; confidence: number }> = [];

  for (const sig of SIGNATURES) {
    let matched = false;
    let maxConf = 0.8;

    for (const p of sig.patterns) {
      const target = p.type === 'header' ? headerStr : htmlLower;
      if (p.pattern.test(target)) {
        matched = true;
        maxConf = Math.max(maxConf, p.confidence ?? 0.8);
        break;
      }
    }

    if (matched) {
      detected.push({ name: sig.name, category: sig.category, confidence: maxConf });
    }
  }

  const techNames = detected.map((d) => d.name);
  const cms = detected.find((d) => d.category === 'cms')?.name;
  const analytics = detected.filter((d) => d.category === 'analytics').map((d) => d.name);
  const frameworks = detected.filter((d) => d.category === 'framework').map((d) => d.name);
  const has_booking_tech = detected.some((d) => d.category === 'booking' || d.category === 'ecommerce');

  const tech: TechData = {};

  if (techNames.length > 0) {
    tech.detected_tech = field(techNames);
  }
  if (cms) {
    tech.cms = field(cms);
  }
  if (analytics.length > 0) {
    tech.analytics = field(analytics);
  }
  if (frameworks.length > 0) {
    tech.frameworks = field(frameworks);
  }

  return { tech, has_booking_tech };
}
