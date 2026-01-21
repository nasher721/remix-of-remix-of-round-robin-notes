/**
 * Test Utilities and Helpers
 * 
 * Provides common testing utilities, custom renders, and mock factories.
 */

import * as React from "react";
import { render, RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Patient, PatientSystems, PatientMedications } from "@/types/patient";

/**
 * Create a test QueryClient with disabled retries
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * All providers wrapper for testing
 */
interface AllProvidersProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
}

function AllProviders({ children, queryClient }: AllProvidersProps): React.ReactElement {
  const client = queryClient ?? createTestQueryClient();

  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <TooltipProvider>{children}</TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

/**
 * Custom render function that wraps components with all providers
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper"> & { queryClient?: QueryClient }
): ReturnType<typeof render> {
  const { queryClient, ...renderOptions } = options ?? {};

  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders queryClient={queryClient}>{children}</AllProviders>
    ),
    ...renderOptions,
  });
}

/**
 * Factory for creating mock Patient objects
 */
export function createMockPatient(overrides: Partial<Patient> = {}): Patient {
  const defaultSystems: PatientSystems = {
    neuro: "",
    cv: "",
    resp: "",
    renalGU: "",
    gi: "",
    endo: "",
    heme: "",
    infectious: "",
    skinLines: "",
    dispo: "",
  };

  const defaultMedications: PatientMedications = {
    infusions: [],
    scheduled: [],
    prn: [],
    rawText: "",
  };

  return {
    id: `test-patient-${Math.random().toString(36).substring(7)}`,
    patientNumber: 1,
    name: "Test Patient",
    bed: "101A",
    clinicalSummary: "Test clinical summary",
    intervalEvents: "",
    imaging: "",
    labs: "",
    systems: defaultSystems,
    medications: defaultMedications,
    fieldTimestamps: {},
    collapsed: false,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Factory for creating mock user objects
 */
export function createMockUser(overrides: Partial<{ id: string; email: string }> = {}) {
  return {
    id: `test-user-${Math.random().toString(36).substring(7)}`,
    email: "test@example.com",
    ...overrides,
  };
}

/**
 * Wait for async operations to complete
 */
export async function waitForAsync(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// Re-export everything from testing-library
export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
