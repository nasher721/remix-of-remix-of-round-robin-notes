import * as React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { createOptimizedQueryClient } from "@/lib/cache/queryClientConfig";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { IBCCProvider } from "@/contexts/IBCCContext";
import { ClinicalGuidelinesProvider } from "@/contexts/ClinicalGuidelinesContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { TeamProvider } from "@/contexts/TeamContext";
import { DashboardLayoutProvider } from "@/context/DashboardLayoutContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Privacy from "./pages/Privacy";
import Security from "./pages/Security";
import FHIRCallback from "./pages/FHIRCallback";
import PrintExportTest from "./pages/PrintExportTest";
import { ThemeProvider } from "@/components/theme-provider";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import { SkipToContent } from "@/components/SkipToContent";
import { UnifiedAIChatbot } from "@/components/UnifiedAIChatbot";
import { CurrentPatientsProvider } from "@/contexts/CurrentPatientsContext";
import { preloadClinicalData } from "@/lib/lazyData";
import { NavigationBreadcrumbTracker } from "@/components/observability/NavigationBreadcrumbTracker";
import { LazyPanelErrorBoundary } from "@/components/LazyPanelErrorBoundary";
import { AnnouncerProvider, useAnnouncerContext, LiveRegion } from "@/hooks/useAnnouncer";

// Auth, FHIR callback, and print test are static imports so route modules always load
// with the app graph. Lazy route chunks can fail to resolve (e.g. stale SW caches in prod,
// or headless automation / some embedded browsers), leaving Suspense stuck on the fallback.

/** Dev-only: Agentation visual feedback toolbar (not bundled in production). */
const DevAgentationOverlay = import.meta.env.DEV
  ? React.lazy(() =>
      import("@/dev/AgentationDevOverlay").then((m) => ({
        default: m.AgentationDevOverlay,
      }))
    )
  : null

// Preload clinical data in background after initial render
preloadClinicalData();

// Use optimized QueryClient (cache metrics, CACHE_CONFIG, structural sharing)
const queryClient = createOptimizedQueryClient();

function AppRoutesShell(): React.ReactElement {
  const location = useLocation();
  return (
    <LazyPanelErrorBoundary title="Failed to load page">
      {/*
        Do not wrap <Routes> in AnimatePresence: the animated child must be the
        transitioning page, not the Router. Route-level transitions live in
        page-transition / layout components instead.
      */}
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/security" element={<Security />} />
        <Route path="/fhir/callback" element={<FHIRCallback />} />
        {import.meta.env.DEV && (
          <Route path="/__print-export-test" element={<PrintExportTest />} />
        )}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </LazyPanelErrorBoundary>
  );
}

function AppContent(): React.ReactElement {
  const { announce } = useAnnouncerContext();
  return (
    <>
      <LiveRegionWrapper />
      <NavigationBreadcrumbTracker />
      <CurrentPatientsProvider>
        <SkipToContent />
        <UnifiedAIChatbot />
        {DevAgentationOverlay ? (
          <React.Suspense fallback={null}>
            <DevAgentationOverlay />
          </React.Suspense>
        ) : null}
        <AppRoutesShell />
      </CurrentPatientsProvider>
    </>
  );
}

function LiveRegionWrapper(): React.ReactElement {
  const { announce } = useAnnouncerContext();
  const [message, setMessage] = React.useState("");
  
  React.useEffect(() => {
    (window as unknown as { __announce?: typeof announce }).__announce = (msg: string) => setMessage(msg);
    return () => {
      delete (window as unknown as { __announce?: typeof announce }).__announce;
    };
  }, [announce]);
  
  return <LiveRegion message={message} priority="polite" />;
}

function App(): React.ReactElement {
  return (
    <GlobalErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <AuthProvider>
          <TeamProvider>
            <SettingsProvider>
              <DashboardLayoutProvider>
              <IBCCProvider>
                <ClinicalGuidelinesProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner position="top-right" />
                  <AnnouncerProvider>
                    <BrowserRouter>
                      <AppContent />
                    </BrowserRouter>
                  </AnnouncerProvider>
                </TooltipProvider>
              </ClinicalGuidelinesProvider>
            </IBCCProvider>
            </DashboardLayoutProvider>
            </SettingsProvider>
          </TeamProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}

export default App;
