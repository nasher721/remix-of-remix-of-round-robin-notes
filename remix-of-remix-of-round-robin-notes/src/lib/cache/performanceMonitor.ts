// Performance monitoring for cache operations
export interface CacheMetricsData {
  hits: number;
  misses: number;
  errors: number;
  totalRequests: number;
  hitRate: number;
  averageResponseTime: number;
  responseTimes: number[];
  byQueryKey: Record<string, { hits: number; misses: number }>;
  lastUpdated: number;
}

const METRICS_STORAGE_KEY = 'cache-performance-metrics';
const MAX_RESPONSE_TIMES = 100;

class CacheMetrics {
  private data: CacheMetricsData;
  private observers: Set<(metrics: CacheMetricsData) => void> = new Set();
  
  constructor() {
    this.data = this.loadFromStorage() || this.createEmptyMetrics();
  }
  
  private createEmptyMetrics(): CacheMetricsData {
    return {
      hits: 0,
      misses: 0,
      errors: 0,
      totalRequests: 0,
      hitRate: 0,
      averageResponseTime: 0,
      responseTimes: [],
      byQueryKey: {},
      lastUpdated: Date.now(),
    };
  }
  
  private loadFromStorage(): CacheMetricsData | null {
    try {
      const stored = localStorage.getItem(METRICS_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load cache metrics:', error);
    }
    return null;
  }
  
  private saveToStorage(): void {
    try {
      localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(this.data));
    } catch (error) {
      console.warn('Failed to save cache metrics:', error);
    }
  }
  
  private updateMetrics(): void {
    this.data.totalRequests = this.data.hits + this.data.misses;
    this.data.hitRate = this.data.totalRequests > 0
      ? (this.data.hits / this.data.totalRequests) * 100
      : 0;
    this.data.averageResponseTime = this.data.responseTimes.length > 0
      ? this.data.responseTimes.reduce((a, b) => a + b, 0) / this.data.responseTimes.length
      : 0;
    this.data.lastUpdated = Date.now();
    
    this.saveToStorage();
    this.notifyObservers();
  }
  
  private notifyObservers(): void {
    this.observers.forEach(callback => callback(this.getMetrics()));
  }
  
  recordHit(queryKey: string, responseTime?: number): void {
    this.data.hits++;
    
    if (!this.data.byQueryKey[queryKey]) {
      this.data.byQueryKey[queryKey] = { hits: 0, misses: 0 };
    }
    this.data.byQueryKey[queryKey].hits++;
    
    if (responseTime !== undefined) {
      this.data.responseTimes.push(responseTime);
      if (this.data.responseTimes.length > MAX_RESPONSE_TIMES) {
        this.data.responseTimes.shift();
      }
    }
    
    this.updateMetrics();
  }
  
  recordMiss(queryKey: string, responseTime?: number): void {
    this.data.misses++;
    
    if (!this.data.byQueryKey[queryKey]) {
      this.data.byQueryKey[queryKey] = { hits: 0, misses: 0 };
    }
    this.data.byQueryKey[queryKey].misses++;
    
    if (responseTime !== undefined) {
      this.data.responseTimes.push(responseTime);
      if (this.data.responseTimes.length > MAX_RESPONSE_TIMES) {
        this.data.responseTimes.shift();
      }
    }
    
    this.updateMetrics();
  }
  
  recordError(queryKey: string): void {
    this.data.errors++;
    this.updateMetrics();
  }
  
  getMetrics(): CacheMetricsData {
    return { ...this.data };
  }
  
  reset(): void {
    this.data = this.createEmptyMetrics();
    this.saveToStorage();
    this.notifyObservers();
  }
  
  subscribe(callback: (metrics: CacheMetricsData) => void): () => void {
    this.observers.add(callback);
    return () => this.observers.delete(callback);
  }
}

export const cacheMetrics = new CacheMetrics();

// Service worker metrics integration
export async function getServiceWorkerMetrics(): Promise<{
  cacheHits: number;
  cacheMisses: number;
  networkRequests: number;
  hitRate: number;
  averageRetrievalTime: number;
} | null> {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    return null;
  }
  
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    
    channel.port1.onmessage = (event) => {
      resolve(event.data);
    };
    
    navigator.serviceWorker.controller.postMessage(
      { type: 'GET_METRICS' },
      [channel.port2]
    );
    
    // Timeout after 1 second
    setTimeout(() => resolve(null), 1000);
  });
}

// Combined metrics from React Query and Service Worker
export async function getCombinedMetrics() {
  const queryMetrics = cacheMetrics.getMetrics();
  const swMetrics = await getServiceWorkerMetrics();
  
  return {
    query: queryMetrics,
    serviceWorker: swMetrics,
    combined: {
      totalHits: queryMetrics.hits + (swMetrics?.cacheHits || 0),
      totalMisses: queryMetrics.misses + (swMetrics?.cacheMisses || 0),
      overallHitRate: calculateCombinedHitRate(queryMetrics, swMetrics),
    },
  };
}

function calculateCombinedHitRate(
  queryMetrics: CacheMetricsData,
  swMetrics: Awaited<ReturnType<typeof getServiceWorkerMetrics>>
): number {
  const totalHits = queryMetrics.hits + (swMetrics?.cacheHits || 0);
  const totalRequests = queryMetrics.totalRequests + 
    (swMetrics?.cacheHits || 0) + 
    (swMetrics?.cacheMisses || 0);
  
  return totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;
}
