import { createContext, useContext, ReactNode, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

interface User {
  id: string;
  email: string;
  username?: string;
  isAdmin: boolean;
  tenantId?: string;
  subscriptionStatus?: string;
  planId?: string;
  apiCallsUsed: number;
  apiCallsLimit: number;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Helper to get the correct storage based on rememberMe preference
  const getTokenStorage = () => {
    const saved = localStorage.getItem('rememberMe');
    // Default to true if not set (matches login page default and DynamicStorage)
    const rememberMe = saved === null ? true : saved === 'true';
    return rememberMe ? localStorage : sessionStorage;
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: async () => {
      // EINFACH: Prüfe zuerst Supabase Session (schnellste Methode)
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (!error && session?.access_token) {
        // Session gefunden - speichere Token und hole User-Daten
        const token = session.access_token;
        const storage = getTokenStorage();
        storage.setItem('supabase_token', token);
        if (session.refresh_token) {
          storage.setItem('supabase_refresh_token', session.refresh_token);
        }
        
        const res = await fetch('/api/auth/user', { 
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
          return res.json();
        }
      }
      
      // Fallback: Prüfe gespeicherte Tokens
      const storedToken = localStorage.getItem('supabase_token') || sessionStorage.getItem('supabase_token');
      const storedRefreshToken = localStorage.getItem('supabase_refresh_token') || sessionStorage.getItem('supabase_refresh_token');
      
      if (storedToken) {
        // Versuche Token zu validieren
        const res = await fetch('/api/auth/user', { 
          headers: { 'Authorization': `Bearer ${storedToken}` },
        });
        if (res.ok) {
          return res.json();
        }
        
        // Token ungültig - versuche Refresh
        if (storedRefreshToken) {
          try {
            const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession({
              refresh_token: storedRefreshToken
            });
            
            if (!refreshError && refreshedSession?.access_token) {
              const token = refreshedSession.access_token;
              const storage = getTokenStorage();
              storage.setItem('supabase_token', token);
              if (refreshedSession.refresh_token) {
                storage.setItem('supabase_refresh_token', refreshedSession.refresh_token);
              }
              
              const res = await fetch('/api/auth/user', { 
                headers: { 'Authorization': `Bearer ${token}` },
              });
              if (res.ok) {
                return res.json();
              }
            }
          } catch (e) {
            console.error('[AuthContext] Refresh failed:', e);
          }
        }
      }
      
      return { user: null };
    },
    retry: 1, // Nur einmal retry
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000, // 2 Minuten als "fresh" betrachten
  });

  // Listen for auth changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.access_token) {
          const storage = getTokenStorage();
          const otherStorage = storage === localStorage ? sessionStorage : localStorage;
          
          storage.setItem('supabase_token', session.access_token);
          otherStorage.removeItem('supabase_token'); // Clean up other storage
          refetch();
        }
      } else if (event === 'SIGNED_OUT') {
        // Remove token from both storages
        localStorage.removeItem('supabase_token');
        sessionStorage.removeItem('supabase_token');
        refetch();
      }
    });

    return () => subscription.unsubscribe();
  }, [refetch]);

  // EINFACH: Prüfe sofort ob Token vorhanden ist (ohne useMemo, direkt)
  const checkToken = () => {
    try {
      return !!(localStorage.getItem('supabase_token') || sessionStorage.getItem('supabase_token') ||
                localStorage.getItem('supabase_refresh_token') || sessionStorage.getItem('supabase_refresh_token'));
    } catch {
      return false;
    }
  };

  const hasToken = checkToken();

  const value: AuthContextType = {
    user: data?.user || null,
    isLoading,
    // EINFACH: Authentifiziert wenn User-Daten vorhanden ODER Token vorhanden
    // WICHTIG: hasToken wird bei jedem Render neu geprüft, nicht nur bei data/isLoading Änderungen
    isAuthenticated: !!data?.user || hasToken,
    refetch,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
