import test from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { createRoot } from "react-dom/client";

// DOM is provided by scripts/test-setup.mjs (jsdom) when running via npm test
if (typeof global.window !== "undefined" && typeof global.window.requestAnimationFrame === "undefined") {
  global.window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
}

test("useAuth throws when used outside AuthProvider", async () => {
  globalThis.__SUPABASE_AUTH_MOCK__ = { getSession: async () => ({ data: { session: null }, error: null }), onAuthStateChange: () => ({ unsubscribe: () => {} }) };
  const { useAuth } = await import("@/hooks/useAuth");
  const Comp = () => {
    useAuth();
    return null;
  };
  class ErrorBoundary extends React.Component<{ children: React.ReactNode; onError: (e: Error) => void }, { error: Error | null }> {
    state = { error: null as Error | null };
    static getDerivedStateFromError(error: Error) {
      return { error };
    }
    componentDidCatch(error: Error) {
      this.props.onError(error);
    }
    render() {
      if (this.state.error) return null;
      return this.props.children;
    }
  }
  let caught: Error | null = null;
  const div = document.createElement("div");
  const root = createRoot(div);
  root.render(
    <ErrorBoundary onError={(e) => { caught = e; }}>
      <Comp />
    </ErrorBoundary>
  );
  await new Promise((r) => setTimeout(r, 80));
  root.unmount();
  assert.ok(caught?.message?.includes("AuthProvider"), "useAuth should throw when used outside AuthProvider");
});

test("useAuth: when no session, user is null and loading becomes false", async () => {
  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ unsubscribe: () => {} }),
  };
  const { useAuth, AuthProvider } = await import("@/hooks/useAuth");
  let captured = { user: undefined, loading: true };
  const Capture = () => {
    const auth = useAuth();
    captured = { user: auth.user, loading: auth.loading };
    return null;
  };
  const div = document.createElement("div");
  const root = createRoot(div);
  root.render(
    <AuthProvider>
      <Capture />
    </AuthProvider>
  );
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(captured.user, null);
  assert.equal(captured.loading, false);
});

test("useAuth: when mock returns a session, user is set", async () => {
  const mockUser = { id: "user-1", email: "test@example.com" };
  const mockSession = { user: mockUser };
  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: mockSession }, error: null }),
    onAuthStateChange: () => ({ unsubscribe: () => {} }),
  };
  const { useAuth, AuthProvider } = await import("@/hooks/useAuth");
  let captured = { user: null };
  const Capture = () => {
    const auth = useAuth();
    captured = { user: auth.user };
    return null;
  };
  const div = document.createElement("div");
  const root = createRoot(div);
  root.render(
    <AuthProvider>
      <Capture />
    </AuthProvider>
  );
  await new Promise((r) => setTimeout(r, 120));
  assert.ok(captured.user, "user should be set from mock session");
  assert.equal(captured.user?.id, "user-1");
  assert.equal(captured.user?.email, "test@example.com");
});

test("useAuth: signOut clears user when listener fires", async () => {
  const mockUser = { id: "user-2", email: "u2@example.com" };
  let authStateCallback = null;
  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: { user: mockUser } }, error: null }),
    onAuthStateChange: (cb) => {
      authStateCallback = cb;
      return { unsubscribe: () => {} };
    },
    signOut: async () => {
      if (authStateCallback) authStateCallback("SIGNED_OUT", null);
    },
  };
  const { useAuth, AuthProvider } = await import("@/hooks/useAuth");
  let captured = { user: null };
  const Capture = () => {
    const auth = useAuth();
    captured = { user: auth.user, signOut: auth.signOut };
    return null;
  };
  const div = document.createElement("div");
  const root = createRoot(div);
  root.render(
    <AuthProvider>
      <Capture />
    </AuthProvider>
  );
  await new Promise((r) => setTimeout(r, 120));
  assert.ok(captured.user, "user should be set before signOut");
  await captured.signOut();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(captured.user, null, "user should be cleared after signOut");
});
