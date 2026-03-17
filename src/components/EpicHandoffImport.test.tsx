import test from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { EpicHandoffImport } from "@/components/EpicHandoffImport";
import { AuthProvider } from "@/hooks/useAuth";
import { SettingsProvider } from "@/contexts/SettingsContext";

const authWrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(AuthProvider, null, React.createElement(SettingsProvider, null, children));

function setupAuthMock() {
  (globalThis as unknown as {
    __SUPABASE_AUTH_MOCK__?: {
      getSession: () => Promise<{ data: { session: { user: { id: string } } }; error: null }>;
      onAuthStateChange: () => { unsubscribe: () => void };
    };
  }).__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: { user: { id: "test-user-id" } } }, error: null }),
    onAuthStateChange: () => ({ unsubscribe: () => {} }),
  };
}

function setClipboard(textOrError: string | Error) {
  Object.defineProperty(globalThis.navigator, "clipboard", {
    configurable: true,
    value: {
      readText: async () => {
        if (textOrError instanceof Error) throw textOrError;
        return textOrError;
      },
    },
  });
}

test.afterEach(() => {
  cleanup();
  (globalThis as unknown as { __SUPABASE_FUNCTIONS_INVOKE_MOCK__?: unknown }).__SUPABASE_FUNCTIONS_INVOKE_MOCK__ = undefined;
  delete (globalThis as unknown as { __SUPABASE_AUTH_MOCK__?: unknown }).__SUPABASE_AUTH_MOCK__;
});

test("clipboard import does not invoke parse when clipboard content is empty", async () => {
  setupAuthMock();
  setClipboard("");

  let invokeCount = 0;
  (globalThis as unknown as {
    __SUPABASE_FUNCTIONS_INVOKE_MOCK__?: (name: string) => Promise<unknown>;
  }).__SUPABASE_FUNCTIONS_INVOKE_MOCK__ = async () => {
    invokeCount += 1;
    return { data: { success: true, data: { patients: [] } }, error: null };
  };

  render(
    React.createElement(EpicHandoffImport, {
      existingBeds: [],
      onImportPatients: async () => {},
      noDialog: true,
    }),
    { wrapper: authWrapper },
  );

  fireEvent.click(screen.getByText("Paste Content"));

  await waitFor(() => {
    assert.equal(invokeCount, 0);
  });
});

test("parsed patients are selectable and duplicate bed warning is shown", async () => {
  setupAuthMock();
  setClipboard("Epic handoff text that is definitely long enough to parse and includes multiple patients for testing.");

  (globalThis as unknown as {
    __SUPABASE_FUNCTIONS_INVOKE_MOCK__?: (name: string) => Promise<unknown>;
  }).__SUPABASE_FUNCTIONS_INVOKE_MOCK__ = async () => ({
    data: {
      success: true,
      data: {
        patients: [
          {
            bed: "A1",
            name: "Patient One",
            mrn: "111",
            age: "65",
            sex: "M",
            handoffSummary: "Summary one",
            intervalEvents: "Events one",
            systems: {
              neuro: "", cv: "", resp: "", renalGU: "", gi: "", endo: "", heme: "", infectious: "", skinLines: "", dispo: "",
            },
          },
          {
            bed: "B2",
            name: "Patient Two",
            mrn: "222",
            age: "72",
            sex: "F",
            handoffSummary: "Summary two",
            intervalEvents: "",
            systems: {
              neuro: "", cv: "", resp: "", renalGU: "", gi: "", endo: "", heme: "", infectious: "", skinLines: "", dispo: "",
            },
          },
        ],
      },
    },
    error: null,
  });

  render(
    React.createElement(EpicHandoffImport, {
      existingBeds: ["A1"],
      onImportPatients: async () => {},
      noDialog: true,
    }),
    { wrapper: authWrapper },
  );

  fireEvent.click(screen.getByText("Paste Content"));

  await screen.findByText("2 patients found");
  assert.ok(screen.getByText("Bed exists"));
  assert.ok(screen.getByText("2 selected"));

  fireEvent.click(screen.getByText("Patient One"));
  await waitFor(() => {
    assert.ok(screen.getByText("1 selected"));
  });
});
