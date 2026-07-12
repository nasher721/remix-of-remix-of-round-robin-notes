import * as React from "react";
import { flushSync } from "react-dom";
import type { User, Session } from "@supabase/supabase-js";
import { hasSupabaseConfig, supabase } from "@/integrations/supabase/client";
import { prepareSensitiveClientState } from "@/lib/auth/clearSensitiveClientState";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
  onAuthBoundary?: () => void;
}

export function AuthProvider({ children, onAuthBoundary }: AuthProviderProps): React.ReactElement {
  const [user, setUser] = React.useState<User | null>(null);
  const [session, setSession] = React.useState<Session | null>(null);
  const [loading, setLoading] = React.useState(true);
  const initialized = React.useRef(false);
  const activeUserId = React.useRef<string | null | undefined>(undefined);
  const transitionChain = React.useRef<Promise<void>>(Promise.resolve());

  const applySession = React.useCallback((nextSession: Session | null): Promise<void> => {
    const transition = transitionChain.current.catch(() => undefined).then(async () => {
      const nextUser = nextSession?.user ?? null;
      const nextUserId = nextUser?.id ?? null;

      if (activeUserId.current !== nextUserId) {
        if (activeUserId.current !== undefined) {
          // Quarantine the old UI synchronously so open patient-data stores
          // (notably y-indexeddb) close before deletion. Null is safe to expose;
          // the new identity is still withheld until cleanup completes.
          flushSync(() => {
            setLoading(true);
            setSession(null);
            setUser(null);
            onAuthBoundary?.();
          });
          // Give passive-effect cleanup a turn to close y-indexeddb handles.
          await new Promise<void>(resolve => setTimeout(resolve, 0));
        } else {
          onAuthBoundary?.();
        }
        await prepareSensitiveClientState(nextUserId);
        activeUserId.current = nextUserId;
      }

      // Publish only after persistent and in-memory state belongs to this user.
      setSession(nextSession);
      setUser(nextUser);
      setLoading(false);
    });
    transitionChain.current = transition;
    return transition;
  }, [onAuthBoundary]);

  React.useEffect(() => {
    initialized.current = false;

    if (!hasSupabaseConfig) {
      void applySession(null)
        .catch(() => console.error("Failed to clear local data without an auth session"))
        .finally(() => {
          if (!initialized.current) {
            initialized.current = true;
            setLoading(false);
          }
        });
      return;
    }

    let authEventSeen = false;

    const finishLoading = () => {
      if (!initialized.current) {
        initialized.current = true;
        setLoading(false);
      }
    };

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        authEventSeen = true;
        void applySession(nextSession)
          .catch(() => console.error("Failed to prepare local data for the auth session"))
          .finally(finishLoading);
      }
    );

    // THEN check for existing session
    const initializeSession = async () => {
      try {
        const { data: { session: restoredSession }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!authEventSeen) {
          await applySession(restoredSession);
        }
      } catch (error) {
        console.error("Failed to restore auth session:", error);
      } finally {
        finishLoading();
      }
    };

    void initializeSession();

    return () => {
      initialized.current = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const signIn = async (email: string, password: string) => {
    if (!hasSupabaseConfig) {
      return { error: new Error("Authentication is not configured.") };
    }
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error as Error | null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error(String(error)) };
    }
  };

  const signOut = async () => {
    if (!hasSupabaseConfig) {
      await applySession(null);
      return;
    }

    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Supabase normally emits SIGNED_OUT. Explicitly await the same transition
    // so callers navigate only after local state is actually isolated.
    await applySession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
