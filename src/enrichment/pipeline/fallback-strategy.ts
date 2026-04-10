/**
 * @fileoverview Fallback Strategy Module for Deep Enrichment Engine (DEE)
 * Manages execution order, retry mechanism, and fallback chain for source adapters.
 *
 * @module src/enrichment/pipeline/fallback-strategy
 */

/**
 * Status of a source execution.
 */
export type SourceStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'timeout';

/**
 * Configuration for fallback and retry behavior.
 */
export interface FallbackConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Timeout per source in milliseconds */
  timeoutMs: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
}

/**
 * Result of a single source execution.
 */
export interface SourceExecution {
  /** Name of the source */
  source: string;
  /** Current execution status */
  status: SourceStatus;
  /** Number of attempts made */
  attempts: number;
  /** Duration in milliseconds */
  duration_ms: number;
  /** Error message if failed */
  error?: string;
  /** Result data if successful */
  result?: unknown;
}

/**
 * Overall pipeline execution result.
 */
export interface PipelineExecution {
  /** All source executions */
  sources: SourceExecution[];
  /** Total execution duration */
  total_duration_ms: number;
  /** Count of successful sources */
  successful_sources: number;
  /** Count of failed sources */
  failed_sources: number;
}

/**
 * A single source to execute in the pipeline.
 */
export interface PipelineSource {
  /** Name of the source */
  name: string;
  /** Execute function returning a promise */
  execute: () => Promise<unknown>;
}

/**
 * A stage in the pipeline containing multiple sources.
 */
export interface PipelineStage {
  /** Name of the stage */
  name: string;
  /** Sources to execute in this stage */
  sources: PipelineSource[];
}

/** Default configuration */
const DEFAULT_CONFIG: FallbackConfig = {
  maxRetries: 2,
  timeoutMs: 15000,
  backoffMultiplier: 3,
};

/**
 * Sleeps for specified milliseconds.
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after ms
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculates exponential backoff delay.
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param multiplier - Backoff multiplier
 * @returns Delay in milliseconds
 */
function calculateBackoff(attempt: number, multiplier: number): number {
  // Exponential: 1s -> 3s -> 9s
  return Math.pow(multiplier, attempt) * 1000;
}

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
 * Executes a single source with retry logic and timeout.
 *
 * @param sourceName - Name of the source
 * @param fn - Function to execute
 * @param config - Optional partial configuration
 * @returns Source execution result with optional result data
 */
export async function executeWithFallback<T>(
  sourceName: string,
  fn: () => Promise<T>,
  config?: Partial<FallbackConfig>
): Promise<SourceExecution & { result?: T }> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const { maxRetries, timeoutMs, backoffMultiplier } = mergedConfig;

  const execution: SourceExecution & { result?: T } = {
    source: sourceName,
    status: 'pending',
    attempts: 0,
    duration_ms: 0,
  };

  const startTime = Date.now();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    execution.attempts = attempt + 1;
    execution.status = 'running';

    try {
      // Create timeout controller
      const controller = createTimeoutController(timeoutMs);

      // Execute with race against timeout
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error('Timeout'));
          });
        }),
      ]);

      // Success
      execution.status = 'success';
      execution.result = result;
      execution.duration_ms = Date.now() - startTime;

      return execution;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if timeout
      if (errorMessage === 'Timeout') {
        execution.status = 'timeout';
        execution.error = `Timeout after ${timeoutMs}ms`;
      } else {
        execution.status = 'failed';
        execution.error = errorMessage;
      }

      // If not last attempt, retry with backoff
      if (attempt < maxRetries) {
        const delay = calculateBackoff(attempt, backoffMultiplier);
        await sleep(delay);
      }
    }
  }

  // All retries exhausted
  execution.duration_ms = Date.now() - startTime;
  return execution;
}

/**
 * Executes multiple pipeline stages with fallback chain.
 * Sources within a stage run in parallel.
 * Stages run sequentially.
 *
 * @param stages - Array of pipeline stages
 * @param config - Optional partial configuration
 * @returns Pipeline execution result
 */
export async function executePipeline(
  stages: PipelineStage[],
  config?: Partial<FallbackConfig>
): Promise<PipelineExecution> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();

  const execution: PipelineExecution = {
    sources: [],
    total_duration_ms: 0,
    successful_sources: 0,
    failed_sources: 0,
  };

  for (const stage of stages) {
    // Execute all sources in stage in parallel
    const stagePromises = stage.sources.map(async (source) => {
      const result = await executeWithFallback(source.name, source.execute, mergedConfig);
      return result;
    });

    const stageResults = await Promise.all(stagePromises);

    // Add to execution results
    execution.sources.push(...stageResults);

    // Update counters
    for (const result of stageResults) {
      if (result.status === 'success') {
        execution.successful_sources++;
      } else {
        execution.failed_sources++;
      }
    }
  }

  execution.total_duration_ms = Date.now() - startTime;
  return execution;
}

