import * as React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { IBCCProvider } from "@/contexts/IBCCContext";
import { ClinicalGuidelinesProvider } from "@/contexts/ClinicalGuidelinesContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import PrintExportTest from "./pages/PrintExportTest";
import FHIRCallback from "./pages/FHIRCallback";
import { ThemeProvider } from "@/components/theme-provider";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import { SkipToContent } from "@/components/SkipToContent";

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
                    <SkipToContent />
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/fhir/callback" element={<FHIRCallback />} />
                      {import.meta.env.DEV && (
                        <Route path="/__print-export-test" element={<PrintExportTest />} />
                      )}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
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
