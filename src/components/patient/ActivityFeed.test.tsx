import * as React from "react";
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AuthProvider } from "@/hooks/useAuth";
import { ActivityFeed } from "@/components/patient/ActivityFeed";

declare global {
  var __SUPABASE_SELECT_MOCK__: unknown;
}

afterEach(() => {
  cleanup();
  delete globalThis.__SUPABASE_SELECT_MOCK__;
});

function renderFeed() {
  return render(
    <AuthProvider>
      <ActivityFeed patientId="patient-1" patientName="Alex Morgan" />
    </AuthProvider>,
  );
}

describe("ActivityFeed", { concurrency: false }, () => {
  it("shows an error and retry control when patient activity fails to load", async () => {
    globalThis.__SUPABASE_SELECT_MOCK__ = () => ({
      data: null,
      error: new Error("activity service unavailable"),
    });

    renderFeed();

    fireEvent.click(screen.getByRole("button", { name: /Activity/i }));

    assert.ok(await screen.findByText(/patient activity could not be loaded/i));
    assert.ok(screen.getByRole("button", { name: /retry/i }));
  });

  it("renders the empty activity state when the activity query succeeds with no rows", async () => {
    globalThis.__SUPABASE_SELECT_MOCK__ = () => ({ data: [], error: null });

    renderFeed();

    fireEvent.click(screen.getByRole("button", { name: /Activity/i }));

    assert.ok(await screen.findByText("No activity yet"));
  });
});
