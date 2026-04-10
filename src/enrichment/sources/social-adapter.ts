/**
 * Social Adapter — Deep Enrichment Engine (DEE)
 *
 * Detects, normalizes, and optionally verifies social media profile URLs
 * extracted from SERP results or website HTML.
 *
 * @module enrichment/sources/social-adapter
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** Supported social media platforms. */
export type SocialPlatform =
  | 'linkedin'
  | 'instagram'
  | 'facebook'
  | 'twitter'
  | 'tiktok'
  | 'youtube';

/** A detected and normalized social media profile for a business. */
export interface SocialProfile {
  /** Social platform identifier. */
  platform: SocialPlatform;
  /** Normalized URL (HTTPS, lowercase, tracking params removed). */
  url: string;
  /** Original URL before normalization. */
  original_url: string;
  /** Whether a HEAD/GET request to the URL returned 2xx or 3xx. */
  verified: boolean;
  /** Confidence score 0.0–1.0. */
  confidence: number;
  /** Source context (e.g. "website_html", "serp"). */
  source: string;
}

/** Result returned by `enrichSocials`. */
export interface SocialAdapterResult {
  /** All detected profiles (one per platform). */
  profiles: SocialProfile[];
  /** Convenience map of platform → best URL. */
  socials: {
    linkedin?: string;
    instagram?: string;
    facebook?: string;
    twitter?: string;
    tiktok?: string;
    youtube?: string;
  };
  /** Total distinct profiles found. */
  total_found: number;
  /** Wall-clock time for the entire operation in ms. */
  duration_ms: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Platform detection rules.
 * Order matters: more-specific patterns should come first.
 */
const PLATFORM_PATTERNS: Array<{ platform: SocialPlatform; pattern: RegExp }> = [
  { platform: 'linkedin', pattern: /linkedin\.com\/company\//i },
  { platform: 'instagram', pattern: /(?:www\.)?instagram\.com\/(?!p\/|reel\/|explore\/|hashtag\/|accounts\/)/i },
  { platform: 'facebook', pattern: /(?:www\.)?facebook\.com\/(?!login|signup|help|sharer|share)/i },
  { platform: 'twitter', pattern: /(?:www\.)?(?:twitter|x)\.com\/(?!login|signup|search|explore|intent\/)/i },
  { platform: 'tiktok', pattern: /(?:www\.)?tiktok\.com\/@/i },
  { platform: 'youtube', pattern: /(?:www\.)?youtube\.com\/(?:channel\/|@|user\/)/i },
];

/**
 * Patterns that indicate a non-business page on a social platform
 * (individual posts, generic platform pages, search pages, etc.).
 */
const BLACKLIST_PATTERNS: RegExp[] = [
  /\/p\//,        // Instagram posts
  /\/status\//,   // Twitter/X status
  /\/reel\//,     // Instagram reels
  /\/shorts\//,   // YouTube shorts
  /\/watch\?v=/,  // YouTube videos
  /\/login/,
  /\/signup/,
  /\/help/,
  /\/about$/,
  /\/search/,
  /\/explore/,
  /\/hashtag/,
];

/** Tracking query params to strip from social URLs. */
const TRACKING_PARAMS: string[] = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'ref', 'igshid', 'igsh', 'fbclid', 's',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Detect which social platform a URL belongs to.
 * Returns `null` if it is not a recognizable business-profile URL.
 */
function detectPlatform(url: string): SocialPlatform | null {
  if (!url || typeof url !== 'string') return null;
  if (BLACKLIST_PATTERNS.some((p) => p.test(url))) return null;

  for (const { platform, pattern } of PLATFORM_PATTERNS) {
    if (pattern.test(url)) return platform;
  }
  return null;
}

/**
 * Normalize a social media URL:
 * - Enforce HTTPS scheme
 * - Strip `www.` prefix
 * - Remove known tracking query parameters
 * - Remove trailing slash from the path
 * - Lowercase the entire URL
 *
 * @param url - Raw URL string to normalize.
 * @returns Normalized URL string.
 */
function normalizeSocialUrl(url: string): string {
  try {
    const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const parsed = new URL(withScheme);

    parsed.protocol = 'https:';
    parsed.hostname = parsed.hostname.replace(/^www\./i, '');

    TRACKING_PARAMS.forEach((param) => parsed.searchParams.delete(param));

    // Remove trailing slash from pathname (keep root "/" untouched)
    if (parsed.pathname.length > 1) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    }

    return parsed.toString().toLowerCase();
  } catch {
    return url.toLowerCase().replace(/\/+$/, '');
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Detect social media profiles dari list URL yang ditemukan.
 * Typically called after SERP atau website scraping.
 *
 * @param urls   - Array of raw URL strings to inspect.
 * @param source - Label indicating where the URLs came from (e.g. "website_html").
 * @returns Array of detected `SocialProfile` objects (one per platform).
 */
export function detectSocialProfiles(urls: string[], source: string): SocialProfile[] {
  const seen = new Map<SocialPlatform, SocialProfile>();

  for (const original_url of urls) {
    if (!original_url || typeof original_url !== 'string') continue;

    const platform = detectPlatform(original_url);
    if (!platform) continue;

    // Keep first occurrence per platform
    if (!seen.has(platform)) {
      const normalized = normalizeSocialUrl(original_url);
      seen.set(platform, {
        platform,
        url: normalized,
        original_url,
        verified: false,
        confidence: 0.7,
        source,
      });
    }
  }

  return Array.from(seen.values());
}

/**
 * Verify a single social profile by making a HEAD request.
 * On network error the profile is returned with `verified: false`.
 *
 * @param profile - Profile to verify.
 * @param timeout - Fetch timeout in milliseconds.
 */
async function verifyProfile(
  profile: SocialProfile,
  timeout: number,
): Promise<SocialProfile> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(profile.url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });
    const ok = res.ok || (res.status >= 300 && res.status < 400);
    return { ...profile, verified: ok, confidence: ok ? 0.9 : 0.5 };
  } catch {
    return { ...profile, verified: false, confidence: 0.5 };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Full social detection: dari URL list + optional fetch verification.
 *
 * @param urls    - Array of raw URL strings (from SERP or HTML).
 * @param source  - Label for the data source.
 * @param options - `verify`: whether to confirm URLs with HTTP; `timeout`: ms per request.
 * @returns `SocialAdapterResult` with profiles, convenience map, and timing.
 */
export async function enrichSocials(
  urls: string[],
  source: string,
  options?: { verify?: boolean; timeout?: number },
): Promise<SocialAdapterResult> {
  const start = Date.now();
  const { verify = false, timeout = 5_000 } = options ?? {};

  let profiles = detectSocialProfiles(urls, source);

  if (verify && profiles.length > 0) {
    profiles = await Promise.all(profiles.map((p) => verifyProfile(p, timeout)));
  }

  const socials: SocialAdapterResult['socials'] = {};
  for (const p of profiles) {
    (socials as Record<string, string>)[p.platform] = p.url;
  }

  return {
    profiles,
    socials,
    total_found: profiles.length,
    duration_ms: Date.now() - start,
  };
}
