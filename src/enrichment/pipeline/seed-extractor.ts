// ============================================================
// SEED EXTRACTION MODULE
// Deep Enrichment Engine (DEE) - Data Processing Layer
// Normalizes raw lead data into clean seed format
// ============================================================

/**
 * Represents a normalized seed data ready for enrichment pipeline
 */
export interface SeedData {
  /** Original business name as provided */
  original_name: string;
  /** Normalized name for fuzzy matching (ASCII, lowercase, no special chars) */
  normalized_name: string;
  /** Display-ready name (proper case, trimmed) */
  display_name: string;
  /** Normalized address (lowercase, abbreviations expanded) */
  address: string;
  /** Extracted city from address */
  city: string;
  /** Extracted domain from website URL */
  domain?: string;
  /** Normalized phone in E.164 format */
  phone?: string;
  /** Business niche/category */
  niche?: string;
}

/**
 * Input data for seed extraction
 */
export interface SeedInput {
  /** Business name */
  name: string;
  /** Business address */
  address: string;
  /** Phone number (optional) */
  phone?: string;
  /** Website URL (optional) */
  website?: string;
  /** Business niche (optional) */
  niche?: string;
}

// Business suffixes to remove during normalization
const BUSINESS_SUFFIXES = [
  'llc', 'inc', 'ltd', 'limited', 'corp', 'corporation',
  'pt', 'cv', 'tbk', 'plc', 'gmbh', 'bv', 'nv', 'sa', 'srl',
];

// Address abbreviation mappings
const ADDRESS_ABBREVIATIONS: Record<string, string> = {
  'st.': 'street',
  'st': 'street',
  'ave.': 'avenue',
  'ave': 'avenue',
  'jl.': 'jalan',
  'jl': 'jalan',
  'jln.': 'jalan',
  'jln': 'jalan',
  'rd.': 'road',
  'rd': 'road',
  'blvd.': 'boulevard',
  'blvd': 'boulevard',
  'dr.': 'drive',
  'dr': 'drive',
  'ln.': 'lane',
  'ln': 'lane',
  'ct.': 'court',
  'ct': 'court',
  'pl.': 'place',
  'pl': 'place',
  'wy.': 'way',
  'wy': 'way',
  'cir.': 'circle',
  'cir': 'circle',
  'apt.': 'apartment',
  'apt': 'apartment',
  'ste.': 'suite',
  'ste': 'suite',
  'bldg.': 'building',
  'bldg': 'building',
  'fl.': 'floor',
  'fl': 'floor',
  'no.': 'number',
  'no': 'number',
};

/**
 * Remove diacritics and convert to ASCII for fuzzy matching
 * @param str - Input string
 * @returns ASCII-normalized string
 */
function toAscii(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u00c0-\u00ff]/gi, (c) => {
      const asciiMap: Record<string, string> = {
        'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a',
        'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
        'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
        'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o', 'ø': 'o',
        'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
        'ñ': 'n', 'ç': 'c',
        'À': 'A', 'Á': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'A', 'Å': 'A',
        'È': 'E', 'É': 'E', 'Ê': 'E', 'Ë': 'E',
        'Ì': 'I', 'Í': 'I', 'Î': 'I', 'Ï': 'I',
        'Ò': 'O', 'Ó': 'O', 'Ô': 'O', 'Õ': 'O', 'Ö': 'O', 'Ø': 'O',
        'Ù': 'U', 'Ú': 'U', 'Û': 'U', 'Ü': 'U',
        'Ñ': 'N', 'Ç': 'C',
      };
      return asciiMap[c] || c;
    });
}

/**
 * Convert string to proper case (capitalize first letter of each word)
 * @param str - Input string
 * @returns Proper case string
 */
function toProperCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Normalize business name for matching and display
 * @param name - Raw business name
 * @returns Object containing normalized_name and display_name
 */
