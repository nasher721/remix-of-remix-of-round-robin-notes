import { supabase } from '@/integrations/supabase/client';
import { logError, logInfo, createLogger } from './logger';
import { captureException } from './sentry';

const logger = createLogger('healthCheck');

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  latency: number;
  message?: string;
  lastChecked: Date;
  metadata?: Record<string, unknown>;
}

export interface SystemHealth {
  overall: HealthStatus;
  checks: HealthCheckResult[];
  timestamp: Date;
}

// Health check configuration
const HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds
const CHECKS = {
  supabase: 'Supabase Connection',
  auth: 'Authentication Service',
  storage: 'Storage Service',
  edgeFunctions: 'Edge Functions',
} as const;

type CheckName = keyof typeof CHECKS;

/**
 * Check Supabase database connectivity
 */
async function checkSupabase(): Promise<HealthCheckResult> {
  const startTime = performance.now();
  
  try {
    const { error } = await supabase
      .from('patients')
      .select('count', { count: 'exact', head: true })
      .limit(1);
    
    const latency = Math.round(performance.now() - startTime);
    
    if (error) {
      throw error;
    }
    
    return {
      name: CHECKS.supabase,
      status: 'healthy',
      latency,
      lastChecked: new Date(),
    };
  } catch (error) {
    const latency = Math.round(performance.now() - startTime);
    return {
      name: CHECKS.supabase,
      status: 'unhealthy',
      latency,
      message: error instanceof Error ? error.message : 'Connection failed',
      lastChecked: new Date(),
    };
  }
}

/**
 * Check authentication service
 */
async function checkAuth(): Promise<HealthCheckResult> {
  const startTime = performance.now();
  
  try {
    const { data, error } = await supabase.auth.getSession();
    const latency = Math.round(performance.now() - startTime);
    
    if (error) {
      throw error;
    }
    
    return {
      name: CHECKS.auth,
      status: 'healthy',
      latency,
      lastChecked: new Date(),
      metadata: { hasSession: !!data.session },
    };
  } catch (error) {
    const latency = Math.round(performance.now() - startTime);
    return {
      name: CHECKS.auth,
      status: 'unhealthy',
      latency,
      message: error instanceof Error ? error.message : 'Auth service unavailable',
      lastChecked: new Date(),
    };
  }
}

/**
 * Check storage service
 */
async function checkStorage(): Promise<HealthCheckResult> {
  const startTime = performance.now();
  
  try {
    const { data, error } = await supabase.storage.listBuckets();
    const latency = Math.round(performance.now() - startTime);
    
    if (error) {
      throw error;
    }
    
    return {
      name: CHECKS.storage,
      status: 'healthy',
      latency,
      lastChecked: new Date(),
      metadata: { bucketCount: data?.length ?? 0 },
    };
  } catch (error) {
    const latency = Math.round(performance.now() - startTime);
    return {
      name: CHECKS.storage,
      status: 'unhealthy',
      latency,
      message: error instanceof Error ? error.message : 'Storage service unavailable',
      lastChecked: new Date(),
    };
  }
}

/**
 * Check Edge Functions availability
 */
async function checkEdgeFunctions(): Promise<HealthCheckResult> {
  const startTime = performance.now();
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);
    
    const { error } = await supabase.functions.invoke('health-check', {
      body: { check: true },
    });
    
    clearTimeout(timeoutId);
    const latency = Math.round(performance.now() - startTime);
    
    // If the function doesn't exist, that's okay - just means no health check endpoint
    if (error && error.message?.includes('Function not found')) {
      return {
        name: CHECKS.edgeFunctions,
        status: 'healthy',
        latency,
        message: 'Edge Functions available (no health endpoint)',
        lastChecked: new Date(),
      };
    }
    
    if (error) {
      throw error;
    }
    
    return {
      name: CHECKS.edgeFunctions,
      status: 'healthy',
      latency,
      lastChecked: new Date(),
    };
  } catch (error) {
    const latency = Math.round(performance.now() - startTime);
    
    // Function not found is actually okay - means edge functions are working
    if (error instanceof Error && error.message?.includes('not found')) {
      return {
        name: CHECKS.edgeFunctions,
        status: 'healthy',
        latency,
        message: 'Edge Functions available',
        lastChecked: new Date(),
      };
    }
    
    return {
      name: CHECKS.edgeFunctions,
      status: 'degraded',
      latency,
      message: error instanceof Error ? error.message : 'Edge Functions check failed',
      lastChecked: new Date(),
    };
  }
}

