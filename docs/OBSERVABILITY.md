# Observability Guide

This document describes the observability infrastructure for Round Robin Notes, including error tracking, logging, and health monitoring.

## Overview

The observability system provides:

- **Error Tracking**: Sentry integration for production error monitoring
- **Structured Logging**: Correlation IDs and structured log entries
- **Health Checks**: Automated monitoring of critical services
- **Performance Metrics**: Request duration and system performance tracking

## Setup

### Environment Variables

```bash
# Required for Sentry error tracking
VITE_SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz

# Optional: App version for releases
VITE_APP_VERSION=1.2.3
```

### Initialization

The observability system is initialized in `main.tsx`:

```typescript
import { initSentry } from '@/lib/observability/sentry';

// Initialize Sentry before React
initSentry();
```

## Error Tracking (Sentry)

### Configuration

Sentry is configured with:
- Automatic error capture
- Performance monitoring
- User session replay (with PII masking)
- PHI sanitization

### Usage

```typescript
import { captureException, setSentryUser, addBreadcrumb } from '@/lib/observability/sentry';

// Capture an error
captureException(error, {
  tags: { component: 'PatientCard', action: 'update' },
  extra: { patientId: patient.id },
});

// Set user context (PII is automatically stripped)
setSentryUser({ id: user.id });

// Add breadcrumb for debugging
addBreadcrumb('Patient updated', 'patient', 'info', { patientId });
```

### Error Boundaries

Use the enhanced ErrorBoundary component:

```typescript
import { ErrorBoundary } from '@/components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary componentName="Dashboard">
      <Dashboard />
    </ErrorBoundary>
  );
}
```

The ErrorBoundary:
- Captures errors to Sentry
- Shows user-friendly fallback UI
- Provides retry functionality
- Sanitizes error data

## Structured Logging

### Basic Logging

```typescript
import { logInfo, logWarn, logError, logDebug } from '@/lib/observability/logger';

logInfo('Patient saved', { patientId: '123' });
logWarn('API rate limit approaching', { endpoint: '/patients' });
logError('Failed to save patient', { error, patientId: '123' });
```

### Component Logger

Create a contextualized logger:

```typescript
import { createLogger } from '@/lib/observability/logger';

const logger = createLogger('PatientCard', { patientId: '123' });

logger.info('Component mounted');
logger.error('Update failed', { field: 'name' });
logger.metric('render_time', 150, 'ms');
```

### Correlation IDs

Track requests across components:

```typescript
import { 
  generateCorrelationId, 
  setCorrelationId, 
  getCorrelationId,
  clearCorrelationId 
} from '@/lib/observability/logger';

// Start a new operation
const correlationId = generateCorrelationId();
setCorrelationId(correlationId);

// All subsequent logs include this ID
logInfo('Starting patient import'); // Includes correlationId

// Clear when done
clearCorrelationId();
```

### API Call Logging

```typescript
import { logApiCall } from '@/lib/observability/logger';

const startTime = performance.now();
try {
  const response = await fetch('/api/patients');
  logApiCall(
    '/api/patients',
    'GET',
    performance.now() - startTime,
    response.status
  );
} catch (error) {
  logApiCall(
    '/api/patients',
    'GET',
    performance.now() - startTime,
    undefined,
    error as Error
  );
}
```

## Health Monitoring

### Manual Health Check

```typescript
import { runHealthChecks } from '@/lib/observability/healthCheck';

const health = await runHealthChecks();
console.log(health.overall); // 'healthy', 'degraded', or 'unhealthy'

health.checks.forEach(check => {
  console.log(`${check.name}: ${check.status} (${check.latency}ms)`);
});
```

### Automated Monitoring

```typescript
import { createHealthMonitor } from '@/lib/observability/healthCheck';

const monitor = createHealthMonitor({
  interval: 60000, // Check every minute
  onStatusChange: (health) => {
    if (health.overall !== 'healthy') {
      showNotification('System health degraded');
    }
  },
});

// Start monitoring
monitor.start();

// Stop monitoring
monitor.stop();
```

### Available Checks

| Check | Description |
|-------|-------------|
| `supabase` | Database connectivity |
| `auth` | Authentication service |
| `storage` | Storage service |
| `edgeFunctions` | Edge Functions availability |

### Simple Connectivity Check

```typescript
import { ping } from '@/lib/observability/healthCheck';

const isOnline = await ping();
if (!isOnline) {
  showOfflineWarning();
}
```

## Log Buffer

Access recent logs for debugging:

```typescript
import { getRecentLogs, clearLogBuffer } from '@/lib/observability/logger';

// Get last 50 log entries
const logs = getRecentLogs(50);

// Clear the buffer
clearLogBuffer();
```

## PHI Sanitization

All observability data is automatically sanitized to remove PHI:

- **Sentry**: Events are sanitized before sending
- **Logs**: Sensitive fields are redacted
- **Breadcrumbs**: Messages and data are cleaned

Fields automatically redacted:
- `password`, `token`, `secret`, `ssn`
- `dob`, `mrn`, `patient_name`
- `diagnosis`, `transcript`

## Metrics

### Custom Metrics

```typescript
import { logMetric } from '@/lib/observability/logger';

logMetric('patient.load_time', 250, 'ms', { count: 10 });
logMetric('export.pdf_size', 1024, 'kb');
```

### User Actions

```typescript
import { logUserAction } from '@/lib/observability/logger';

logUserAction('patient_created', 'patient');
logUserAction('ai_feature_used', 'ai', { feature: 'clinical_summary' });
```

## Integration with React Query

```typescript
import { QueryCache, QueryClient } from '@tanstack/react-query';
import { logError } from '@/lib/observability/logger';

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      logError('Query failed', {
        error: error.message,
        queryKey: query.queryKey,
      });
    },
  }),
});
```

## Best Practices

1. **Use component loggers** - Create contextualized loggers for consistent tagging
2. **Include correlation IDs** - Track multi-step operations
3. **Log at appropriate levels** - Debug for dev, Info for normal ops, Error for failures
4. **Add context** - Include relevant IDs and metadata in log entries
5. **Don't log PHI** - Let the sanitization handle it, but be mindful
6. **Use health checks** - Monitor critical dependencies
7. **Handle errors gracefully** - Use ErrorBoundaries and report to Sentry

## Troubleshooting

### Sentry not receiving errors

1. Check `VITE_SENTRY_DSN` is set
2. Verify DSN format: `https://key@org.ingest.sentry.io/project`
3. Check browser console for Sentry initialization errors

### Logs not appearing

1. Check environment: Logs may be filtered in production
2. Verify log level: Debug logs are disabled in production
3. Check log buffer: Recent logs are always available

### Health checks failing

1. Check Supabase configuration
2. Verify network connectivity
3. Check CORS settings for Edge Functions
4. Review health check results for specific failures

## Related Documentation

- [API Contracts](./API_CONTRACTS.md)
- [Error Handling](./ERROR_HANDLING.md)
- [Testing Guide](./TESTING.md)
