import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { createOptimizedQueryClient } from "@/lib/cache/queryClientConfig";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { IBCCProvider } from "@/contexts/IBCCContext";
import { ClinicalGuidelinesProvider } from "@/contexts/ClinicalGuidelinesContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Lazy-load secondary routes to reduce initial bundle
const Auth = React.lazy(() => import("./pages/Auth"));
const FHIRCallback = React.lazy(() => import("./pages/FHIRCallback"));
const PrintExportTest = React.lazy(() => import("./pages/PrintExportTest"));
import { ThemeProvider } from "@/components/theme-provider";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import { SkipToContent } from "@/components/SkipToContent";
import { UnifiedAIChatbot } from "@/components/UnifiedAIChatbot";
import { CurrentPatientsProvider } from "@/contexts/CurrentPatientsContext";
import { preloadClinicalData } from "@/lib/lazyData";

// Preload clinical data in background after initial render
preloadClinicalData();

// Use optimized QueryClient (cache metrics, CACHE_CONFIG, structural sharing)
const queryClient = createOptimizedQueryClient();

function App(): React.ReactElement {
  return (
    <GlobalErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <AuthProvider>
          <SettingsProvider>
            <IBCCProvider>
              <ClinicalGuidelinesProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <BrowserRouter>
                    <CurrentPatientsProvider>
                      <SkipToContent />
                      <UnifiedAIChatbot />
                      <React.Suspense fallback={
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center justify-center h-screen"
                        role="status"
                        aria-live="polite"
                        aria-busy="true"
                        aria-label="Loading page"
                      >
                        <span className="sr-only">Loading page, please wait…</span>
                        <span aria-hidden="true" className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0ms' }} />
                          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '150ms' }} />
                          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '300ms' }} />
                        </span>
                      </motion.div>
                    }>
                      <AnimatePresence mode="wait">
                        <Routes locationKey="location">
                          <Route path="/" element={<Index />} />
                          <Route path="/auth" element={<Auth />} />
                          <Route path="/fhir/callback" element={<FHIRCallback />} />
                          {import.meta.env.DEV && (
                            <Route path="/__print-export-test" element={<PrintExportTest />} />
                          )}
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </AnimatePresence>
                    </React.Suspense>
                    </CurrentPatientsProvider>
                  </BrowserRouter>
                </TooltipProvider>
              </ClinicalGuidelinesProvider>
            </IBCCProvider>
          </SettingsProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
    </GlobalErrorBoundary>
  );
}

export default App;
