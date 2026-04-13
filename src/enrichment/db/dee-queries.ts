// ============================================================
// DEE DATABASE QUERIES
// Deep Enrichment Engine (DEE) - Query Helpers
// CRUD operations for deep enrichment data
// ============================================================

import { getPool } from '@/lib/db/client';

/**
 * Represents a deep enrichment data row from the leads table
 */
export interface DeepEnrichmentRow {
  lead_id: number;
  verified_emails: Array<{
    value: string;
    original: string;
    source: string;
    confidence: number;
  }> | null;
  verified_phones: Array<{
    value: string;
    original: string;
    source: string;
    confidence: number;
  }> | null;
  verified_socials: {
    linkedin?: string;
    instagram?: string;
    facebook?: string;
    twitter?: string;
    tiktok?: string;
    youtube?: string;
  } | null;
  confidence_scores: Record<string, number> | null;
  deep_enriched_at: string | null;
  enrichment_status: 'processing' | 'completed' | 'failed' | 'limit_reached' | null;
}

/**
 * Represents an audit trail entry
 */
export interface AuditEntry {
  id: number;
  lead_id: number;
  field_name: string;
  value: string;
  source: string;
  confidence: number;
  status: 'pending' | 'verified' | 'low_confidence' | 'discarded';
  raw_snippet: string | null;
  created_at: string;
}

/**
 * Input data for saving deep enrichment results
 */
export interface DeepEnrichmentData {
  verified_emails: Array<{
    value: string;
    original: string;
    source: string;
    confidence: number;
  }>;
  verified_phones: Array<{
    value: string;
    original: string;
    source: string;
    confidence: number;
  }>;
  verified_socials: {
    linkedin?: string;
    instagram?: string;
    facebook?: string;
    twitter?: string;
    tiktok?: string;
    youtube?: string;
  };
  confidence_scores: Record<string, number>;
}

/**
 * Input data for creating an audit entry
 */
export interface AuditEntryInput {
  lead_id: number;
  field_name: string;
  value: string;
  source: string;
  confidence: number;
  status: 'pending' | 'verified' | 'low_confidence' | 'discarded';
  raw_snippet?: string;
}

/**
 * Save deep enrichment results to leads table
 * @param leadId - The lead ID to update
 * @param data - Deep enrichment data to save
 */
export async function saveDeepEnrichment(
  leadId: number,
  data: DeepEnrichmentData
): Promise<void> {
  const pool = getPool();

  const query = `
    UPDATE leads
    SET 
      verified_emails = $1,
      verified_phones = $2,
      verified_socials = $3,
      confidence_scores = $4,
      deep_enriched_at = CURRENT_TIMESTAMP,
      enrichment_status = 'completed',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $5
  `;

  const values = [
    JSON.stringify(data.verified_emails),
    JSON.stringify(data.verified_phones),
    JSON.stringify(data.verified_socials),
    JSON.stringify(data.confidence_scores),
    leadId,
  ];

  await pool.query(query, values);
}

/**
 * Update enrichment status for a lead.
 * Used by the worker and route to track pipeline state.
 *
 * @param leadId - The lead ID to update
 * @param status - New enrichment status
 */
export async function updateEnrichmentStatus(
  leadId: number,
  status: 'processing' | 'completed' | 'failed' | 'limit_reached'
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE leads SET enrichment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [status, leadId]
  );
}

/**
 * Insert audit trail entry
 * @param entry - Audit entry data
 * @returns The ID of the created audit entry
 */
export async function insertAuditEntry(entry: AuditEntryInput): Promise<number> {
  const pool = getPool();

  const query = `
    INSERT INTO enrichment_audit (
      lead_id, field_name, value, source, confidence, status, raw_snippet
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `;

  const values = [
    entry.lead_id,
    entry.field_name,
    entry.value,
    entry.source,
    entry.confidence,
    entry.status,
    entry.raw_snippet || null,
  ];

  const result = await pool.query(query, values);
  return result.rows[0].id;
}

/**
 * Get audit trail for a specific lead
 * @param leadId - The lead ID to query
 * @returns Array of audit entries sorted by created_at descending
 */
export async function getAuditByLeadId(leadId: number): Promise<AuditEntry[]> {
  const pool = getPool();

  const query = `
    SELECT 
      id,
      lead_id,
      field_name,
      value,
      source,
      confidence,
      status,
      raw_snippet,
      created_at
    FROM enrichment_audit
    WHERE lead_id = $1
    ORDER BY created_at DESC
  `;

  const result = await pool.query(query, [leadId]);

  return result.rows.map((row: {
    id: number;
    lead_id: number;
    field_name: string;
    value: string;
    source: string;
    confidence: number;
    status: string;
    raw_snippet: string | null;
    created_at: string;
  }) => ({
    id: row.id,
    lead_id: row.lead_id,
    field_name: row.field_name,
    value: row.value,
    source: row.source,
    confidence: row.confidence,
    status: row.status as AuditEntry['status'],
    raw_snippet: row.raw_snippet,
    created_at: row.created_at,
  }));
}

