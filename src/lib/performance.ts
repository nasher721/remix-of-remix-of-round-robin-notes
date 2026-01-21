/**
 * Performance Monitoring & Web Vitals Tracking
 * 
 * Tracks page load times, component renders, API responses,
 * and Core Web Vitals metrics.
 * 
 * @module performance
 */

import { logger, trackPerformance } from './logger';

/**
 * Performance metric types
 */
export interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
}

/**
 * Web Vitals thresholds (in milliseconds where applicable)
 */
const WEB_VITALS_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 }, // Largest Contentful Paint
  FID: { good: 100, poor: 300 },   // First Input Delay
  CLS: { good: 0.1, poor: 0.25 },  // Cumulative Layout Shift
  FCP: { good: 1800, poor: 3000 }, // First Contentful Paint
  TTFB: { good: 800, poor: 1800 }, // Time to First Byte
  INP: { good: 200, poor: 500 },   // Interaction to Next Paint
};

type VitalName = keyof typeof WEB_VITALS_THRESHOLDS;

/**
 * Storage for collected metrics
 */
const metricsBuffer: PerformanceMetric[] = [];
const MAX_METRICS = 50;

/**
 * Rate a metric value based on thresholds
 */
function rateMetric(
  name: VitalName,
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const thresholds = WEB_VITALS_THRESHOLDS[name];
  if (!thresholds) return 'good';
  
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Store a performance metric
 */
function storeMetric(metric: PerformanceMetric): void {
  metricsBuffer.push(metric);
  if (metricsBuffer.length > MAX_METRICS) {
    metricsBuffer.shift();
  }
}

/**
 * Measure and track a Web Vital
 */
export function trackWebVital(name: VitalName, value: number): void {
  const rating = rateMetric(name, value);
  const metric: PerformanceMetric = {
    name,
    value,
    rating,
    timestamp: Date.now(),
  };
  
  storeMetric(metric);
  
  // Log based on rating
  if (rating === 'poor') {
    logger.warn(`Poor ${name}: ${value}`, { metric });
  } else if (rating === 'needs-improvement') {
    logger.info(`${name} needs improvement: ${value}`, { metric });
  } else {
    logger.debug(`Good ${name}: ${value}`, { metric });
  }
}

/**
 * Performance marker for measuring durations
 */
export class PerformanceMark {
  private startTime: number;
  private name: string;
  
  constructor(name: string) {
    this.name = name;
    this.startTime = performance.now();
    
    // Use Performance API if available
    if (typeof performance.mark === 'function') {
      try {
        performance.mark(`${name}-start`);
      } catch {
        // Ignore errors from Performance API
      }
    }
  }
  
  /**
   * End the measurement and log the duration
   */
  end(metadata?: Record<string, unknown>): number {
    const duration = performance.now() - this.startTime;
    
    // Use Performance API if available
    if (typeof performance.mark === 'function' && typeof performance.measure === 'function') {
      try {
        performance.mark(`${this.name}-end`);
        performance.measure(this.name, `${this.name}-start`, `${this.name}-end`);
      } catch {
        // Ignore errors from Performance API
      }
    }
    
    trackPerformance(this.name, Math.round(duration), metadata);
    return duration;
  }
}

/**
 * Create a performance marker
 */
export function mark(name: string): PerformanceMark {
  return new PerformanceMark(name);
}

/**
 * Measure an async function's execution time
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const marker = mark(name);
  try {
    const result = await fn();
    marker.end({ ...metadata, success: true });
    return result;
  } catch (error) {
    marker.end({ ...metadata, success: false, error: String(error) });
    throw error;
  }
}

/**
 * Measure a sync function's execution time
 */
export function measureSync<T>(
  name: string,
  fn: () => T,
  metadata?: Record<string, unknown>
): T {
  const marker = mark(name);
  try {
    const result = fn();
    marker.end({ ...metadata, success: true });
    return result;
  } catch (error) {
    marker.end({ ...metadata, success: false, error: String(error) });
    throw error;
  }
}

/**
 * Get all collected metrics
 */
export function getMetrics(): ReadonlyArray<PerformanceMetric> {
  return [...metricsBuffer];
}

/**
 * Clear all collected metrics
 */
export function clearMetrics(): void {
  metricsBuffer.length = 0;
}

/**
 * Initialize Web Vitals tracking
 * Call this once on app startup
 */
export function initWebVitals(): void {
  // Track First Contentful Paint
  if (typeof PerformanceObserver !== 'undefined') {
    try {
      const fcpObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.name === 'first-contentful-paint') {
            trackWebVital('FCP', entry.startTime);
          }
        }
      });
      fcpObserver.observe({ type: 'paint', buffered: true });
    } catch {
      // PerformanceObserver not supported
    }
    
    // Track Largest Contentful Paint
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          trackWebVital('LCP', lastEntry.startTime);
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      // LCP not supported
    }
    
    // Track Cumulative Layout Shift
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutShift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
          if (!layoutShift.hadRecentInput && layoutShift.value) {
            clsValue += layoutShift.value;
            trackWebVital('CLS', clsValue);
          }
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch {
      // CLS not supported
    }
  }
  
  // Track Time to First Byte from Navigation Timing API
  if (typeof window !== 'undefined' && window.performance?.timing) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        const timing = performance.timing;
        const ttfb = timing.responseStart - timing.requestStart;
        if (ttfb > 0) {
          trackWebVital('TTFB', ttfb);
        }
      }, 0);
    });
  }
  
  logger.info('Web Vitals tracking initialized');
}

/**
 * Get a summary of current performance metrics
 */
export function getPerformanceSummary(): {
  metrics: Record<string, { value: number; rating: string }>;
  overallRating: 'good' | 'needs-improvement' | 'poor';
} {
  const latestMetrics: Record<string, PerformanceMetric> = {};
  
  // Get the latest value for each metric type
  for (const metric of metricsBuffer) {
    if (!latestMetrics[metric.name] || metric.timestamp > latestMetrics[metric.name].timestamp) {
      latestMetrics[metric.name] = metric;
    }
  }
  
  const summary: Record<string, { value: number; rating: string }> = {};
  let poorCount = 0;
  let needsImprovementCount = 0;
  
  for (const [name, metric] of Object.entries(latestMetrics)) {
    summary[name] = { value: metric.value, rating: metric.rating };
    if (metric.rating === 'poor') poorCount++;
    else if (metric.rating === 'needs-improvement') needsImprovementCount++;
  }
  
  let overallRating: 'good' | 'needs-improvement' | 'poor' = 'good';
  if (poorCount > 0) overallRating = 'poor';
  else if (needsImprovementCount > 0) overallRating = 'needs-improvement';
  
  return { metrics: summary, overallRating };
}
