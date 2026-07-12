export type ProviderOperation = "request" | "stream";

/**
 * Return useful transport metadata without copying an untrusted upstream body.
 * Provider error bodies can echo submitted clinical text or internal details.
 */
export function safeProviderHttpError(
  provider: string,
  operation: ProviderOperation,
  status: number,
): string {
  const safeStatus = Number.isInteger(status) && status >= 100 && status <= 599
    ? status
    : "unknown";
  return `${provider} ${operation} failed (HTTP ${safeStatus}).`;
}

export function safeProviderRuntimeError(
  provider: string,
  operation: ProviderOperation,
  error: unknown,
): string {
  const cancelled = error instanceof Error && error.name === "AbortError";
  return cancelled
    ? `${provider} ${operation} was cancelled.`
    : `${provider} ${operation} failed.`;
}
