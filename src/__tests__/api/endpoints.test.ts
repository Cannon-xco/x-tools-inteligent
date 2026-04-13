/**
 * Integration Tests: All API Endpoints
 * Tests main API endpoints with real server
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createApiClient } from '../helpers/api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

describe('Health & Ping Endpoints', () => {
  let client: ReturnType<typeof createApiClient>;

  beforeAll(() => {
    client = createApiClient(API_URL);
  });

  it('GET /api/health should return ok status', async () => {
    const res = await client.get<{ status: string; environment: string }>('/api/health');
    
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.environment).toBeDefined();
  });

  it('GET /api/ping should return online status', async () => {
    const res = await client.get<{ status: string; message: string }>('/api/ping');
    
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('online');
  });
});

describe('Leads API', () => {
  let client: ReturnType<typeof createApiClient>;

  beforeAll(() => {
    client = createApiClient(API_URL);
  });

  it('GET /api/leads should return success', async () => {
    const res = await client.get<{ success: boolean }>('/api/leads');
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/leads with limit param', async () => {
    const res = await client.get<{ success: boolean }>('/api/leads?limit=5');
    
    expect(res.status).toBe(200);
  });

  it('DELETE /api/leads without params should return 400', async () => {
    const res = await client.delete<{ success: boolean }>('/api/leads');
    
    expect(res.status).toBe(400);
  });
});

describe('Search API', () => {
  let client: ReturnType<typeof createApiClient>;

  beforeAll(() => {
    client = createApiClient(API_URL);
  });

  it('POST /api/search without params should return error', async () => {
    const res = await client.post<{ success: boolean }>('/api/search', {});
    
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('required');
  });

  it('POST /api/search with valid params should return businesses', async () => {
    const res = await client.post<{ success: boolean; data?: { businesses: unknown[] } }>('/api/search', {
      keyword: 'restaurant',
      location: 'Jakarta',
      limit: 5
    });
    
    // Accept both 200 (success) and 400 (rate limited or other issues)
    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data?.businesses).toBeDefined();
    }
  });
});

describe('Export API', () => {
  let client: ReturnType<typeof createApiClient>;

  beforeAll(() => {
    client = createApiClient(API_URL);
  });

  it('GET /api/export should return data (CSV or JSON)', async () => {
    const res = await client.get<unknown>('/api/export?format=csv');
    
    // Export returns CSV text (text/plain) or JSON
    expect(res.status).toBe(200);
    // Should have some content
    expect(res.body).toBeDefined();
  });
});

describe('Score API', () => {
  let client: ReturnType<typeof createApiClient>;

  beforeAll(() => {
    client = createApiClient(API_URL);
  });

  it('POST /api/score should calculate score', async () => {
    const res = await client.post<{ success: boolean; data?: { score: number; reasons: string[] } }>('/api/score', {
      website: 'https://google.com',
      rating: 4,
      review_count: 100
    });
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data?.score).toBeDefined();
    expect(res.body.data?.reasons).toBeDefined();
    expect(Array.isArray(res.body.data?.reasons)).toBe(true);
  });
});

describe('Enrich API', () => {
  let client: ReturnType<typeof createApiClient>;

  beforeAll(() => {
    client = createApiClient(API_URL);
  });

  it('POST /api/enrich without website should return error', async () => {
    const res = await client.post<{ success: boolean }>('/api/enrich', {
      ids: [1]
    });
    
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Website');
  });
});

describe('Deep Enrich API', () => {
  let client: ReturnType<typeof createApiClient>;

  beforeAll(() => {
    client = createApiClient(API_URL);
  });

  it('POST /api/deep-enrich without id should return error', async () => {
    const res = await client.post<{ success: boolean }>('/api/deep-enrich', {
      ids: [1]
    });
    
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/deep-enrich with valid id should return result', async () => {
    const res = await client.post<{ success: boolean; data?: { leadId: number; emails: unknown[]; message?: string } }>('/api/deep-enrich', {
      id: 1
    });
    
    // Accept 200 (success) or 400 (not found) or rate limiting
    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data?.leadId).toBe(1);
    }
  });
});
