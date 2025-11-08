import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './auth-context';
import type { TenantSettings } from '@shared/schema';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  settings: TenantSettings;
  userCount: number;
  projectCount: number;
  supplierCount: number;
  createdAt: string;
  updatedAt: string;
}

interface TenantContextType {
  currentTenant: Tenant | null;
  tenants: Tenant[];
  isLoading: boolean;
  switchTenant: (tenantId: string) => void;
  refetch: () => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);

  // Debug-Log beim Mount (wird später entfernt, sobald Auth-Flow funktioniert)
  useEffect(() => {
    console.log('[TenantContext] Mount - Auth State:', {
      isAuthenticated,
      userId: user?.id,
      userEmail: user?.email,
      hasToken: !!(localStorage.getItem('supabase_token') || sessionStorage.getItem('supabase_token')),
    });
  }, []);

  // Only true system admins can see tenant switcher (not regular tenant admins)
  const isSuperAdmin = user?.email === 'sarahzerrer@icloud.com';
  
  // Fetch all tenants (only for system admins)
  const { data: tenantsData, isLoading: tenantsLoading, refetch: refetchTenants } = useQuery({
    queryKey: ['admin-tenants'],
    queryFn: async () => {
      if (!isSuperAdmin) return { tenants: [] };
      
      // Get token from both storages and refresh if needed
      const { supabase } = await import('./supabase');
      let token = localStorage.getItem('supabase_token') || sessionStorage.getItem('supabase_token');
      
      // Try to refresh session to ensure token is valid
      if (token) {
        try {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (!sessionError && session && session.access_token) {
            token = session.access_token;
            const storage = localStorage.getItem('supabase_token') ? localStorage : sessionStorage;
            storage.setItem('supabase_token', token);
            if (session.refresh_token) {
              storage.setItem('supabase_refresh_token', session.refresh_token);
            }
          }
        } catch (error) {
          console.error('[TenantContext] Error refreshing session:', error);
        }
      }
      
      if (!token) return { tenants: [] };
      
      const res = await fetch('/api/admin/tenants', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!res.ok) return { tenants: [] };
      return res.json();
    },
    enabled: isAuthenticated && isSuperAdmin,
  });

  // Fetch user's own tenant (for regular users)
  const { data: userTenantData, isLoading: userTenantLoading } = useQuery({
    queryKey: ['user-tenant'],
    queryFn: async () => {
      if (isSuperAdmin) return { tenant: null }; // System admins use tenant switcher
      
      // Get token from both storages and refresh if needed
      const { supabase } = await import('./supabase');
      let token = localStorage.getItem('supabase_token') || sessionStorage.getItem('supabase_token');
      
      // Try to refresh session to ensure token is valid
      if (token) {
        try {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (!sessionError && session && session.access_token) {
            token = session.access_token;
            const storage = localStorage.getItem('supabase_token') ? localStorage : sessionStorage;
            storage.setItem('supabase_token', token);
            if (session.refresh_token) {
              storage.setItem('supabase_refresh_token', session.refresh_token);
            }
          }
        } catch (error) {
          console.error('[TenantContext] Error refreshing session:', error);
        }
      }
      
      if (!token) return { tenant: null };
      
      const res = await fetch('/api/user/tenant', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!res.ok) return { tenant: null };
      return res.json();
    },
    enabled: isAuthenticated && !isSuperAdmin,
  });

  const isLoading = tenantsLoading || userTenantLoading;
  const tenants = tenantsData?.tenants || [];
  
  // For system admins: Auto-select first tenant if none selected
  useEffect(() => {
    if (isSuperAdmin && tenants.length > 0 && !currentTenantId) {
      const savedTenantId = localStorage.getItem('selected_tenant_id');
      if (savedTenantId && tenants.find((t: Tenant) => t.id === savedTenantId)) {
        setCurrentTenantId(savedTenantId);
      } else {
        setCurrentTenantId(tenants[0].id);
      }
    }
  }, [isSuperAdmin, tenants, currentTenantId]);

  // Determine current tenant based on user role
  let currentTenant: Tenant | null = null;
  if (isSuperAdmin) {
    // System admins use the tenant switcher
    currentTenant = tenants.find((t: Tenant) => t.id === currentTenantId) || null;
  } else {
    // Regular users use their assigned tenant
    currentTenant = userTenantData?.tenant || null;
  }

  const switchTenant = (tenantId: string) => {
    setCurrentTenantId(tenantId);
    localStorage.setItem('selected_tenant_id', tenantId);
    console.log(`[TenantContext] Switched to tenant: ${tenants.find((t: Tenant) => t.id === tenantId)?.name}`);
  };

  const value: TenantContextType = {
    currentTenant,
    tenants,
    isLoading,
    switchTenant,
    refetch: refetchTenants,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return context;
}
