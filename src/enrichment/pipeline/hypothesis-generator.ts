/**
 * @fileoverview Hypothesis Generation Module for Deep Enrichment Engine (DEE)
 * Generates smart search queries to discover business information from various sources.
 *
 * @module src/enrichment/pipeline/hypothesis-generator
 */

/**
 * Represents a single search hypothesis with priority and rationale.
 */
export interface SearchHypothesis {
  /** The search query string */
  query: string;
  /** Priority score 1-5, higher = better chance of results */
  priority: number;
  /** Target type for this query */
  target: 'general' | 'email' | 'social' | 'website' | 'phone';
  /** Explanation of why this query was selected */
  rationale: string;
}

/**
 * Input parameters for generating search hypotheses.
 */
export interface GenerateHypothesesInput {
  /** Business name (original) */
  name: string;
  /** Normalized business name (cleaned) */
  normalized_name: string;
  /** City where business is located */
  city: string;
  /** Optional domain if known */
  domain?: string;
  /** Optional business niche/category */
  niche?: string;
  /** Optional phone number if known */
  phone?: string;
}

/**
 * Generates a short variant of a business name for queries.
 * Takes first and last word if name has more than 3 words.
 *
 * @param name - The business name to shorten
 * @returns Shortened name or original if already short
 */
function generateShortVariant(name: string): string | null {
  const words = name.trim().split(/\s+/);
  if (words.length <= 3) {
    return null;
  }
  // Take first and last word for short variant
  return `"${words[0]} ${words[words.length - 1]}"`;
}

/**
 * Creates a base query with name and city.
 *
 * @param name - Business name to use
 * @param city - City to include
 * @returns Formatted query string
 */
function createBaseQuery(name: string, city: string): string {
  return `"${name}" ${city}`;
}

/**
 * Generates smart search queries to discover business information.
 * Returns queries sorted by priority (highest first), max 7 queries.
 *
 * @param input - Business information for query generation
 * @returns Array of search hypotheses sorted by priority descending
 */
export function generateHypotheses(input: GenerateHypothesesInput): SearchHypothesis[] {
  const { name, normalized_name, city, domain, niche } = input;
  const hypotheses: SearchHypothesis[] = [];

  // Use normalized name for consistency
  const businessName = normalized_name || name;

  // 1. General contact query (highest priority)
  hypotheses.push({
    query: `${createBaseQuery(businessName, city)} contact email`,
    priority: 5,
    target: 'general',
    rationale: 'Full name + city + contact keywords for maximum coverage',
  });

  // 2. Email specific query
  hypotheses.push({
    query: `"${businessName}" email`,
    priority: 4,
    target: 'email',
    rationale: 'Direct email address search',
  });

  // 3. Instagram discovery
  hypotheses.push({
    query: `site:instagram.com "${businessName}"`,
    priority: 4,
    target: 'social',
    rationale: 'Instagram discovery for social presence',
  });

  // 4. Niche-specific query if niche provided
  if (niche) {
    hypotheses.push({
      query: `"${businessName}" ${niche} ${city} phone email`,
      priority: 4,
      target: 'general',
      rationale: 'Name + niche + city for targeted search',
    });
  }

  // 5. LinkedIn company page
  hypotheses.push({
    query: `site:linkedin.com/company "${businessName}"`,
    priority: 3,
    target: 'social',
    rationale: 'LinkedIn company page search',
  });

  // 6. Domain-specific queries if domain provided
  if (domain) {
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    hypotheses.push({
      query: `${cleanDomain} contact`,
      priority: 3,
      target: 'website',
      rationale: 'Domain contact page search',
    });
    hypotheses.push({
      query: `${cleanDomain} about`,
      priority: 3,
      target: 'website',
      rationale: 'Domain about page for contact info',
    });
  }

  // 7. Short name variant if name is long (> 3 words)
  const shortVariant = generateShortVariant(businessName);
  if (shortVariant) {
    hypotheses.push({
      query: `${shortVariant} ${city} contact`,
      priority: 3,
      target: 'general',
      rationale: 'Short name variant for broader matches',
    });
  }

  // 8. Phone-specific query (lower priority as phone often already known)
  hypotheses.push({
    query: `${createBaseQuery(businessName, city)} phone`,
    priority: 2,
    target: 'phone',
      rationale: 'Phone number search',
  });

  // Sort by priority descending (highest first)
  hypotheses.sort((a, b) => b.priority - a.priority);

  // Limit to max 7 queries to respect rate limits
  return hypotheses.slice(0, 7);
}
