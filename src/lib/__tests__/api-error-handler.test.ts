/**
 * API Error Handler Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseApiError,
  handleApiError,
  withErrorHandling,
  createApiErrorHandler,
} from "../api-error-handler";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock logger
vi.mock("../logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("parseApiError", () => {
  it("parses standard Error objects", () => {
    const error = new Error("Something went wrong");
    const result = parseApiError(error);

    expect(result.code).toBe("UNKNOWN_ERROR");
    expect(result.message).toBe("An unexpected error occurred. Please try again.");
    expect(result.retryable).toBe(false);
  });

  it("identifies retryable network errors", () => {
    const error = new Error("Network connection failed");
    const result = parseApiError(error);

    expect(result.retryable).toBe(true);
  });

  it("maps Supabase error codes to user-friendly messages", () => {
    const error = { code: "invalid_credentials", message: "Invalid login" };
    const result = parseApiError(error);

    expect(result.message).toBe("Invalid email or password. Please try again.");
  });

  it("handles RLS policy violations", () => {
    const error = new Error("new row violates row-level security policy");
    const result = parseApiError(error);

    expect(result.message).toBe("You do not have permission to create this record.");
  });

  it("extracts status code from error objects", () => {
    const error = { code: "42501", status: 403, message: "Forbidden" };
    const result = parseApiError(error);

    expect(result.status).toBe(403);
  });
});

describe("handleApiError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs the error", async () => {
    const { logger } = await import("../logger");
    const error = new Error("Test error");

    handleApiError(error, { context: "test" });

    expect(logger.error).toHaveBeenCalledWith(
      "API Error [test]",
      expect.objectContaining({
        code: "UNKNOWN_ERROR",
      })
    );
  });

  it("shows toast notification by default", async () => {
    const { toast } = await import("sonner");
    const error = new Error("Test error");

    handleApiError(error);

    expect(toast.error).toHaveBeenCalled();
  });

  it("does not show toast when showToast is false", async () => {
    const { toast } = await import("sonner");
    const error = new Error("Test error");

    handleApiError(error, { showToast: false });

    expect(toast.error).not.toHaveBeenCalled();
  });

  it("uses custom message when provided", async () => {
    const { toast } = await import("sonner");
    const error = new Error("Test error");

    handleApiError(error, { customMessage: "Custom error message" });

    expect(toast.error).toHaveBeenCalledWith(
      "Custom error message",
      expect.anything()
    );
  });
});

describe("withErrorHandling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns result on success", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const result = await withErrorHandling(fn);

    expect(result).toBe("success");
  });

  it("handles errors and rethrows", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Test error"));

    await expect(withErrorHandling(fn)).rejects.toThrow("Test error");
  });

  it("retries on retryable errors", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce("success");

    const result = await withErrorHandling(fn, {
      retry: { maxAttempts: 2, delayMs: 10 },
    });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("stops retrying after max attempts", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Network error"));

    await expect(
      withErrorHandling(fn, {
        retry: { maxAttempts: 3, delayMs: 10 },
      })
    ).rejects.toThrow("Network error");

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("calls onRetry callback during retries", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce("success");
    const onRetry = vi.fn();

    await withErrorHandling(fn, {
      retry: { maxAttempts: 2, delayMs: 10, onRetry },
    });

    expect(onRetry).toHaveBeenCalledWith(1);
  });
});

describe("createApiErrorHandler", () => {
  it("creates handler with default context", () => {
    const handler = createApiErrorHandler("patient");

    expect(handler.handle).toBeInstanceOf(Function);
    expect(handler.wrap).toBeInstanceOf(Function);
  });

  it("uses the provided context for logging", async () => {
    const { logger } = await import("../logger");
    const handler = createApiErrorHandler("custom-context");

    handler.handle(new Error("Test"));

    expect(logger.error).toHaveBeenCalledWith(
      "API Error [custom-context]",
      expect.anything()
    );
  });
});