/**
 * Predefined stage definitions for standard pipeline.
 */
export const STAGE_DEFINITIONS = {
  /** Primary stage: Website + SERP (parallel) */
  primary: {
    name: 'primary',
    sourceNames: ['website', 'serp'],
  },
  /** Secondary stage: Directory + Social (parallel) */
  secondary: {
    name: 'secondary',
    sourceNames: ['directory', 'social'],
  },
  /** Tertiary stage: DNS + WHOIS (parallel) */
  tertiary: {
    name: 'tertiary',
    sourceNames: ['dns', 'whois'],
  },
} as const;

/**
 * Creates a standard pipeline with predefined stages.
 * Uses placeholder execute functions that should be replaced with actual adapters.
 *
 * @param adapters - Map of adapter name to execute function
 * @param config - Optional configuration
 * @returns Pipeline execution result
 */
export async function executeStandardPipeline(
  adapters: Record<string, () => Promise<unknown>>,
  config?: Partial<FallbackConfig>
): Promise<PipelineExecution> {
  const stages: PipelineStage[] = [
    {
      name: STAGE_DEFINITIONS.primary.name,
      sources: STAGE_DEFINITIONS.primary.sourceNames
        .filter((name) => adapters[name])
        .map((name) => ({
          name,
          execute: adapters[name],
        })),
    },
    {
      name: STAGE_DEFINITIONS.secondary.name,
      sources: STAGE_DEFINITIONS.secondary.sourceNames
        .filter((name) => adapters[name])
        .map((name) => ({
          name,
          execute: adapters[name],
        })),
    },
    {
      name: STAGE_DEFINITIONS.tertiary.name,
      sources: STAGE_DEFINITIONS.tertiary.sourceNames
        .filter((name) => adapters[name])
        .map((name) => ({
          name,
          execute: adapters[name],
        })),
    },
  ].filter((stage) => stage.sources.length > 0);

  return executePipeline(stages, config);
}

/**
 * Determines if a source should be skipped based on previous results.
 * Implements fallback chain logic.
 *
 * @param sourceName - Name of source to check
 * @param previousResults - Previous execution results
 * @returns Whether to skip this source
 */
export function shouldSkipSource(
  sourceName: string,
  previousResults: SourceExecution[]
): boolean {
  const resultMap = new Map(previousResults.map((r) => [r.source, r]));

  // Fallback chain rules
  const fallbackRules: Record<string, () => boolean> = {
    serp: () => {
      // Skip SERP if website succeeded
      const websiteResult = resultMap.get('website');
      return websiteResult?.status === 'success';
    },
    directory: () => {
      // Skip directory if primary stage succeeded
      const primarySucceeded = ['website', 'serp'].some(
        (name) => resultMap.get(name)?.status === 'success'
      );
      return primarySucceeded;
    },
    social: () => {
      // Skip social if primary stage succeeded
      const primarySucceeded = ['website', 'serp'].some(
        (name) => resultMap.get(name)?.status === 'success'
      );
      return primarySucceeded;
    },
    dns: () => {
      // Never skip DNS - always validate
      return false;
    },
    whois: () => {
      // Skip WHOIS if we already have domain info from DNS
      const dnsResult = resultMap.get('dns');
      return dnsResult?.status === 'success';
    },
  };

  const rule = fallbackRules[sourceName];
  return rule ? rule() : false;
}

/**
 * Gets summary of pipeline execution.
 *
 * @param execution - Pipeline execution result
 * @returns Human-readable summary
 */
export function getExecutionSummary(execution: PipelineExecution): string {
  const { sources, total_duration_ms, successful_sources, failed_sources } = execution;

  const lines = [
    `Pipeline Execution Summary:`,
    `  Total sources: ${sources.length}`,
    `  Successful: ${successful_sources}`,
    `  Failed: ${failed_sources}`,
    `  Duration: ${total_duration_ms}ms`,
    ``,
    `Source Details:`,
    ...sources.map((s) => {
      const status = s.status.toUpperCase();
      const attempts = s.attempts > 1 ? ` (${s.attempts} attempts)` : '';
      const error = s.error ? ` - ${s.error}` : '';
      return `  ${s.source}: ${status}${attempts}${error}`;
    }),
  ];

  return lines.join('\n');
}
