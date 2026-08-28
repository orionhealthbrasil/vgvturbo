import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Proactive token refresh before expiration
  useEffect(() => {
    if (!session?.expires_at) return;

    const expiresAt = session.expires_at * 1000; // Convert to milliseconds
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;
    
    // Refresh 5 minutes before expiration (or immediately if less than 5 min left)
    const refreshBuffer = 5 * 60 * 1000; // 5 minutes in ms
    const refreshIn = Math.max(timeUntilExpiry - refreshBuffer, 0);

    // Don't schedule if already expired
    if (timeUntilExpiry <= 0) {
      console.log('[Auth] Session expired, attempting refresh...');
      supabase.auth.refreshSession();
      return;
    }

    console.log(`[Auth] Token refresh scheduled in ${Math.round(refreshIn / 1000 / 60)} minutes`);

    const refreshTimer = setTimeout(async () => {
      console.log('[Auth] Proactively refreshing token...');
      const { error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('[Auth] Failed to refresh token:', error);
      } else {
        console.log('[Auth] Token refreshed successfully');
      }
    }, refreshIn);

    return () => clearTimeout(refreshTimer);
  }, [session?.expires_at]);

  // Refresh token when app comes back from background (iOS suspends setTimeout)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) return;
      const expiresAt = (currentSession.expires_at ?? 0) * 1000;
      // Refresh if token expires within 10 minutes (covers iOS background suspension)
      if (expiresAt - Date.now() < 10 * 60 * 1000) {
        supabase.auth.refreshSession();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error: error as Error | null };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error during signOut:', error);
    } finally {
      // Always clear local auth state, even if API call fails
      clearAuthStorage();
      setUser(null);
      setSession(null);
    }
  };

  // Helper to clear Supabase auth storage when session is invalid
  const clearAuthStorage = () => {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.startsWith('sb-') && key.includes('auth-token')) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