/**
 * Calculate overall health status from individual checks
 */
function calculateOverallHealth(checks: HealthCheckResult[]): HealthStatus {
  const statuses = checks.map(c => c.status);
  
  if (statuses.every(s => s === 'healthy')) {
    return 'healthy';
  }
  
  if (statuses.some(s => s === 'unhealthy')) {
    return 'unhealthy';
  }
  
  if (statuses.some(s => s === 'degraded')) {
    return 'degraded';
  }
  
  return 'unknown';
}

/**
 * Run all health checks
 */
export async function runHealthChecks(): Promise<SystemHealth> {
  logger.info('Running health checks');
  
  const checks = await Promise.all([
    checkSupabase(),
    checkAuth(),
    checkStorage(),
    checkEdgeFunctions(),
  ]);
  
  const health: SystemHealth = {
    overall: calculateOverallHealth(checks),
    checks,
    timestamp: new Date(),
  };
  
  // Log unhealthy states
  if (health.overall !== 'healthy') {
    const unhealthyChecks = checks.filter(c => c.status !== 'healthy');
    logError('Health check failed', {
      overall: health.overall,
      failedChecks: unhealthyChecks.map(c => c.name),
    });
    
    unhealthyChecks.forEach(check => {
      captureException(new Error(`Health check failed: ${check.name}`), {
        tags: { check: check.name, status: check.status },
        extra: check,
      });
    });
  } else {
    logger.info('All health checks passed');
  }
  
  return health;
}

/**
 * Check a specific service health
 */
export async function checkService(name: CheckName): Promise<HealthCheckResult> {
  switch (name) {
    case 'supabase':
      return checkSupabase();
    case 'auth':
      return checkAuth();
    case 'storage':
      return checkStorage();
    case 'edgeFunctions':
      return checkEdgeFunctions();
    default:
      return {
        name: name as string,
        status: 'unknown',
        latency: 0,
        message: 'Unknown check type',
        lastChecked: new Date(),
      };
  }
}

/**
 * Create a health check hook for React components
 */
export function createHealthMonitor(options: {
  interval?: number;
  onStatusChange?: (health: SystemHealth) => void;
} = {}) {
  const { interval = 60000, onStatusChange } = options; // Default 1 minute
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastHealth: SystemHealth | null = null;
  
  const start = () => {
    if (timer) return;
    
    // Run initial check
    runHealthChecks().then(health => {
      lastHealth = health;
      onStatusChange?.(health);
    });
    
    // Set up interval
    timer = setInterval(async () => {
      const health = await runHealthChecks();
      
      // Only notify if status changed
      if (health.overall !== lastHealth?.overall) {
        onStatusChange?.(health);
      }
      
      lastHealth = health;
    }, interval);
  };
  
  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
  
  const getLastHealth = () => lastHealth;
  
  const runCheck = async () => {
    const health = await runHealthChecks();
    lastHealth = health;
    return health;
  };
  
  return {
    start,
    stop,
    getLastHealth,
    runCheck,
  };
}

/**
 * Simple ping check for connectivity
 */
export async function ping(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('patients')
      .select('id')
      .limit(1)
      .abortSignal(AbortSignal.timeout(3000));
    
    return !error;
  } catch {
    return false;
  }
}