/**
 * Get deep enrichment data for a lead
 * @param leadId - The lead ID to query
 * @returns Deep enrichment data or null if not found/not enriched
 */
export async function getDeepEnrichment(
  leadId: number
): Promise<DeepEnrichmentRow | null> {
  const pool = getPool();

  const query = `
    SELECT 
      id as lead_id,
      verified_emails,
      verified_phones,
      verified_socials,
      confidence_scores,
      deep_enriched_at,
      enrichment_status
    FROM leads
    WHERE id = $1
  `;

  const result = await pool.query(query, [leadId]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  return {
    lead_id: row.lead_id,
    verified_emails: row.verified_emails ? JSON.parse(row.verified_emails) : null,
    verified_phones: row.verified_phones ? JSON.parse(row.verified_phones) : null,
    verified_socials: row.verified_socials ? JSON.parse(row.verified_socials) : null,
    confidence_scores: row.confidence_scores ? JSON.parse(row.confidence_scores) : null,
    deep_enriched_at: row.deep_enriched_at,
    enrichment_status: (row.enrichment_status ?? null) as DeepEnrichmentRow['enrichment_status'],
  };
}

/**
 * Get all leads that have been deep enriched
 * @param limit - Maximum number of results
 * @param offset - Pagination offset
 * @returns Array of deep enrichment data
 */
export async function getAllDeepEnriched(
  limit: number = 100,
  offset: number = 0
): Promise<DeepEnrichmentRow[]> {
  const pool = getPool();

  const query = `
    SELECT 
      id as lead_id,
      verified_emails,
      verified_phones,
      verified_socials,
      confidence_scores,
      deep_enriched_at,
      enrichment_status
    FROM leads
    WHERE deep_enriched_at IS NOT NULL
    ORDER BY deep_enriched_at DESC
    LIMIT $1 OFFSET $2
  `;

  const result = await pool.query(query, [limit, offset]);

  return result.rows.map((row: {
    lead_id: number;
    verified_emails: string | null;
    verified_phones: string | null;
    verified_socials: string | null;
    confidence_scores: string | null;
    deep_enriched_at: string | null;
    enrichment_status: string | null;
  }) => ({
    lead_id: row.lead_id,
    verified_emails: row.verified_emails ? JSON.parse(row.verified_emails) : null,
    verified_phones: row.verified_phones ? JSON.parse(row.verified_phones) : null,
    verified_socials: row.verified_socials ? JSON.parse(row.verified_socials) : null,
    confidence_scores: row.confidence_scores ? JSON.parse(row.confidence_scores) : null,
    deep_enriched_at: row.deep_enriched_at,
    enrichment_status: (row.enrichment_status ?? null) as DeepEnrichmentRow['enrichment_status'],
  }));
}

/**
 * Update audit entry status
 * @param auditId - The audit entry ID to update
 * @param status - New status value
 */
export async function updateAuditStatus(
  auditId: number,
  status: 'pending' | 'verified' | 'low_confidence' | 'discarded'
): Promise<void> {
  const pool = getPool();

  const query = `
    UPDATE enrichment_audit
    SET status = $1
    WHERE id = $2
  `;

  await pool.query(query, [status, auditId]);
}

/**
 * Delete all audit entries for a lead
 * @param leadId - The lead ID to delete audit entries for
 */
export async function deleteAuditByLeadId(leadId: number): Promise<void> {
  const pool = getPool();

  const query = `
    DELETE FROM enrichment_audit
    WHERE lead_id = $1
  `;

  await pool.query(query, [leadId]);
}

/**
 * Get audit statistics for a lead
 * @param leadId - The lead ID to query
 * @returns Statistics about audit entries
 */
export async function getAuditStats(leadId: number): Promise<{
  total: number;
  verified: number;
  lowConfidence: number;
  discarded: number;
  pending: number;
}> {
  const pool = getPool();

  const query = `
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'verified') as verified,
      COUNT(*) FILTER (WHERE status = 'low_confidence') as low_confidence,
      COUNT(*) FILTER (WHERE status = 'discarded') as discarded,
      COUNT(*) FILTER (WHERE status = 'pending') as pending
    FROM enrichment_audit
    WHERE lead_id = $1
  `;

  const result = await pool.query(query, [leadId]);
  const row = result.rows[0];

  return {
    total: parseInt(row.total, 10),
    verified: parseInt(row.verified, 10),
    lowConfidence: parseInt(row.low_confidence, 10),
    discarded: parseInt(row.discarded, 10),
    pending: parseInt(row.pending, 10),
  };
}
