import { createContext, useContext, ReactNode, useEffect } from 'react';
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
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: async () => {
      // Check Supabase session first
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        localStorage.removeItem('supabase_token');
        return { user: null };
      }

      // Store token for API calls
      const token = session.access_token;
      localStorage.setItem('supabase_token', token);
      
      // Fetch user data from backend with tenant_id
      const res = await fetch('/api/auth/user', { 
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!res.ok) {
        localStorage.removeItem('supabase_token');
        return { user: null };
      }
      
      return res.json();
    },
    retry: false,
    refetchOnWindowFocus: true,
  });

  // Listen for auth changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.access_token) {
          localStorage.setItem('supabase_token', session.access_token);
          refetch();
        }
      } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem('supabase_token');
        refetch();
      }
    });

    return () => subscription.unsubscribe();
  }, [refetch]);

  const value: AuthContextType = {
    user: data?.user || null,
    isLoading,
    isAuthenticated: !!data?.user,
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
