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

export const createApiClient = (fetchImpl: typeof fetch = fetch) => {
  const apiFetch = async (url: string, init: ApiFetchOptions = {}): Promise<Response> => {
    // Use longer timeout for edge function calls (AI/OCR can take minutes)
    const isEdgeFunction = url.includes('/functions/v1/');
    const {
      timeoutMs = isEdgeFunction ? EDGE_FUNCTION_TIMEOUT_MS : DEFAULT_TIMEOUT_MS,
      retryCount = isEdgeFunction ? 0 : DEFAULT_RETRY_COUNT,
      retryDelayMs = DEFAULT_RETRY_DELAY_MS,
      dedupe = !isEdgeFunction,
      ...requestInit
    } = init;

    const requestKey = createRequestKey(url, requestInit);
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
        const response = await fetchImpl(url, { ...requestInit, signal });
        return response;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw normalizeError(new Error("Request timed out"), url);
        }
        throw normalizeError(error, url);
      } finally {
        globalThis.clearTimeout(timeoutId);
      }
    };

    const requestPromise = (async () => {
      let attempt = 0;
      let lastError: ApiError | null = null;
      while (attempt <= retryCount) {
        try {
          return await executeFetch();
        } catch (error) {
          lastError = normalizeError(error, url);
          if (attempt >= retryCount) {
            throw lastError;
          }
          const backoff = retryDelayMs * Math.pow(2, attempt);
          const jitter = Math.floor(Math.random() * retryDelayMs);
          await delay(backoff + jitter);
          attempt += 1;
        }
      }
      throw lastError ?? normalizeError(new Error("Request failed"), url);
    })();

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

export const { apiFetch } = createApiClient();
