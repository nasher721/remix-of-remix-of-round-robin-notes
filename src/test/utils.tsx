import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';

// Create a fresh QueryClient for each test
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface AllTheProvidersProps {
  children: React.ReactNode;
  initialEntries?: string[];
}

export function AllTheProviders({ children, initialEntries }: AllTheProvidersProps) {
  const testQueryClient = createTestQueryClient();

  const Router = initialEntries ? (
    <MemoryRouter initialEntries={initialEntries} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {children}
    </MemoryRouter>
  ) : (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      {children}
    </BrowserRouter>
  );

  return (
    <QueryClientProvider client={testQueryClient}>
      {Router}
    </QueryClientProvider>
  );
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[];
  queryClient?: QueryClient;
}

function customRender(
  ui: ReactElement,
  { queryClient, initialEntries, ...options }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    const testQueryClient = queryClient || createTestQueryClient();

    const Router = initialEntries ? (
      <MemoryRouter initialEntries={initialEntries} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {children}
      </MemoryRouter>
    ) : (
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {children}
      </BrowserRouter>
    );

    return (
      <QueryClientProvider client={testQueryClient}>
        {Router}
      </QueryClientProvider>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...options }),
    queryClient: queryClient || createTestQueryClient(),
  };
}

// Hook testing utility
export function createHookWrapper(initialEntries?: string[]) {
  const testQueryClient = createTestQueryClient();

  return {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={testQueryClient}>
        {initialEntries ? (
          <MemoryRouter initialEntries={initialEntries} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            {children}
          </MemoryRouter>
        ) : (
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            {children}
          </BrowserRouter>
        )}
      </QueryClientProvider>
    ),
    queryClient: testQueryClient,
  };
}

// Re-export everything from RTL
export * from '@testing-library/react';
export { customRender as render };
