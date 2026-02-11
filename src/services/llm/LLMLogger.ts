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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Log an LLM request/response event.
 */
export function logLLMEvent(entry: LLMLogEntry): void {
  // Store in recent logs (circular buffer)
  recentLogs.push(entry);
  if (recentLogs.length > MAX_LOG_ENTRIES) {
    recentLogs.shift();
  }

  // Update provider metrics
  const key = `${entry.provider}:${entry.model}`;
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
  m.totalLatencyMs += entry.latencyMs;

  if (entry.success) {
    m.successCount++;
  } else {
    m.failureCount++;
    m.lastError = entry.error;
    m.lastErrorTime = entry.timestamp;
  }

  if (entry.tokenUsage) {
    m.totalTokens += entry.tokenUsage.totalTokens;
  }

  // Console output (structured)
  const level = entry.success ? 'info' : 'error';
  const msg = `[LLM] ${entry.provider}/${entry.model} ${entry.task} ${entry.latencyMs}ms ${entry.success ? 'OK' : 'FAIL'}`;

  if (level === 'error') {
    console.error(msg, entry.error ? `— ${entry.error}` : '');
  } else {
    console.log(msg, entry.tokenUsage ? `tokens=${entry.tokenUsage.totalTokens}` : '');
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
    error: options?.error,
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
