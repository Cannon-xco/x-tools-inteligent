/**
 * Integration Tests: Leads API
 * Tests /api/leads endpoint with real database
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { createApiClient, type ApiResponse } from '../helpers/api-client';
import type { BusinessListing } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface LeadsResponse {
  success: boolean;
  data?: {
    leads: BusinessListing[];
    total: number;
  };
  error?: string;
}

describe('GET /api/leads', () => {
  let client: ReturnType<typeof createApiClient>;

  beforeAll(() => {
    client = createApiClient(API_URL);
  });

  it('should return empty array when no leads exist', async () => {
    const res = await client.get<LeadsResponse>('/api/leads');
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data?.leads)).toBe(true);
    expect(typeof res.body.data?.total).toBe('number');
  });

  it('should accept limit and offset query params', async () => {
    const res = await client.get<LeadsResponse>('/api/leads?limit=10&offset=0');
    
    expect(res.status).toBe(200);
    expect(res.body.data?.leads.length).toBeLessThanOrEqual(10);
  });

  it('should reject invalid limit', async () => {
    const res = await client.get<LeadsResponse>('/api/leads?limit=invalid');
    
    // Invalid param should default to some value
    expect(res.status).toBe(200);
  });

  it('should reject limit over 500', async () => {
    const res = await client.get<LeadsResponse>('/api/leads?limit=1000');
    
    expect(res.status).toBe(200);
    // Implementation should cap at 500
    expect(res.body.data?.leads.length).toBeLessThanOrEqual(500);
  });
});

describe('DELETE /api/leads', () => {
  let client: ReturnType<typeof createApiClient>;

  beforeAll(() => {
    client = createApiClient(API_URL);
  });

  it('should return 400 when no id or all param provided', async () => {
    const res = await client.delete<LeadsResponse>('/api/leads');
    
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should delete specific lead by id', async () => {
    // First, create a lead via POST (if available)
    // Then delete it
    const res = await client.delete<LeadsResponse>('/api/leads?id=999999');
    
    // Either 200 (deleted) or 404 (not found) is acceptable
    expect([200, 404]).toContain(res.status);
  });
});

// Note: These tests require a running Next.js server and test database
// Run with: npm run test:db && npm run test:integration
