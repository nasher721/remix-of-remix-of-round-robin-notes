import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../useAuth';
import { createTestQueryClient } from '@/test/utils';
import { mockUser } from '@/test/mocks/data';
import type { User } from '@supabase/supabase-js';

// Mock the Supabase client
const mockGetSession = vi.fn();
const mockGetUser = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockSignOut = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockUnsubscribe = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  hasSupabaseConfig: true,
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      getUser: (...args: unknown[]) => mockGetUser(...args),
      signInWithPassword: (...args: unknown[]) => mockSignInWithPassword(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    },
  },
}));

function createWrapper() {
  const queryClient = createTestQueryClient();
  return {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    ),
  };
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should start with loading state', async () => {
      mockGetSession.mockReturnValue(new Promise(() => {})); // Never resolves

      const { result } = renderHook(() => useAuth(), createWrapper());

      expect(result.current.loading).toBe(true);
      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
    });

    it('should initialize with session when available', async () => {
      const mockSession = { user: mockUser, access_token: 'mock-token' };
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

      const { result } = renderHook(() => useAuth(), createWrapper());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.session).toEqual(mockSession);
    });

    it('should handle null session gracefully', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

      const { result } = renderHook(() => useAuth(), createWrapper());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
    });
  });

  describe('signIn', () => {
    it('should sign in user successfully', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      mockSignInWithPassword.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth(), createWrapper());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const signInResult = await result.current.signIn('test@example.com', 'password123');

      expect(signInResult.error).toBeNull();
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should handle sign in error', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      const authError = new Error('Invalid credentials');
      mockSignInWithPassword.mockResolvedValue({ error: authError });

      const { result } = renderHook(() => useAuth(), createWrapper());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const signInResult = await result.current.signIn('test@example.com', 'wrongpassword');

      expect(signInResult.error).toEqual(authError);
    });

    it('should handle unexpected errors during sign in', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      mockSignInWithPassword.mockRejectedValue('Unexpected error');

      const { result } = renderHook(() => useAuth(), createWrapper());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const signInResult = await result.current.signIn('test@example.com', 'password');

      expect(signInResult.error).toBeInstanceOf(Error);
      expect(signInResult.error?.message).toBe('Unexpected error');
    });
  });

  describe('signUp', () => {
    it('should sign up user successfully', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      mockSignUp.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth(), createWrapper());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const signUpResult = await result.current.signUp('newuser@example.com', 'password123');

      expect(signUpResult.error).toBeNull();
      expect(mockSignUp).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        password: 'password123',
        options: { emailRedirectTo: expect.any(String) },
      });
    });

    it('should handle sign up error', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      const signUpError = new Error('Email already exists');
      mockSignUp.mockResolvedValue({ error: signUpError });

      const { result } = renderHook(() => useAuth(), createWrapper());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const signUpResult = await result.current.signUp('existing@example.com', 'password');

      expect(signUpResult.error).toEqual(signUpError);
    });
  });

  describe('signOut', () => {
    it('should sign out user successfully', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: mockUser, access_token: 'token' } },
        error: null,
      });
      mockSignOut.mockResolvedValue({ error: null });

      const { result } = renderHook(() => useAuth(), createWrapper());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await result.current.signOut();

      expect(mockSignOut).toHaveBeenCalled();
    });

    it('should handle sign out error gracefully', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: { user: mockUser, access_token: 'token' } },
        error: null,
      });
      mockSignOut.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAuth(), createWrapper());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should not throw
      await expect(result.current.signOut()).resolves.not.toThrow();
    });
  });

  describe('auth state changes', () => {
    it('should update state when auth state changes', async () => {
      let authCallback: ((event: string, session: unknown) => void) | null = null;
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      mockOnAuthStateChange.mockImplementation((callback) => {
        authCallback = callback;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      });

      const { result } = renderHook(() => useAuth(), createWrapper());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Simulate auth state change
      const newSession = { user: mockUser, access_token: 'new-token' };
      if (authCallback) {
        authCallback('SIGNED_IN', newSession);
      }

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
        expect(result.current.session).toEqual(newSession);
      });
    });

    it('should unsubscribe on unmount', async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

      const { unmount } = renderHook(() => useAuth(), createWrapper());

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle getSession errors', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockGetSession.mockRejectedValue(new Error('Connection failed'));

      const { result } = renderHook(() => useAuth(), createWrapper());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(consoleError).toHaveBeenCalledWith(
        'Failed to restore auth session:',
        expect.any(Error)
      );

      consoleError.mockRestore();
    });
  });
});
