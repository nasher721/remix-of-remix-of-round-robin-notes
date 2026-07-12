/**
 * LLMLogger
 *
 * Structured logging and observability for the LLM system.
 *
 * Features:
 * - PHI-safe logging (never logs patient identifiers)
 * - Provider latency tracking
 * - Token usage tracking
 * - Error rate monitoring
 * - Prompt hashing for dedup analysis without storing content
 */

import type { LLMLogEntry, LLMProviderName, TaskCategory, TokenUsage } from './types';

// ---------------------------------------------------------------------------
// In-memory metrics store
// ---------------------------------------------------------------------------

interface ProviderMetrics {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  totalLatencyMs: number;
  totalTokens: number;
  lastError?: string;
  lastErrorTime?: string;
}

const metricsStore: Record<string, ProviderMetrics> = {};
const recentLogs: LLMLogEntry[] = [];
const MAX_LOG_ENTRIES = 100;

function classifyErrorForLog(error: string | undefined): string | undefined {
  if (!error) return undefined;
  const httpStatus = error.match(/\bHTTP\s+(\d{3})\b/i)?.[1];
  if (httpStatus) return `provider_http_${httpStatus}`;
  if (/timed out|timeout/i.test(error)) return 'provider_timeout';
  if (/cancelled|aborted/i.test(error)) return 'provider_cancelled';
  if (/validation failed/i.test(error)) return 'output_validation_failed';
  return 'provider_request_failed';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Log an LLM request/response event.
 */
export function logLLMEvent(entry: LLMLogEntry): void {
  const safeEntry: LLMLogEntry = {
    ...entry,
    error: classifyErrorForLog(entry.error),
  };

  // Store in recent logs (circular buffer)
  recentLogs.push(safeEntry);
  if (recentLogs.length > MAX_LOG_ENTRIES) {
    recentLogs.shift();
  }

  // Update provider metrics
  const key = `${safeEntry.provider}:${safeEntry.model}`;
  if (!metricsStore[key]) {
    metricsStore[key] = {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      totalLatencyMs: 0,
      totalTokens: 0,
    };
  }

  const m = metricsStore[key];
  m.totalRequests++;
  m.totalLatencyMs += safeEntry.latencyMs;

  if (safeEntry.success) {
    m.successCount++;
  } else {
    m.failureCount++;
    m.lastError = safeEntry.error;
    m.lastErrorTime = safeEntry.timestamp;
  }

  if (safeEntry.tokenUsage) {
    m.totalTokens += safeEntry.tokenUsage.totalTokens;
  }

  // Console output (structured)
  const level = safeEntry.success ? 'info' : 'error';
  const msg = `[LLM] ${safeEntry.provider}/${safeEntry.model} ${safeEntry.task} ${safeEntry.latencyMs}ms ${safeEntry.success ? 'OK' : 'FAIL'}`;

  if (level === 'error') {
    console.error(msg, safeEntry.error ? `— ${safeEntry.error}` : '');
  } else {
    console.log(msg, safeEntry.tokenUsage ? `tokens=${safeEntry.tokenUsage.totalTokens}` : '');
  }
}

/**
 * Create a log entry helper.
 */
export function createLogEntry(
  provider: LLMProviderName,
  model: string,
  task: TaskCategory,
  latencyMs: number,
  success: boolean,
  options?: {
    error?: string;
    tokenUsage?: TokenUsage;
    feature?: string;
    promptHash?: string;
  },
): LLMLogEntry {
  return {
    timestamp: new Date().toISOString(),
    provider,
    model,
    task,
    feature: options?.feature,
    latencyMs,
    success,
    error: classifyErrorForLog(options?.error),
    tokenUsage: options?.tokenUsage,
    promptHash: options?.promptHash,
  };
}

/**
 * Get metrics for a specific provider, or all providers.
 */
export function getMetrics(provider?: LLMProviderName): Record<string, ProviderMetrics> {
  if (!provider) return { ...metricsStore };

  const filtered: Record<string, ProviderMetrics> = {};
  for (const [key, value] of Object.entries(metricsStore)) {
    if (key.startsWith(`${provider}:`)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

/**
 * Get recent log entries.
 */
export function getRecentLogs(count = 20): LLMLogEntry[] {
  return recentLogs.slice(-count);
}

/**
 * Get average latency for a provider.
 */
export function getAverageLatency(provider: LLMProviderName): number {
  let totalLatency = 0;
  let totalRequests = 0;

  for (const [key, m] of Object.entries(metricsStore)) {
    if (key.startsWith(`${provider}:`)) {
      totalLatency += m.totalLatencyMs;
      totalRequests += m.totalRequests;
    }
  }

  return totalRequests > 0 ? totalLatency / totalRequests : 0;
}

/**
 * Get failure rate for a provider.
 */
export function getFailureRate(provider: LLMProviderName): number {
  let failures = 0;
  let total = 0;

  for (const [key, m] of Object.entries(metricsStore)) {
    if (key.startsWith(`${provider}:`)) {
      failures += m.failureCount;
      total += m.totalRequests;
    }
  }

  return total > 0 ? failures / total : 0;
}

/**
 * Generate a non-reversible hash of prompt content for dedup analysis.
 * This never stores actual prompt content.
 */
export function hashPrompt(prompt: string): string {
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    const char = prompt.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `ph_${Math.abs(hash).toString(36)}`;
}

/**
 * Reset all metrics (useful for testing).
 */
export function resetMetrics(): void {
  for (const key of Object.keys(metricsStore)) {
    delete metricsStore[key];
  }
  recentLogs.length = 0;
}
