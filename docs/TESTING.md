# Testing Guide

This document describes the testing infrastructure and best practices for Round Robin Notes.

## Overview

The testing stack uses:

- **Vitest** - Modern, fast test runner
- **React Testing Library** - Component testing utilities
- **MSW (Mock Service Worker)** - API mocking
- **Custom Mocks** - Supabase and browser API mocks

## Running Tests

```bash
# Run tests in watch mode
npm test

# Run tests once
npm test -- --run

# Run with coverage
npm test -- --coverage

# Run specific file
npm test -- useAuth.test.tsx

# Run with UI
npm test -- --ui
```

## Test Structure

```
src/
├── test/
│   ├── setup.ts              # Test environment setup
│   ├── utils.tsx             # Test utilities and wrappers
│   ├── mocks/
│   │   ├── server.ts         # MSW server setup
│   │   ├── handlers.ts       # API request handlers
│   │   ├── data.ts           # Mock data
│   │   └── supabase.ts       # Supabase client mock
│   └── __tests__/            # (optional) Global tests
├── hooks/
│   └── __tests__/            # Hook tests
├── components/
│   └── __tests__/            # Component tests
└── services/
    └── __tests__/            # Service tests
```

## Writing Tests

### Hook Tests

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAuth } from '../useAuth';
import { createHookWrapper } from '@/test/utils';

describe('useAuth', () => {
  it('should authenticate user', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: createHookWrapper().wrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeDefined();
  });
});
```

### Component Tests

```typescript
import { describe, it, expect } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { render } from '@/test/utils';
import { PatientCard } from '@/components/PatientCard';

describe('PatientCard', () => {
  it('should display patient name', () => {
    render(<PatientCard patient={mockPatient} />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should call onEdit when edit button clicked', () => {
    const onEdit = vi.fn();
    render(<PatientCard patient={mockPatient} onEdit={onEdit} />);
    
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    
    expect(onEdit).toHaveBeenCalledWith(mockPatient.id);
  });
});
```

### Testing with API Mocks

```typescript
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';

describe('usePatients', () => {
  it('should handle API errors', async () => {
    // Override default handler for this test
    server.use(
      http.get('/rest/v1/patients', () => {
        return HttpResponse.json(
          { error: 'Database error' },
          { status: 500 }
        );
      })
    );

    const { result } = renderHook(() => usePatients(), {
      wrapper: createHookWrapper().wrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.patients).toEqual([]);
  });
});
```

## Mock Data

Use the mock data from `src/test/mocks/data.ts`:

```typescript
import { mockUser, mockPatients, mockClinicalPhrases } from '@/test/mocks/data';

// Use in tests
render(<PatientList patients={mockPatients} />);
```

## Custom Renders

The test utilities provide custom renders with all providers:

```typescript
import { render, createHookWrapper } from '@/test/utils';

// Component render with all providers
const { user } = render(<MyComponent />);

// Hook render with providers
const { wrapper, queryClient } = createHookWrapper();
```

## Testing React Query

```typescript
import { waitFor } from '@testing-library/react';

describe('usePatientMutations', () => {
  it('should update patient', async () => {
    const { result } = renderHook(() => usePatientMutations(...), {
      wrapper: createHookWrapper().wrapper,
    });

    // Execute mutation
    act(() => {
      result.current.updatePatient('patient-1', 'name', 'New Name');
    });

    // Wait for mutation to complete
    await waitFor(() => {
      expect(result.current.patients[0].name).toBe('New Name');
    });
  });
});
```

## Testing Async Operations

```typescript
describe('useOfflineSync', () => {
  it('should sync when coming online', async () => {
    const { result } = renderHook(() => useOfflineSync(), {
      wrapper: createHookWrapper().wrapper,
    });

    // Simulate going online
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(result.current.isOnline).toBe(true);
    });
  });
});
```

## Mocking Browser APIs

Browser APIs are automatically mocked in `test/setup.ts`:

- `IntersectionObserver`
- `matchMedia`
- `ResizeObserver`
- `crypto.randomUUID`

### Custom Browser Mock

```typescript
// In test file
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: false,
});
```

## Testing Error Boundaries

```typescript
import { ErrorBoundary } from '@/components/ErrorBoundary';

const ThrowError = () => {
  throw new Error('Test error');
};

describe('ErrorBoundary', () => {
  it('should catch errors and show fallback', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});
```

## Coverage

View coverage report:

```bash
npm test -- --coverage
```

Coverage outputs:
- Console summary
- HTML report in `coverage/` directory

## Best Practices

1. **Test behavior, not implementation** - Use user-centric queries
2. **Use `screen` for queries** - More maintainable
3. **Prefer `userEvent` over `fireEvent`** - Closer to user behavior
4. **Mock at the right level** - MSW for API, mocks for complex dependencies
5. **Use `waitFor` for async** - Don't use arbitrary timeouts
6. **Clean up in `afterEach`** - MSW handlers reset automatically
7. **Test error states** - Don't just test the happy path
8. **Use meaningful test descriptions** - Describe what should happen

## Common Patterns

### Testing Loading States

```typescript
it('should show loading state', async () => {
  const { result } = renderHook(() => usePatients());
  
  expect(result.current.loading).toBe(true);
  
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });
});
```

### Testing Form Submission

```typescript
it('should submit form', async () => {
  const onSubmit = vi.fn();
  render(<PatientForm onSubmit={onSubmit} />);
  
  await userEvent.type(screen.getByLabelText('Name'), 'John Doe');
  await userEvent.click(screen.getByRole('button', { name: /save/i }));
  
  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledWith({ name: 'John Doe' });
  });
});
```

### Testing Hooks with Context

```typescript
const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
};

it('should access auth context', async () => {
  const queryClient = createTestQueryClient();
  
  const { result } = renderHook(() => useAuth(), {
    wrapper: createWrapper(queryClient),
  });
  
  // Test with authenticated user
});
```

## Debugging Tests

```bash
# Debug a specific test
npm test -- --reporter=verbose useAuth

# Debug with UI
npm test -- --ui

# Debug in browser
npm test -- --inspect-brk
```

## Troubleshooting

### "Unable to find element" errors

- Check if element is async - use `waitFor` or `findBy`
- Verify query selector is correct
- Check if component is properly rendered

### "act()" warnings

- Wrap state updates in `act()`
- Use `waitFor` for async assertions
- Update React Testing Library

### Mock not working

- Verify mock is defined before imports
- Check if MSW handler is registered
- Ensure server is started in test setup

## Related Documentation

- [API Contracts](./API_CONTRACTS.md)
- [Observability](./OBSERVABILITY.md)
- [Vitest Docs](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [MSW Docs](https://mswjs.io/)
