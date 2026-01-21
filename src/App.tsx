import * as React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { IBCCProvider } from "@/contexts/IBCCContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { ErrorBoundary, PageErrorFallback } from "@/components/ErrorBoundary";
import { PageLoadingFallback } from "@/components/LoadingFallback";
import { SkipLinks, AnnouncerProvider } from "@/components/Accessibility";
import { initWebVitals } from "@/lib/performance";

// Initialize performance monitoring
if (typeof window !== 'undefined') {
  initWebVitals();
}

// Lazy load route components for code splitting
const Index = React.lazy(() => import("./pages/Index"));
const Auth = React.lazy(() => import("./pages/Auth"));
const NotFound = React.lazy(() => import("./pages/NotFound"));

// Create stable QueryClient outside component to survive HMR - v2
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

function App(): React.ReactElement {
  return (
    <ErrorBoundary fallback={PageErrorFallback}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SettingsProvider>
            <IBCCProvider>
              <AnnouncerProvider>
                <TooltipProvider>
                  <SkipLinks />
                  <Toaster />
                  <Sonner />
                  <BrowserRouter>
                    <React.Suspense fallback={<PageLoadingFallback />}>
                      <Routes>
                        <Route path="/" element={<Index />} />
                        <Route path="/auth" element={<Auth />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </React.Suspense>
                  </BrowserRouter>
                </TooltipProvider>
              </AnnouncerProvider>
            </IBCCProvider>
          </SettingsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
