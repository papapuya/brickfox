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

  // Fetch all tenants (only for admins)
  const { data: tenantsData, isLoading: tenantsLoading, refetch: refetchTenants } = useQuery({
    queryKey: ['admin-tenants'],
    queryFn: async () => {
      if (!user?.isAdmin) return { tenants: [] };
      
      const token = localStorage.getItem('supabase_token');
      const res = await fetch('/api/admin/tenants', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!res.ok) return { tenants: [] };
      return res.json();
    },
    enabled: isAuthenticated && user?.isAdmin === true,
  });

  // Fetch user's own tenant (for regular users)
  const { data: userTenantData, isLoading: userTenantLoading } = useQuery({
    queryKey: ['user-tenant'],
    queryFn: async () => {
      if (user?.isAdmin) return { tenant: null }; // Admins use tenant switcher
      
      const token = localStorage.getItem('supabase_token');
      const res = await fetch('/api/user/tenant', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!res.ok) return { tenant: null };
      return res.json();
    },
    enabled: isAuthenticated && user?.isAdmin === false,
  });

  const isLoading = tenantsLoading || userTenantLoading;
  const tenants = tenantsData?.tenants || [];
  
  // For admins: Auto-select first tenant if none selected
  useEffect(() => {
    if (user?.isAdmin && tenants.length > 0 && !currentTenantId) {
      const savedTenantId = localStorage.getItem('selected_tenant_id');
      if (savedTenantId && tenants.find((t: Tenant) => t.id === savedTenantId)) {
        setCurrentTenantId(savedTenantId);
      } else {
        setCurrentTenantId(tenants[0].id);
      }
    }
  }, [user?.isAdmin, tenants, currentTenantId]);

  // Determine current tenant based on user role
  let currentTenant: Tenant | null = null;
  if (user?.isAdmin) {
    // Admins use the tenant switcher
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
