/**
 * ErrorBoundary Component Tests
 */

import * as React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as testingLib from "@testing-library/react";
import { ErrorBoundary, PageErrorFallback, ComponentErrorFallback, DataErrorFallback } from "../ErrorBoundary";

const { render } = testingLib;

// Component that throws an error
function ThrowingComponent({ shouldThrow = true }: { shouldThrow?: boolean }): React.ReactElement | null {
  if (shouldThrow) {
    throw new Error("Test error message");
  }
  return <div>No error</div>;
}

// Suppress console errors during tests
const originalError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalError;
});

describe("ErrorBoundary", () => {
  it("renders children when there is no error", () => {
    const { getByText } = render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );
    expect(getByText("Test content")).toBeDefined();
  });

  it("renders fallback UI when there is an error", () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    );
    expect(getByText("Something went wrong")).toBeDefined();
  });
});

describe("PageErrorFallback", () => {
  it("renders error message", () => {
    const { getByText } = render(
      <PageErrorFallback error={new Error("Page error")} resetErrorBoundary={vi.fn()} />
    );
    expect(getByText("Something went wrong")).toBeDefined();
  });
});

describe("ComponentErrorFallback", () => {
  it("renders compact error UI", () => {
    const { getByText } = render(
      <ComponentErrorFallback error={new Error("Component error")} resetErrorBoundary={vi.fn()} />
    );
    expect(getByText("Component Error")).toBeDefined();
  });
});

describe("DataErrorFallback", () => {
  it("renders data loading error UI", () => {
    const { getByText } = render(
      <DataErrorFallback error={new Error("Data error")} resetErrorBoundary={vi.fn()} />
    );
    expect(getByText("Unable to load data")).toBeDefined();
  });
});
