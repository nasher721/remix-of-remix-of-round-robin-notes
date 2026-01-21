/**
 * Logger Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need to test the logger in isolation, so we'll mock import.meta.env
const mockEnv = {
  DEV: true,
  PROD: false,
};

// Reset modules before each test
beforeEach(() => {
  vi.resetModules();
});

describe("Logger", () => {
  describe("in development mode", () => {
    it("outputs debug messages to console", async () => {
      const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
      
      // Dynamic import to get fresh module with mocked env
      const { logger } = await import("../logger");
      
      logger.debug("Debug message");
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("outputs info messages to console", async () => {
      const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      
      const { logger } = await import("../logger");
      
      logger.info("Info message");
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("outputs warning messages to console", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      
      const { logger } = await import("../logger");
      
      logger.warn("Warning message");
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("outputs error messages to console", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      
      const { logger } = await import("../logger");
      
      logger.error("Error message");
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("createLogger", () => {
    it("creates a logger with context", async () => {
      const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      
      const { createLogger } = await import("../logger");
      const contextLogger = createLogger("TestModule");
      
      contextLogger.info("Test message");
      
      expect(consoleSpy).toHaveBeenCalled();
      const callArgs = consoleSpy.mock.calls[0];
      expect(callArgs[0]).toContain("[TestModule]");
      
      consoleSpy.mockRestore();
    });

    it("supports child loggers with nested context", async () => {
      const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      
      const { createLogger } = await import("../logger");
      const parentLogger = createLogger("Parent");
      const childLogger = parentLogger.child("Child");
      
      childLogger.info("Test message");
      
      expect(consoleSpy).toHaveBeenCalled();
      const callArgs = consoleSpy.mock.calls[0];
      expect(callArgs[0]).toContain("[Parent.Child]");
      
      consoleSpy.mockRestore();
    });
  });

  describe("log buffer", () => {
    it("stores log entries in buffer", async () => {
      const { logger, getLogBuffer, clearLogBuffer } = await import("../logger");
      
      clearLogBuffer();
      logger.info("Test message 1");
      logger.warn("Test message 2");
      
      const buffer = getLogBuffer();
      expect(buffer.length).toBe(2);
      expect(buffer[0].message).toBe("Test message 1");
      expect(buffer[1].message).toBe("Test message 2");
    });

    it("clears buffer when clearLogBuffer is called", async () => {
      const { logger, getLogBuffer, clearLogBuffer } = await import("../logger");
      
      logger.info("Test message");
      clearLogBuffer();
      
      const buffer = getLogBuffer();
      expect(buffer.length).toBe(0);
    });
  });

  describe("trackAction", () => {
    it("logs user actions with proper metadata", async () => {
      const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
      
      const { trackAction } = await import("../logger");
      
      trackAction("button_click", { buttonId: "submit" });
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("trackPerformance", () => {
    it("logs performance metrics", async () => {
      const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
      
      const { trackPerformance } = await import("../logger");
      
      trackPerformance("api_call", 150, { endpoint: "/users" });
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
