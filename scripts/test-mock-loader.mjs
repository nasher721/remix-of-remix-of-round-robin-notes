/**
 * Test mock loader: mocks use-notifications so patient hooks run without real toasts.
 * Hook tests that need a user must set __SUPABASE_AUTH_MOCK__.getSession and wrap with AuthProvider.
 */
function isUseNotifications(url) {
  const pathname = url.replace(/^file:\/\//, "");
  return pathname.includes("hooks/use-notifications") && (pathname.endsWith(".tsx") || pathname.endsWith(".ts"));
}

export async function load(url, context, defaultLoad) {
  const normalized = url.split("?")[0];

  if (isUseNotifications(normalized)) {
    const mockSource = `
export function useNotifications() {
  return {
    success: () => {},
    error: () => {},
    warning: () => {},
    info: () => {},
  };
}
`;
    return { format: "module", source: mockSource, shortCircuit: true };
  }

  return defaultLoad(url, context);
}
