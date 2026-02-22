import { recordTelemetryEvent } from "@/lib/observability/telemetry";
import { getCircuitBreaker, CircuitOpenError } from "@/lib/circuitBreaker";

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
const EDGE_FUNCTION_TIMEOUT_MS = 300000; // 5 minutes for edge functions (OCR, AI parsing)
const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_RETRY_DELAY_MS = 300;

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

export const createApiClient = (fetchImpl: typeof fetch = fetch) => {
  const apiFetch = async (url: URL | RequestInfo, init: ApiFetchOptions = {}): Promise<Response> => {
    const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url;
    // Use longer timeout for edge function calls (AI/OCR can take minutes)
    const isEdgeFunction = urlString.includes('/functions/v1/');
    const {
      timeoutMs = isEdgeFunction ? EDGE_FUNCTION_TIMEOUT_MS : DEFAULT_TIMEOUT_MS,
      retryCount = isEdgeFunction ? 0 : DEFAULT_RETRY_COUNT,
      retryDelayMs = DEFAULT_RETRY_DELAY_MS,
      dedupe = !isEdgeFunction,
      ...requestInit
    } = init;

    // Circuit breaker — reject immediately if the service is known to be down
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
      let attempt = 0;
      let lastError: ApiError | null = null;
      while (attempt <= retryCount) {
        try {
          return await executeFetch();
        } catch (error) {
          lastError = normalizeError(error, urlString);
          if (attempt >= retryCount) {
            const category = lastError.message.includes('timed out') ? 'network_error' : 'api_error';
            recordTelemetryEvent(category, lastError.message, {
              url: urlString,
              status: lastError.status,
              attempts: attempt + 1,
            });
            throw lastError;
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
