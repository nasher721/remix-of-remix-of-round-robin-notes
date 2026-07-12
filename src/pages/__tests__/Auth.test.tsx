import test from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Auth from "@/pages/Auth";

// DOM and requestAnimationFrame from scripts/test-setup.mjs when run via npm test
if (typeof globalThis !== "undefined") {
  Object.assign(globalThis, { React })
}

test("Auth page renders with form and sign-in button", async () => {
  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ unsubscribe: () => {} }),
  };
  const div = document.createElement("div");
  document.body.appendChild(div);
  const root = createRoot(div);
  root.render(
    <MemoryRouter>
      <AuthProvider>
        <Auth />
      </AuthProvider>
    </MemoryRouter>
  );
  await new Promise((r) => setTimeout(r, 80));
  const form = div.querySelector("form");
  const submitBtn = div.querySelector('button[type="submit"]');
  const emailInput = div.querySelector('input[type="email"], input[id="email"]');
  const passwordInput = div.querySelector('input[type="password"], input[id="password"]');
  assert.ok(form, "Auth page should render a form");
  assert.ok(submitBtn, "Auth page should render a submit button");
  const submitText = submitBtn?.textContent?.toLowerCase() ?? "";
  assert.ok(
    submitText.includes("sign in"),
    "Submit button should show Sign in",
  );
  assert.ok(emailInput, "Auth page should render an email input");
  assert.ok(passwordInput, "Auth page should render a password input");
  root.unmount();
  document.body.removeChild(div);
});

test("Auth page does not expose self-service sign up", async () => {
  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ unsubscribe: () => {} }),
  };
  const div = document.createElement("div");
  document.body.appendChild(div);
  const root = createRoot(div);
  root.render(
    <MemoryRouter>
      <AuthProvider>
        <Auth />
      </AuthProvider>
    </MemoryRouter>
  );
  await new Promise((r) => setTimeout(r, 80));
  const signUpControl = Array.from(div.querySelectorAll("button")).find((button) =>
    button.textContent?.toLowerCase().includes("sign up")
  );
  assert.equal(signUpControl, undefined, "Auth page must not expose self-service sign up");
  assert.match(div.textContent ?? "", /provisioned by your administrator/i);
  root.unmount();
  document.body.removeChild(div);
});