function normalizeName(name: string): { normalized_name: string; display_name: string } {
  // Trim and preserve original for display
  const trimmed = name.trim();
  
  // Lowercase for processing
  let lower = trimmed.toLowerCase();
  
  // Remove special characters except & - ' (which are valid in business names)
  lower = lower.replace(/[^a-z0-9&\-'\s]/g, ' ');
  
  // Collapse multiple spaces
  lower = lower.replace(/\s+/g, ' ').trim();
  
  // Remove business suffixes (with optional periods and surrounding spaces)
  for (const suffix of BUSINESS_SUFFIXES) {
    const suffixPattern = new RegExp(`\\b${suffix}\\.?\\s*$`, 'i');
    lower = lower.replace(suffixPattern, '').trim();
    // Also handle cases with comma before suffix
    const suffixWithComma = new RegExp(`,?\\s*${suffix}\\.?\\s*$`, 'i');
    lower = lower.replace(suffixWithComma, '').trim();
  }
  
  // Handle "PT." prefix specifically (common in Indonesia)
  lower = lower.replace(/^pt\.?\s+/i, '').trim();
  lower = lower.replace(/^cv\.?\s+/i, '').trim();
  
  // Generate normalized_name (ASCII only for fuzzy matching)
  const normalized_name = toAscii(lower)
    .replace(/[^a-z0-9&\-'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Generate display_name (proper case, preserve valid characters)
  const display_name = toProperCase(lower);
  
  return { normalized_name, display_name };
}

/**
 * Normalize address and extract city
 * @param address - Raw address string
 * @returns Object containing normalized address and extracted city
 */
function normalizeAddress(address: string): { address: string; city: string } {
  // Trim
  let normalized = address.trim();
  
  // Lowercase
  normalized = normalized.toLowerCase();
  
  // Normalize abbreviations
  const words = normalized.split(/\s+/);
  const expandedWords = words.map(word => {
    // Remove trailing punctuation for lookup
    const cleanWord = word.replace(/[^a-z0-9]/g, '');
    const punctuation = word.replace(/[a-z0-9]/g, '');
    const expanded = ADDRESS_ABBREVIATIONS[cleanWord + punctuation] || 
                     ADDRESS_ABBREVIATIONS[cleanWord] || 
                     word;
    return expanded;
  });
  
  normalized = expandedWords.join(' ');
  
  // Extract city (text after last comma, or last part if no comma)
  let city = '';
  const lastCommaIndex = normalized.lastIndexOf(',');
  if (lastCommaIndex !== -1) {
    city = normalized.slice(lastCommaIndex + 1).trim();
    // Remove common prefixes from city
    city = city.replace(/^(kota|city|kab\.?|kabupaten|kec\.?|kecamatan)\s+/i, '').trim();
  } else {
    // If no comma, take last 2-3 words as city
    const parts = normalized.split(/\s+/);
    if (parts.length >= 3) {
      city = parts.slice(-2).join(' ');
    } else if (parts.length >= 1) {
      city = parts[parts.length - 1];
    }
  }
  
  // Clean up city name
  city = city.replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  city = toProperCase(city);
  
  return { address: normalized, city };
}

/**
 * Extract domain from website URL
 * @param website - Website URL
 * @returns Extracted domain or undefined
 */
function extractDomain(website: string): string | undefined {
  if (!website || website.trim() === '') {
    return undefined;
  }
  
  try {
    // Ensure URL has protocol
    let urlStr = website.trim();
    if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
      urlStr = 'https://' + urlStr;
    }
    
    const url = new URL(urlStr);
    let domain = url.hostname.toLowerCase();
    
    // Remove www. prefix
    domain = domain.replace(/^www\./, '');
    
    return domain || undefined;
  } catch {
    // If URL parsing fails, try manual extraction
    const match = website.match(/^(?:https?:\/\/)?(?:www\.)?([^\/\s]+)/i);
    if (match) {
      return match[1].toLowerCase();
    }
    return undefined;
  }
}

/**
 * Normalize phone number to E.164 format
 * @param phone - Raw phone number
 * @returns Normalized phone or undefined
 */
function normalizePhone(phone: string): string | undefined {
  if (!phone || phone.trim() === '') {
    return undefined;
  }
  
  // Remove all non-digit characters except +
  let normalized = phone.replace(/[^\d+]/g, '');
  
  // Remove duplicate + signs
  if (normalized.includes('+')) {
    normalized = '+' + normalized.replace(/\+/g, '');
  }
  
  // Handle country code detection for Indonesian numbers
  if (!normalized.startsWith('+')) {
    if (normalized.startsWith('0')) {
      // Convert 08xxx to +628xxx
      normalized = '+62' + normalized.slice(1);
    } else if (normalized.startsWith('62')) {
      // Add + if missing
      normalized = '+' + normalized;
    } else {
      // Assume other numbers are already in correct format or unknown
      // Try to detect by length
      if (normalized.length >= 10 && normalized.length <= 12) {
        // Might be international, add +
        normalized = '+' + normalized;
      }
    }
  }
  
  // Validate length (E.164: max 15 digits including country code)
  const digitsOnly = normalized.replace(/\+/g, '');
  if (digitsOnly.length < 8 || digitsOnly.length > 15) {
    return undefined;
  }
  
  return normalized;
}

/**
 * Normalize raw lead data menjadi clean seed untuk enrichment pipeline
 * @param input - Raw lead data
 * @returns Normalized SeedData
 */
export function extractSeed(input: SeedInput): SeedData {
  const { normalized_name, display_name } = normalizeName(input.name);
  const { address, city } = normalizeAddress(input.address);
  const domain = input.website ? extractDomain(input.website) : undefined;
  const phone = input.phone ? normalizePhone(input.phone) : undefined;
  
  return {
    original_name: input.name.trim(),
    normalized_name,
    display_name,
    address,
    city,
    domain,
    phone,
    niche: input.niche?.trim() || undefined,
  };
}
