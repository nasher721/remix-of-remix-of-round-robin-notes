/**
 * Test-only loader: serves a mock Supabase client for @/integrations/supabase/client
 * so auth and hook tests run without real network. Configure via globalThis.__SUPABASE_AUTH_MOCK__.
 * Insert/update calls are captured on globalThis.__supabaseInsertCapture / __supabaseUpdateCapture.
 */
const MOCK_SPECIFIER = "file:///supabase-client-mock.js";
const LOGGER_MOCK_SPECIFIER = "file:///observability-logger-mock.js";
const LOGGER_MOCK_SOURCE = `
export function logError() {}
export function logWarn() {}
export function logInfo() {}
export function logMetric() {}
`;
const ASSET_PNG_MOCK_SOURCE = "export default '/test.png';";
const PATIENT_FIXTURE = {
  id: "test-patient-id",
  patient_number: 1,
  name: "",
  bed: "",
  clinical_summary: "",
  interval_events: "",
  imaging: "",
  labs: "",
  systems: {},
  medications: {},
  field_timestamps: {},
  collapsed: false,
  created_at: "2024-01-01T00:00:00Z",
  last_modified: null,
  user_id: "test-user-id",
};
const MOCK_SOURCE = `
export const hasSupabaseConfig = true;
export const supabaseUrl = "http://test";
export const resolvedKey = "test-key";
const insertCapture = (globalThis.__supabaseInsertCapture = globalThis.__supabaseInsertCapture || []);
const updateCapture = (globalThis.__supabaseUpdateCapture = globalThis.__supabaseUpdateCapture || []);
const fixture = ${JSON.stringify(PATIENT_FIXTURE)};

export const supabase = {
  from(table) {
    return {
      insert(rows) {
        insertCapture.push({ table, rows });
        return { select: () => ({ single: () => Promise.resolve({ data: fixture, error: null }) }) };
      },
      update(data) {
        updateCapture.push({ table, data });
        return { eq: () => Promise.resolve({ error: null }) };
      },
      delete() {
        return { eq: () => Promise.resolve({ error: null }) };
      },
    };
  },
  auth: {
    getSession: async () => (globalThis.__SUPABASE_AUTH_MOCK__?.getSession?.() ?? { data: { session: null }, error: null }),
    onAuthStateChange: (cb) => {
      (async () => {
        const res = await (globalThis.__SUPABASE_AUTH_MOCK__?.getSession?.() ?? Promise.resolve({ data: { session: null } }));
        setTimeout(() => cb("INITIAL_SESSION", res?.data?.session ?? null));
      })();
      const sub = globalThis.__SUPABASE_AUTH_MOCK__?.onAuthStateChange?.(cb) ?? { unsubscribe: () => {} };
      return { data: { subscription: sub } };
    },
    signInWithPassword: async (opts) => (globalThis.__SUPABASE_AUTH_MOCK__?.signInWithPassword?.(opts) ?? { error: null }),
    signUp: async (opts) => (globalThis.__SUPABASE_AUTH_MOCK__?.signUp?.(opts) ?? { error: null }),
    signOut: async () => { await (globalThis.__SUPABASE_AUTH_MOCK__?.signOut?.() ?? Promise.resolve()); },
  },
};
`;

export async function resolve(specifier, context, defaultResolve) {
  const norm = (specifier || "").replace(/\\/g, "/");
  if (norm === "@/integrations/supabase/client" || norm.endsWith("integrations/supabase/client") || norm.includes("integrations/supabase/client")) {
    return { url: MOCK_SPECIFIER, shortCircuit: true };
  }
  if (norm.endsWith(".png") || (norm.includes("assets/") && norm.includes(".png"))) {
    return { url: "file:///asset-png-mock.js", shortCircuit: true };
  }
  if (norm === "@/lib/observability/logger" || (norm.includes("observability/logger") && !norm.includes("telemetry"))) {
    return { url: LOGGER_MOCK_SPECIFIER, shortCircuit: true };
  }
  const parent = (context.parentURL || "").replace(/\\/g, "/");
  if ((specifier === "./logger" || specifier === "../logger") && parent.includes("observability/telemetry")) {
    return { url: LOGGER_MOCK_SPECIFIER, shortCircuit: true };
  }
  return defaultResolve(specifier, context);
}

function isClientModuleUrl(url) {
  if (!url || typeof url !== "string") return false;
  const p = url.replace(/^file:\/\//, "").replace(/\\/g, "/");
  return p.includes("integrations/supabase/client");
}

function isLoggerModuleUrl(url) {
  const p = url.replace(/^file:\/\//, "").replace(/\\/g, "/");
  return (p.includes("observability/logger") && (p.endsWith("logger.ts") || p.endsWith("logger.tsx"))) || p.endsWith("observability-logger-mock.js");
}

export async function load(url, context, defaultLoad) {
  if (url === MOCK_SPECIFIER || isClientModuleUrl(url)) {
    return { format: "module", source: MOCK_SOURCE, shortCircuit: true };
  }
  if (url === LOGGER_MOCK_SPECIFIER || (isLoggerModuleUrl(url) && url !== LOGGER_MOCK_SPECIFIER)) {
    return { format: "module", source: LOGGER_MOCK_SOURCE, shortCircuit: true };
  }
  if (url === "file:///asset-png-mock.js" || (url && url.replace(/^file:\/\//, "").replace(/\\/g, "/").endsWith(".png"))) {
    return { format: "module", source: ASSET_PNG_MOCK_SOURCE, shortCircuit: true };
  }
  return defaultLoad(url, context, defaultLoad);
}
