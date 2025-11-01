import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://lxemqwvdaxzeldpjmxoc.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseAnonKey) {
  console.error('⚠️ VITE_SUPABASE_ANON_KEY is missing! Supabase Auth will not work.');
}

// Dynamic storage adapter that respects "Remember Me" preference
class DynamicStorage {
  private getStorage(): Storage {
    // Check if user has "Remember Me" enabled (stored in localStorage)
    const rememberMe = localStorage.getItem('rememberMe') === 'true';
    return rememberMe ? localStorage : sessionStorage;
  }

  getItem(key: string): string | null {
    const rememberMe = localStorage.getItem('rememberMe') === 'true';
    
    // Only read from the storage matching the current preference
    if (rememberMe) {
      return localStorage.getItem(key);
    } else {
      return sessionStorage.getItem(key);
    }
  }

  setItem(key: string, value: string): void {
    const storage = this.getStorage();
    const rememberMe = localStorage.getItem('rememberMe') === 'true';
    
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
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: new DynamicStorage() as any,
  },
});

console.log('✅ Supabase client initialized:', supabaseUrl);
