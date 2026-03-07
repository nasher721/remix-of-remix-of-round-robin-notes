import { vi } from 'vitest';
import { mockUser, mockPatients } from './data';

// Mock Supabase client
export const mockSupabaseClient = {
  auth: {
    getSession: vi.fn().mockResolvedValue({
      data: { session: { user: mockUser, access_token: 'mock-token' } },
      error: null,
    }),
    getUser: vi.fn().mockResolvedValue({
      data: { user: mockUser },
      error: null,
    }),
    signInWithPassword: vi.fn().mockResolvedValue({
      data: { user: mockUser, session: { access_token: 'mock-token' } },
      error: null,
    }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
  },
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: mockPatients[0], error: null }),
    then: vi.fn().mockImplementation((cb) => cb({ data: mockPatients, error: null })),
  }),
  functions: {
    invoke: vi.fn().mockResolvedValue({
      data: { success: true, result: 'mock result' },
      error: null,
    }),
  },
};

// Mock the supabase client module
vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabaseClient,
}));

// Helper to reset mocks between tests
export function resetSupabaseMocks() {
  vi.clearAllMocks();
  mockSupabaseClient.auth.getSession.mockResolvedValue({
    data: { session: { user: mockUser, access_token: 'mock-token' } },
    error: null,
  });
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: mockUser },
    error: null,
  });
}
