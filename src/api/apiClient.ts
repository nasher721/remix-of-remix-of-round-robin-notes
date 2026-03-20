import { recordTelemetryEvent } from "@/lib/observability/telemetry";
import { getCircuitBreaker, CircuitOpenError, type CircuitState } from "@/lib/circuitBreaker";
import { logError, logInfo, generateRequestId } from "@/lib/observability/logger";
import { captureEdgeFetchFailureToSentry } from "@/lib/observability/sentryClient";

export type ApiError = {
  name: "ApiError";
  message: string;
  status?: number;
  url?: string;
  cause?: unknown;
};

export type ApiFetchOptions = RequestInit & {
  timeoutMs?: number;
  retryCount?: number;
  retryDelayMs?: number;
  dedupe?: boolean;
};

const DEFAULT_TIMEOUT_MS = 10000;
const EDGE_FUNCTION_TIMEOUT_MS = 300000; // 5 minutes for edge functions (AI/OCR can take minutes)
const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_RETRY_DELAY_MS = 300;

/** Initial attempt + 3 retries = 4 total tries for transient edge failures. */
const EDGE_RETRY_COUNT = 3;
/** Fixed delay between edge retries (no exponential backoff). */
const EDGE_RETRY_DELAY_MS = 1000;

const inflightRequests = new Map<string, Promise<Response>>();

const normalizeError = (error: unknown, url?: string, status?: number): ApiError => {
  const message = error instanceof Error ? error.message : "Network request failed";
  return {
    name: "ApiError",
    message,
    status,
    url,
    cause: error,
  };
};

const createRequestKey = (url: string, init?: RequestInit): string => {
  const method = init?.method ?? "GET";
  const body = typeof init?.body === "string" ? init.body : "";
  return `${method}:${url}:${body}`;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function edgeFunctionNameFromUrl(url: string): string {
  if (url.includes('/functions/v1/')) {
    return url.split('/functions/v1/')[1]?.split('?')[0] ?? 'edge';
  }
  return 'edge';
}

/** Derive a circuit breaker name from a URL (group by host + path prefix). */
function circuitNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (url.includes('/functions/v1/')) {
      const fnName = url.split('/functions/v1/')[1]?.split('?')[0] ?? 'edge';
      return `edge:${fnName}`;
    }
    return `api:${parsed.host}`;
  } catch {
    return 'api:unknown';
  }
}

function isTimedOutMessage(message: string): boolean {
  return message.toLowerCase().includes('timed out');
}

/** Retry edge calls on network failures and 5xx — not on 4xx or timeouts. */
function isEdgeFailureRetriable(err: ApiError): boolean {
  if (isTimedOutMessage(err.message)) return false;
  if (err.status != null && err.status > 0 && err.status < 500) return false;
  return true;
}

function logEdgeStructured(
  event: 'edge_fetch_retry' | 'edge_invoke_failed',
  fields: {
    functionName: string;
    correlationId: string;
    attempt: number;
    maxAttempts: number;
    status?: number;
    message?: string;
    circuitState?: CircuitState;
    durationMs?: number;
  },
): void {
  const payload = { event, ...fields };
  if (event === 'edge_fetch_retry') {
    logInfo('edge_fetch_retry', payload);
  } else {
    logError('edge_invoke_failed', payload);
  }
  recordTelemetryEvent('api_error', event, payload as Record<string, unknown>);
}

