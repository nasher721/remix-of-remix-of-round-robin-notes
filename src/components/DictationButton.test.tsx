import * as React from "react";
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AuthProvider } from "@/hooks/useAuth";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { DictationButton } from "@/components/DictationButton";

declare global {
  var __SUPABASE_AUTH_MOCK__: unknown;
}

afterEach(() => {
  cleanup();
  delete globalThis.__SUPABASE_AUTH_MOCK__;
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: undefined,
  });
});

function setupAuthMock() {
  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: { user: { id: "test-user-id" } } }, error: null }),
    onAuthStateChange: () => ({ unsubscribe: () => {} }),
  };
}

function renderButton() {
  setupAuthMock();
  return render(
    <AuthProvider>
      <SettingsProvider>
        <DictationButton onTranscript={() => {}} />
      </SettingsProvider>
    </AuthProvider>,
  );
}

describe("DictationButton", { concurrency: false }, () => {
  it("shows visible recovery guidance when microphone permission is denied", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw new DOMException("Permission denied by test browser", "NotAllowedError");
        },
      },
    });

    renderButton();
    // Let the auth-owned SettingsProvider settle before interacting. Its owner
    // key intentionally remounts descendants when the restored user arrives.
    await new Promise((resolve) => setTimeout(resolve, 80));

    fireEvent.click(screen.getByRole("button", { name: "Start voice dictation" }));

    assert.ok(await screen.findByText(/allow microphone access/i));
    assert.ok(screen.getByRole("button", { name: "Start voice dictation" }));
  });
});
