import { createClient } from '@supabase/supabase-js';

// SECURITY: Never hardcode credentials - only use environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in environment variables!');
  console.error('⚠️ Current values:', { 
    url: supabaseUrl ? 'SET' : 'MISSING', 
    key: supabaseAnonKey ? 'SET' : 'MISSING' 
  });
  // Don't throw - let the app render an error message instead
  // This allows the app to show a helpful error page
}

// Dynamic storage adapter that respects "Remember Me" preference
class DynamicStorage implements Storage {
  private getRememberMe(): boolean {
    const saved = localStorage.getItem('rememberMe');
    // Default to true if not set (matches login page default)
    return saved === null ? true : saved === 'true';
  }

  private getStorage(): Storage {
    return this.getRememberMe() ? localStorage : sessionStorage;
  }

  get length(): number {
    return this.getStorage().length;
  }

  key(index: number): string | null {
    return this.getStorage().key(index);
  }

  getItem(key: string): string | null {
    const rememberMe = this.getRememberMe();
    
    // Only read from the storage matching the current preference
    if (rememberMe) {
      return localStorage.getItem(key);
    } else {
      return sessionStorage.getItem(key);
    }
  }

  setItem(key: string, value: string): void {
    const storage = this.getStorage();
    const rememberMe = this.getRememberMe();
    
    // Write to the appropriate storage
    storage.setItem(key, value);
    
    // IMPORTANT: Clean up the OTHER storage to prevent token resurrection
    if (rememberMe) {
      sessionStorage.removeItem(key);
    } else {
      localStorage.removeItem(key);
    }
  }

  removeItem(key: string): void {
    // Remove from both storages to ensure cleanup
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }

  clear(): void {
    // Clear both storages
    localStorage.clear();
    sessionStorage.clear();
  }
}

// Create a dummy client if credentials are missing (for error display)
let supabaseClient: ReturnType<typeof createClient>;
if (!supabaseUrl || !supabaseAnonKey) {
  // Create a dummy client that will fail gracefully
  // This allows the app to render an error message
  supabaseClient = createClient('https://placeholder.supabase.co', 'placeholder-key', {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  // Store error state for UI to display
  (window as any).__SUPABASE_CONFIG_ERROR__ = true;
} else {
  supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: new DynamicStorage(),
      storageKey: 'sb-auth-token',
    },
  });
  
  // SECURITY: Don't log URLs or credentials
  if (process.env.NODE_ENV === 'development') {
    console.log('✅ Supabase client initialized');
  }
}

export const supabase = supabaseClient;
