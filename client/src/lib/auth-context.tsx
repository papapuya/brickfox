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
  // Helper to get the correct storage based on rememberMe preference
  const getTokenStorage = () => {
    const rememberMe = localStorage.getItem('rememberMe') === 'true';
    return rememberMe ? localStorage : sessionStorage;
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: async () => {
      // Check Supabase session first
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        // Remove token from both storages
        localStorage.removeItem('supabase_token');
        sessionStorage.removeItem('supabase_token');
        return { user: null };
      }

      // Store token for API calls in the correct storage
      const token = session.access_token;
      const storage = getTokenStorage();
      const otherStorage = storage === localStorage ? sessionStorage : localStorage;
      
      storage.setItem('supabase_token', token);
      otherStorage.removeItem('supabase_token'); // Clean up other storage
      
      // Fetch user data from backend with tenant_id
      const res = await fetch('/api/auth/user', { 
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!res.ok) {
        // Remove token from both storages
        localStorage.removeItem('supabase_token');
        sessionStorage.removeItem('supabase_token');
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