export const createApiClient = (fetchImpl: typeof fetch = fetch) => {
  const apiFetch = async (url: URL | RequestInfo, init: ApiFetchOptions = {}): Promise<Response> => {
    const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url;
    const isEdgeFunction = urlString.includes('/functions/v1/');
    const {
      timeoutMs = isEdgeFunction ? EDGE_FUNCTION_TIMEOUT_MS : DEFAULT_TIMEOUT_MS,
      retryCount = isEdgeFunction ? EDGE_RETRY_COUNT : DEFAULT_RETRY_COUNT,
      retryDelayMs = DEFAULT_RETRY_DELAY_MS,
      dedupe = !isEdgeFunction,
      ...requestInit
    } = init;

    const effectiveEdgeDelay = isEdgeFunction ? EDGE_RETRY_DELAY_MS : retryDelayMs;

    const cbName = circuitNameFromUrl(urlString);
    const cb = getCircuitBreaker(cbName, {
      failureThreshold: isEdgeFunction ? 3 : 5,
      resetTimeoutMs: isEdgeFunction ? 60_000 : 30_000,
    });

    if (!cb.canExecute()) {
      throw normalizeError(
        new CircuitOpenError(cbName, cb.remainingCooldownMs()),
        urlString,
      );
    }

    const requestKey = createRequestKey(urlString, requestInit);
    if (dedupe && inflightRequests.has(requestKey)) {
      const inflight = inflightRequests.get(requestKey);
      if (inflight) {
        return inflight.then((response) => response.clone());
      }
    }

    const executeFetch = async (): Promise<Response> => {
      const controller = new AbortController();
      const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
      const signal = requestInit.signal
        ? new AbortSignalProxy(requestInit.signal, controller.signal).signal
        : controller.signal;

      try {
        const response = await fetchImpl(urlString, { ...requestInit, signal });
        return response;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw normalizeError(new Error("Request timed out"), urlString);
        }
        throw normalizeError(error, urlString);
      } finally {
        globalThis.clearTimeout(timeoutId);
      }
    };

    const requestPromise = cb.execute(async () => {
      const correlationId = generateRequestId();
      const functionName = isEdgeFunction ? edgeFunctionNameFromUrl(urlString) : cbName;
      let attempt = 0;
      let lastError: ApiError | null = null;
      const startedAt = performance.now();

      while (attempt <= retryCount) {
        try {
          const response = await executeFetch();

          if (isEdgeFunction && response.status >= 500 && response.status <= 599) {
            lastError = normalizeError(
              new Error(`HTTP ${response.status}`),
              urlString,
              response.status,
            );
            if (attempt >= retryCount) {
              const durationMs = Math.round(performance.now() - startedAt);
              logEdgeStructured('edge_invoke_failed', {
                functionName,
                correlationId,
                attempt: attempt + 1,
                maxAttempts: retryCount + 1,
                status: response.status,
                message: lastError.message,
                circuitState: cb.getState(),
                durationMs,
              });
              captureEdgeFetchFailureToSentry({
                functionName,
                correlationId,
                status: response.status,
                attempts: attempt + 1,
                circuitState: cb.getState(),
              });
              return response;
            }
            logEdgeStructured('edge_fetch_retry', {
              functionName,
              correlationId,
              attempt: attempt + 1,
              maxAttempts: retryCount + 1,
              status: response.status,
              message: `HTTP ${response.status}`,
              circuitState: cb.getState(),
            });
            await delay(effectiveEdgeDelay);
            attempt += 1;
            continue;
          }

          return response;
        } catch (error) {
          lastError = normalizeError(error, urlString);
          if (attempt >= retryCount) {
            const category = lastError.message.includes('timed out') ? 'network_error' : 'api_error';
            recordTelemetryEvent(category, lastError.message, {
              url: urlString,
              status: lastError.status,
              attempts: attempt + 1,
            });
            if (isEdgeFunction) {
              const durationMs = Math.round(performance.now() - startedAt);
              logEdgeStructured('edge_invoke_failed', {
                functionName,
                correlationId,
                attempt: attempt + 1,
                maxAttempts: retryCount + 1,
                status: lastError.status,
                message: lastError.message,
                circuitState: cb.getState(),
                durationMs,
              });
              captureEdgeFetchFailureToSentry({
                functionName,
                correlationId,
                status: lastError.status,
                attempts: attempt + 1,
                circuitState: cb.getState(),
              });
            }
            throw lastError;
          }

          if (isEdgeFunction) {
            if (!isEdgeFailureRetriable(lastError)) {
              recordTelemetryEvent('api_error', lastError.message, {
                url: urlString,
                status: lastError.status,
                attempts: attempt + 1,
              });
              throw lastError;
            }
            logEdgeStructured('edge_fetch_retry', {
              functionName,
              correlationId,
              attempt: attempt + 1,
              maxAttempts: retryCount + 1,
              status: lastError.status,
              message: lastError.message,
              circuitState: cb.getState(),
            });
            await delay(effectiveEdgeDelay);
            attempt += 1;
            continue;
          }

          const backoff = retryDelayMs * Math.pow(2, attempt);
          const jitter = Math.floor(Math.random() * retryDelayMs);
          await delay(backoff + jitter);
          attempt += 1;
        }
      }
      throw lastError ?? normalizeError(new Error("Request failed"), urlString);
    });

    if (dedupe) {
      inflightRequests.set(requestKey, requestPromise);
      requestPromise.finally(() => inflightRequests.delete(requestKey));
    }

    return requestPromise;
  };

  return { apiFetch };
};

class AbortSignalProxy {
  signal: AbortSignal;

  constructor(primary: AbortSignal, secondary: AbortSignal) {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    primary.addEventListener("abort", onAbort, { once: true });
    secondary.addEventListener("abort", onAbort, { once: true });
    this.signal = controller.signal;
  }
}

const client = createApiClient();
export const apiFetch = client.apiFetch;
