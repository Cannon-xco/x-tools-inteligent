/**
 * @fileoverview DNS Adapter for Deep Enrichment Engine (DEE)
 * Performs DNS lookups for domain validation and email verification.
 *
 * @module src/enrichment/sources/dns-adapter
 */

import { promises as dns } from 'dns';

/**
 * Result of a DNS lookup operation.
 */
export interface DnsResult {
  /** The domain that was looked up */
  domain: string;
  /** Whether domain has valid DNS records (A/AAAA) */
  is_valid: boolean;
  /** Whether domain actively resolves */
  is_active: boolean;
  /** Whether domain has MX records (can receive email) */
  has_mx: boolean;
  /** List of MX records with priority */
  mx_records: Array<{
    exchange: string;
    priority: number;
  }>;
  /** IP addresses from A record lookup */
  a_records: string[];
  /** If domain redirects to another domain */
  redirects_to?: string;
  /** Lookup duration in milliseconds */
  duration_ms: number;
}

/**
 * Cache entry for DNS results.
 */
interface CacheEntry {
  result: DnsResult;
  timestamp: number;
}

/** In-memory cache for DNS lookups */
const cache = new Map<string, CacheEntry>();

/** Cache TTL: 24 hours in milliseconds */
const CACHE_TTL = 24 * 60 * 60 * 1000;

/** Default timeout for DNS operations: 10 seconds */
const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Creates an AbortController with timeout.
 *
 * @param ms - Timeout in milliseconds
 * @returns AbortController instance
 */
function createTimeoutController(ms: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller;
}

/**
 * Gets cached result if available and not expired.
 *
 * @param domain - Domain to check in cache
 * @returns Cached result or null if not found/expired
 */
function getCachedResult(domain: string): DnsResult | null {
  const entry = cache.get(domain);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL) {
    cache.delete(domain);
    return null;
  }

  return entry.result;
}

/**
 * Stores result in cache.
 *
 * @param domain - Domain to cache
 * @param result - DNS result to store
 */
function setCachedResult(domain: string, result: DnsResult): void {
  cache.set(domain, {
    result,
    timestamp: Date.now(),
  });
}

/**
 * Checks if a domain redirects to another URL.
 * Performs a HEAD request and follows redirects.
 *
 * @param domain - Domain to check
 * @param timeoutMs - Timeout in milliseconds
 * @returns Redirect target or undefined
 */
async function checkRedirect(
  domain: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<string | undefined> {
  try {
    const controller = createTimeoutController(timeoutMs);
    const urls = [`https://${domain}`, `http://${domain}`];

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          method: 'HEAD',
          redirect: 'manual',
          signal: controller.signal,
        });

        // Check for redirect status codes
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          if (location) {
            const redirectUrl = new URL(location);
            if (redirectUrl.hostname !== domain) {
              return redirectUrl.hostname;
            }
          }
        }

        // If we got here, no cross-domain redirect
        return undefined;
      } catch {
        // Try next URL scheme
        continue;
      }
    }

    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Performs DNS lookup for domain validation.
 * Checks A records, AAAA records, and MX records.
 * Timeout: 10 seconds.
 *
 * @param domain - Domain to lookup
 * @returns DNS result with validation status
 */
export async function lookupDns(domain: string): Promise<DnsResult> {
  const startTime = Date.now();

  // Check cache first
  const cached = getCachedResult(domain);
  if (cached) {
    return {
      ...cached,
      duration_ms: Date.now() - startTime,
    };
  }

  const result: DnsResult = {
    domain,
    is_valid: false,
    is_active: false,
    has_mx: false,
    mx_records: [],
    a_records: [],
    duration_ms: 0,
  };

  try {
    // Create timeout controller
    const controller = createTimeoutController(DEFAULT_TIMEOUT_MS);

    // Check A records (IPv4)
    try {
      const aRecords = await Promise.race([
        dns.resolve4(domain),
        new Promise<string[]>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error('Timeout'));
          });
        }),
      ]);
      result.a_records = aRecords;
      result.is_valid = true;
      result.is_active = true;
    } catch (err) {
      // A record failed, try AAAA
    }

    // Check AAAA records (IPv6) if no A records
    if (result.a_records.length === 0) {
      try {
        const aaaaRecords = await Promise.race([
          dns.resolve6(domain),
          new Promise<string[]>((_, reject) => {
            controller.signal.addEventListener('abort', () => {
              reject(new Error('Timeout'));
            });
          }),
        ]);
        if (aaaaRecords.length > 0) {
          result.is_valid = true;
          result.is_active = true;
        }
      } catch {
        // AAAA also failed
      }
    }

    // Check MX records
    try {
      const mxRecords = await Promise.race([
        dns.resolveMx(domain),
        new Promise<Array<{ exchange: string; priority: number }>>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error('Timeout'));
          });
        }),
      ]);
      result.mx_records = mxRecords.sort((a, b) => a.priority - b.priority);
      result.has_mx = mxRecords.length > 0;
      // If has MX, domain is valid
      if (result.has_mx) {
        result.is_valid = true;
      }
    } catch {
      // No MX records
      result.has_mx = false;
    }

    // Check for redirects (only if domain is valid)
    if (result.is_valid) {
      result.redirects_to = await checkRedirect(domain, 5000);
    }
  } catch {
    // Any error results in default false values
    result.is_valid = false;
    result.is_active = false;
    result.has_mx = false;
  }

  result.duration_ms = Date.now() - startTime;

  // Cache the result
  setCachedResult(domain, result);

  return result;
}

/**
 * Verifies if an email's domain has valid MX records.
 * Quick check for email domain validation.
 *
 * @param email - Email address to verify
 * @returns Verification result with domain and MX status
 */
export async function verifyEmailDomain(email: string): Promise<{
  email: string;
  domain: string;
  is_valid: boolean;
  mx_host?: string;
}> {
  // Extract domain from email
  const domainMatch = email.match(/@([^@]+)$/);
  if (!domainMatch) {
    return {
      email,
      domain: '',
      is_valid: false,
    };
  }

  const domain = domainMatch[1];

  try {
    const controller = createTimeoutController(DEFAULT_TIMEOUT_MS);

    const mxRecords = await Promise.race([
      dns.resolveMx(domain),
      new Promise<Array<{ exchange: string; priority: number }>>((_, reject) => {
        controller.signal.addEventListener('abort', () => {
          reject(new Error('Timeout'));
        });
      }),
    ]);

    const sortedMx = mxRecords.sort((a, b) => a.priority - b.priority);
    const hasMx = sortedMx.length > 0;

    return {
      email,
      domain,
      is_valid: hasMx,
      mx_host: hasMx ? sortedMx[0].exchange : undefined,
    };
  } catch {
    return {
      email,
      domain,
      is_valid: false,
    };
  }
}

/**
 * Clears the DNS cache. Useful for testing.
 */
export function clearDnsCache(): void {
  cache.clear();
}

/**
 * Gets cache statistics for monitoring.
 *
 * @returns Object with cache size and entries
 */
export function getCacheStats(): {
  size: number;
  domains: string[];
} {
  return {
    size: cache.size,
    domains: Array.from(cache.keys()),
  };
}
