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
  assert.ok(submitBtn?.textContent?.includes("Sign In") || submitBtn?.textContent?.includes("Create Account"), "Submit button should show Sign In or Create Account");
  assert.ok(emailInput, "Auth page should render an email input");
  assert.ok(passwordInput, "Auth page should render a password input");
  root.unmount();
  document.body.removeChild(div);
});

test("Auth page has toggle between sign in and sign up", async () => {
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
  const signUpLink = Array.from(div.querySelectorAll("button")).find((b) => b.textContent?.toLowerCase().includes("sign up"));
  assert.ok(signUpLink || div.textContent?.includes("Sign up") || div.textContent?.includes("sign up"), "Auth page should show sign up / sign in toggle");
  root.unmount();
  document.body.removeChild(div);
});
