/**
 * WHOIS Adapter — Deep Enrichment Engine (DEE)
 *
 * Performs WHOIS / RDAP domain lookups to extract registrant information,
 * registration/expiry dates, name servers, and registrar details.
 *
 * Uses the RDAP (Registration Data Access Protocol) standard endpoint at
 * https://rdap.org — no API key required, public and rate-limited.
 *
 * Results are cached in memory for 24 hours to avoid hammering the API.
 *
 * @module enrichment/sources/whois-adapter
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** Registrant contact information extracted from WHOIS/RDAP. */
export interface WhoisRegistrant {
  /** Registrant full name (may be hidden by privacy protection). */
  name?: string;
  /** Registrant email address (may be redacted). */
  email?: string;
  /** Registrant organization name. */
  organization?: string;
}

/** Result of a WHOIS lookup for a domain. */
export interface WhoisResult {
  /** The domain that was looked up (normalized, no www/path). */
  domain: string;
  /** Whether the domain appears to be registered. */
  is_registered: boolean;
  /** Whether WHOIS privacy protection hides the registrant. */
  is_private: boolean;
  /** Registrant contact info (undefined when private or unavailable). */
  registrant?: WhoisRegistrant;
  /** Domain registration date (ISO 8601). */
  registration_date?: string;
  /** Domain expiry date (ISO 8601). */
  expiry_date?: string;
  /** Registrar company name. */
  registrar?: string;
  /** Authoritative name servers for the domain. */
  name_servers: string[];
  /** How many days the domain has been registered (calculated from registration_date). */
  domain_age_days?: number;
  /** Raw RDAP JSON response (stringified). Useful for debugging. */
  raw_data?: string;
  /** Wall-clock time for the lookup in ms. */
  duration_ms: number;
  /**
   * Confidence that the extracted data is genuine:
   * - 0.8  — full data, no privacy protection
   * - 0.5  — partial data
   * - 0.2  — privacy protection detected
   * - 0.0  — lookup failed
   */
  confidence: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WHOIS_TIMEOUT = 10_000;
const CACHE_TTL = 24 * 60 * 60 * 1_000; // 24 hours

/**
 * Strings that indicate WHOIS privacy protection is active.
 * Checked case-insensitively against registrant fields.
 */
const PRIVACY_MARKERS: string[] = [
  'REDACTED',
  'Privacy',
  'WhoisGuard',
  'Domains By Proxy',
  'withheld for privacy',
  'Data Protected',
  'Contact Privacy',
  'Perfect Privacy',
];

// ── In-memory cache ───────────────────────────────────────────────────────────

/** Cache entry shape. */
interface CacheEntry {
  result: WhoisResult;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

// ── RDAP helpers ──────────────────────────────────────────────────────────────

/**
 * Return a minimal "failed" WhoisResult for when the lookup cannot complete.
 *
 * @param domain      - Domain that was queried.
 * @param duration_ms - Time elapsed before the failure.
 */
function minimalResult(domain: string, duration_ms: number): WhoisResult {
  return {
    domain,
    is_registered: false,
    is_private: false,
    name_servers: [],
    duration_ms,
    confidence: 0.0,
  };
}

/**
 * Detect if any value in a set of strings contains a privacy-protection marker.
 *
 * @param values - Strings to check (name, email, org, etc.).
 */
function hasPrivacyMarker(values: (string | undefined)[]): boolean {
  const combined = values.filter(Boolean).join(' ');
  return PRIVACY_MARKERS.some((marker) =>
    combined.toLowerCase().includes(marker.toLowerCase()),
  );
}

/**
 * Parse a raw RDAP JSON response into a structured `WhoisResult`.
 *
 * RDAP spec: https://tools.ietf.org/html/rfc7483
 *
 * @param data        - Parsed JSON from the RDAP endpoint.
 * @param domain      - The queried domain name.
 * @param duration_ms - Time elapsed for the request.
 */
function parseRdapResponse(
  data: unknown,
  domain: string,
  duration_ms: number,
): WhoisResult {
  if (!data || typeof data !== 'object') return minimalResult(domain, duration_ms);

  const rdap = data as Record<string, unknown>;

  // ── 1. Events → registration / expiry dates ──────────────────────────────

  let registrationDate: string | undefined;
  let expiryDate: string | undefined;
  const events = Array.isArray(rdap['events'])
    ? (rdap['events'] as Array<Record<string, string>>)
    : [];

  for (const ev of events) {
    if (ev['eventAction'] === 'registration') registrationDate = ev['eventDate'];
    if (ev['eventAction'] === 'expiration') expiryDate = ev['eventDate'];
  }

  // ── 2. Domain age ────────────────────────────────────────────────────────

  let domainAgeDays: number | undefined;
  if (registrationDate) {
    const regMs = Date.parse(registrationDate);
    if (!isNaN(regMs)) {
      domainAgeDays = Math.floor((Date.now() - regMs) / (1_000 * 60 * 60 * 24));
    }
  }

  // ── 3. Entities → registrant + registrar ────────────────────────────────

  const entities = Array.isArray(rdap['entities'])
    ? (rdap['entities'] as Array<Record<string, unknown>>)
    : [];

  let registrant: WhoisRegistrant | undefined;
  let registrar: string | undefined;
  let isPrivate = false;

  for (const entity of entities) {
    const roles = Array.isArray(entity['roles']) ? entity['roles'] : [];

    // Registrar
    if (roles.includes('registrar')) {
      const fn = entity['fn'];
      if (typeof fn === 'string') registrar = fn;
    }

    // Registrant — extract via vCard 4.0 array
    if (roles.includes('registrant')) {
      const vcardArray = entity['vcardArray'];
      if (Array.isArray(vcardArray) && Array.isArray(vcardArray[1])) {
        const vcard = vcardArray[1] as Array<[string, unknown, string, unknown]>;

        let rName: string | undefined;
        let rEmail: string | undefined;
        let rOrg: string | undefined;

        for (const field of vcard) {
          if (!Array.isArray(field) || field.length < 4) continue;
          const type = field[0];
          const value = field[3];
          if (type === 'fn' && typeof value === 'string') rName = value;
          if (type === 'email' && typeof value === 'string') rEmail = value;
          if (type === 'org' && typeof value === 'string') rOrg = value;
        }

        isPrivate = hasPrivacyMarker([rName, rEmail, rOrg]);
        if (!isPrivate) {
          registrant = { name: rName, email: rEmail, organization: rOrg };
        }
      }
    }
  }

  // ── 4. Name servers ──────────────────────────────────────────────────────

  const nsArr = Array.isArray(rdap['nameservers'])
    ? (rdap['nameservers'] as Array<Record<string, string>>)
    : [];

  const name_servers = nsArr
    .map((ns) => (ns['ldhName'] ?? '').toLowerCase())
    .filter((ns) => ns.length > 0);

  // ── 5. Confidence score ──────────────────────────────────────────────────

  let confidence: number;
  if (isPrivate) {
    confidence = 0.2;
  } else if (registrant?.email ?? registrant?.name) {
    confidence = 0.8;
  } else if (registrationDate) {
    confidence = 0.5;
  } else {
    confidence = 0.0;
  }

  return {
    domain,
    is_registered: true,
    is_private: isPrivate,
    registrant,
    registration_date: registrationDate,
    expiry_date: expiryDate,
    registrar,
    name_servers,
    domain_age_days: domainAgeDays,
    raw_data: JSON.stringify(data),
    duration_ms,
    confidence,
  };
}

// ── Fetch with retry ──────────────────────────────────────────────────────────

/**
 * Fetch RDAP data for a domain from rdap.org.
 * Handles rate-limiting (HTTP 429) with a single 5-second retry.
 *
 * @param domain     - Normalized domain to query.
 * @param controller - AbortController used for timeout.
 */
async function fetchRdap(
  domain: string,
  controller: AbortController,
): Promise<Response | null> {
  const url = `https://rdap.org/domain/${encodeURIComponent(domain)}`;

  let res = await fetch(url, { signal: controller.signal });

  if (res.status === 429) {
    // Rate limited — wait 5 s and retry once
    await new Promise<void>((resolve) => setTimeout(resolve, 5_000));
    res = await fetch(url, { signal: controller.signal });
  }

  return res.ok ? res : null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Perform WHOIS lookup untuk sebuah domain.
 * Uses free public RDAP API — rate limited.
 * Results cached for 24 hours.
 *
 * The domain is normalized before lookup (scheme and www stripped, lowercased).
 * On any error the function returns a minimal result instead of throwing.
 *
 * @param domain - Raw domain string (can include https://, www., paths).
 * @returns `WhoisResult` with registrant info, dates, name servers, and confidence.
 */
export async function lookupWhois(domain: string): Promise<WhoisResult> {
  // Normalize: strip scheme, www, and path
  const normalized = domain
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    .split('?')[0];

  // Cache hit
  const cached = cache.get(normalized);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WHOIS_TIMEOUT);
  const start = Date.now();

  try {
    const res = await fetchRdap(normalized, controller);

    if (!res) {
      const result = minimalResult(normalized, Date.now() - start);
      cache.set(normalized, { result, timestamp: Date.now() });
      return result;
    }

    const json: unknown = await res.json();
    const result = parseRdapResponse(json, normalized, Date.now() - start);
    cache.set(normalized, { result, timestamp: Date.now() });
    return result;
  } catch {
    const result = minimalResult(normalized, Date.now() - start);
    cache.set(normalized, { result, timestamp: Date.now() });
    return result;
  } finally {
    clearTimeout(timer);
  }
}
