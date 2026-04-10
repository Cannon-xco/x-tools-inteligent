/**
 * @fileoverview Test suite for Fallback Strategy Module
 *
 * @module src/enrichment/__tests__/fallback-strategy.test
 */

import {
  executeWithFallback,
  executePipeline,
  executeStandardPipeline,
  shouldSkipSource,
  getExecutionSummary,
  STAGE_DEFINITIONS,
  SourceExecution,
  PipelineExecution,
} from '../pipeline/fallback-strategy';

describe('Fallback Strategy', () => {
  /**
   * Test Case 1: Source berhasil pertama kali
   */
  describe('executeWithFallback', () => {
    it('should succeed on first attempt', async () => {
      const mockFn = jest.fn().mockResolvedValue({ data: 'success' });

      const result = await executeWithFallback('test-source', mockFn);

      expect(result.source).toBe('test-source');
      expect(result.status).toBe('success');
      expect(result.attempts).toBe(1);
      expect(result.result).toEqual({ data: 'success' });
      expect(result.duration_ms).toBeGreaterThanOrEqual(0);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    /**
     * Test Case 2: Source berhasil setelah retry ke-2
     */
    it('should succeed after retry', async () => {
      // Fail first 2 times, succeed on 3rd
      let callCount = 0;
      const mockFn = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          return Promise.reject(new Error('Temporary error'));
        }
        return Promise.resolve({ data: 'recovered' });
      });

      const result = await executeWithFallback('retry-source', mockFn, {
        maxRetries: 2,
        backoffMultiplier: 1, // Fast for testing
      });

      expect(result.status).toBe('success');
      expect(result.attempts).toBe(2);
      expect(result.result).toEqual({ data: 'recovered' });
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    /**
     * Test Case 3: Source timeout
     */
    it('should handle timeout', async () => {
      const slowFn = jest.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 10000))
      );

      const result = await executeWithFallback('timeout-source', slowFn, {
        timeoutMs: 100, // Very short timeout for testing
        maxRetries: 0,
      });

      expect(result.status).toBe('timeout');
      expect(result.attempts).toBe(1);
      expect(result.error).toContain('Timeout');
    });

    /**
     * Test Case 5: Backoff timing (verify delay increases)
     */
    it('should use exponential backoff', async () => {
      const delays: number[] = [];
      let lastTimestamp = Date.now();

      let callCount = 0;
      const mockFn = jest.fn().mockImplementation(() => {
        const now = Date.now();
        if (callCount > 0) {
          delays.push(now - lastTimestamp);
        }
        lastTimestamp = now;
        callCount++;

        if (callCount <= 2) {
          return Promise.reject(new Error('Error'));
        }
        return Promise.resolve({ data: 'success' });
      });

      await executeWithFallback('backoff-source', mockFn, {
        maxRetries: 2,
        backoffMultiplier: 3,
      });

      // Should have 2 delays (after attempt 0 and 1)
      expect(delays.length).toBe(2);
      // Second delay should be 3x the first (exponential)
      expect(delays[1]).toBeGreaterThan(delays[0] * 2);
    });

    it('should return failed status after all retries exhausted', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Persistent error'));

      const result = await executeWithFallback('failing-source', mockFn, {
        maxRetries: 2,
        backoffMultiplier: 1, // Fast for testing
      });

      expect(result.status).toBe('failed');
      expect(result.attempts).toBe(3); // Initial + 2 retries
      expect(result.error).toBe('Persistent error');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });
  });

  /**
   * Test Case 4: Pipeline dengan mix success dan failure
   */
  describe('executePipeline', () => {
    it('should execute multiple stages with mixed results', async () => {
      const stages = [
        {
          name: 'primary',
          sources: [
            {
              name: 'website',
              execute: jest.fn().mockResolvedValue({ url: 'https://example.com' }),
            },
            {
              name: 'serp',
              execute: jest.fn().mockRejectedValue(new Error('SERP failed')),
            },
          ],
        },
        {
          name: 'secondary',
          sources: [
            {
              name: 'directory',
              execute: jest.fn().mockResolvedValue({ listings: [] }),
            },
          ],
        },
      ];

      const result = await executePipeline(stages);

      expect(result.sources).toHaveLength(3);
      expect(result.successful_sources).toBe(2);
      expect(result.failed_sources).toBe(1);
      expect(result.total_duration_ms).toBeGreaterThanOrEqual(0);

      // Check individual results
      const websiteResult = result.sources.find((s) => s.source === 'website');
      expect(websiteResult?.status).toBe('success');

      const serpResult = result.sources.find((s) => s.source === 'serp');
      expect(serpResult?.status).toBe('failed');

      const directoryResult = result.sources.find((s) => s.source === 'directory');
      expect(directoryResult?.status).toBe('success');
    });

    it('should execute sources in parallel within a stage', async () => {
      const executionOrder: string[] = [];

      const stages = [
        {
          name: 'parallel',
          sources: [
            {
              name: 'source1',
              execute: jest.fn().mockImplementation(async () => {
                executionOrder.push('source1-start');
                await new Promise((r) => setTimeout(r, 50));
                executionOrder.push('source1-end');
                return { id: 1 };
              }),
            },
            {
              name: 'source2',
              execute: jest.fn().mockImplementation(async () => {
                executionOrder.push('source2-start');
                await new Promise((r) => setTimeout(r, 50));
                executionOrder.push('source2-end');
                return { id: 2 };
              }),
            },
          ],
        },
      ];

      await executePipeline(stages);

      // Both sources should start before either ends (parallel)
      const s1Start = executionOrder.indexOf('source1-start');
      const s2Start = executionOrder.indexOf('source2-start');
      const s1End = executionOrder.indexOf('source1-end');
      const s2End = executionOrder.indexOf('source2-end');

      // Both start before either ends
      expect(Math.max(s1Start, s2Start)).toBeLessThan(Math.min(s1End, s2End));
    });

    it('should skip empty stages', async () => {
      const stages = [
        {
          name: 'empty',
          sources: [],
        },
        {
          name: 'has-source',
          sources: [
            {
              name: 'only-source',
              execute: jest.fn().mockResolvedValue({}),
            },
          ],
        },
      ];

      const result = await executePipeline(stages);

      // Empty stage should still be processed but add no sources
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].source).toBe('only-source');
    });
  });

  describe('executeStandardPipeline', () => {
    it('should execute with standard stage definitions', async () => {
      const adapters = {
        website: jest.fn().mockResolvedValue({ found: true }),
        serp: jest.fn().mockResolvedValue({ results: [] }),
        directory: jest.fn().mockResolvedValue({ listings: [] }),
        social: jest.fn().mockResolvedValue({ profiles: [] }),
        dns: jest.fn().mockResolvedValue({ valid: true }),
        whois: jest.fn().mockResolvedValue({ data: {} }),
      };

      const result = await executeStandardPipeline(adapters);

      expect(result.sources).toHaveLength(6);
      expect(result.successful_sources).toBe(6);
      expect(result.failed_sources).toBe(0);

      // Verify all adapters were called
      Object.values(adapters).forEach((adapter) => {
        expect(adapter).toHaveBeenCalledTimes(1);
      });
    });

    it('should filter out missing adapters', async () => {
      const adapters = {
        website: jest.fn().mockResolvedValue({ found: true }),
        // Missing: serp, directory, social, dns, whois
      };

      const result = await executeStandardPipeline(adapters);

      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].source).toBe('website');
    });
  });

  describe('shouldSkipSource', () => {
    it('should not skip source when no previous results', () => {
      const shouldSkip = shouldSkipSource('website', []);
      expect(shouldSkip).toBe(false);
    });

    it('should skip SERP if website succeeded', () => {
      const previousResults: SourceExecution[] = [
        {
          source: 'website',
          status: 'success',
          attempts: 1,
          duration_ms: 100,
        },
      ];

      expect(shouldSkipSource('serp', previousResults)).toBe(true);
    });

    it('should not skip SERP if website failed', () => {
      const previousResults: SourceExecution[] = [
        {
          source: 'website',
          status: 'failed',
          attempts: 3,
          duration_ms: 1000,
          error: 'Connection failed',
        },
      ];

      expect(shouldSkipSource('serp', previousResults)).toBe(false);
    });

    it('should skip directory and social if primary succeeded', () => {
      const previousResults: SourceExecution[] = [
        {
          source: 'website',
          status: 'success',
          attempts: 1,
          duration_ms: 100,
        },
      ];

      expect(shouldSkipSource('directory', previousResults)).toBe(true);
      expect(shouldSkipSource('social', previousResults)).toBe(true);
    });

    it('should never skip DNS', () => {
      const previousResults: SourceExecution[] = [
        {
          source: 'website',
          status: 'success',
          attempts: 1,
          duration_ms: 100,
        },
        {
          source: 'dns',
          status: 'success',
          attempts: 1,
          duration_ms: 50,
        },
      ];

      expect(shouldSkipSource('dns', previousResults)).toBe(false);
    });

    it('should skip WHOIS if DNS already succeeded', () => {
      const previousResults: SourceExecution[] = [
        {
          source: 'dns',
          status: 'success',
          attempts: 1,
          duration_ms: 50,
        },
      ];

      expect(shouldSkipSource('whois', previousResults)).toBe(true);
    });

    it('should not skip WHOIS if DNS failed', () => {
      const previousResults: SourceExecution[] = [
        {
          source: 'dns',
          status: 'failed',
          attempts: 3,
          duration_ms: 500,
          error: 'DNS timeout',
        },
      ];

      expect(shouldSkipSource('whois', previousResults)).toBe(false);
    });
  });

  describe('getExecutionSummary', () => {
    it('should generate human-readable summary', () => {
      const execution: PipelineExecution = {
        sources: [
          {
            source: 'website',
            status: 'success',
            attempts: 1,
            duration_ms: 150,
          },
          {
            source: 'serp',
            status: 'failed',
            attempts: 3,
            duration_ms: 5000,
            error: 'Connection timeout',
          },
        ],
        total_duration_ms: 5150,
        successful_sources: 1,
        failed_sources: 1,
      };

      const summary = getExecutionSummary(execution);

      expect(summary).toContain('Pipeline Execution Summary');
      expect(summary).toContain('Total sources: 2');
      expect(summary).toContain('Successful: 1');
      expect(summary).toContain('Failed: 1');
      expect(summary).toContain('website: SUCCESS');
      expect(summary).toContain('serp: FAILED (3 attempts)');
      expect(summary).toContain('Connection timeout');
    });

    it('should handle empty execution', () => {
      const execution: PipelineExecution = {
        sources: [],
        total_duration_ms: 0,
        successful_sources: 0,
        failed_sources: 0,
      };

      const summary = getExecutionSummary(execution);

      expect(summary).toContain('Total sources: 0');
    });
  });

  describe('STAGE_DEFINITIONS', () => {
    it('should have correct stage definitions', () => {
      expect(STAGE_DEFINITIONS.primary.name).toBe('primary');
      expect(STAGE_DEFINITIONS.primary.sourceNames).toEqual(['website', 'serp']);

      expect(STAGE_DEFINITIONS.secondary.name).toBe('secondary');
      expect(STAGE_DEFINITIONS.secondary.sourceNames).toEqual(['directory', 'social']);

      expect(STAGE_DEFINITIONS.tertiary.name).toBe('tertiary');
      expect(STAGE_DEFINITIONS.tertiary.sourceNames).toEqual(['dns', 'whois']);
    });
  });

  describe('Configuration', () => {
    it('should use custom configuration', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Error'));

      const result = await executeWithFallback('config-test', mockFn, {
        maxRetries: 1,
        timeoutMs: 5000,
        backoffMultiplier: 2,
      });

      // Should respect maxRetries: 1 (total 2 attempts)
      expect(result.attempts).toBeLessThanOrEqual(2);
    });

    it('should use default configuration when not provided', async () => {
      const mockFn = jest.fn().mockResolvedValue({});

      const result = await executeWithFallback('default-config', mockFn);

      expect(result.status).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });
});
