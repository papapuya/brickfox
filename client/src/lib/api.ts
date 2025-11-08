export async function apiRequest(url: string, options: RequestInit = {}) {
  // Import supabase to refresh token if needed
  const { supabase } = await import('./supabase');
  
  // Try both localStorage and sessionStorage for token (depends on "Remember Me" setting)
  let token = localStorage.getItem('supabase_token') || sessionStorage.getItem('supabase_token');
  
  // If we have a token, try to refresh the session to ensure it's valid
  if (token) {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (!sessionError && session && session.access_token) {
        // Update token with fresh session token
        token = session.access_token;
        const storage = localStorage.getItem('supabase_token') ? localStorage : sessionStorage;
        storage.setItem('supabase_token', token);
        if (session.refresh_token) {
          storage.setItem('supabase_refresh_token', session.refresh_token);
        }
        console.log('[apiRequest] Session refreshed, using fresh token');
      } else if (sessionError) {
        console.warn('[apiRequest] Session refresh failed:', sessionError.message);
        // Try to refresh using refresh token
        const refreshToken = localStorage.getItem('supabase_refresh_token') || sessionStorage.getItem('supabase_refresh_token');
        if (refreshToken) {
          try {
            const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession({
              refresh_token: refreshToken
            });
            if (!refreshError && newSession && newSession.access_token) {
              token = newSession.access_token;
              const storage = localStorage.getItem('supabase_token') ? localStorage : sessionStorage;
              storage.setItem('supabase_token', token);
              if (newSession.refresh_token) {
                storage.setItem('supabase_refresh_token', newSession.refresh_token);
              }
              console.log('[apiRequest] Session refreshed using refresh token');
            } else if (refreshError) {
              console.error('[apiRequest] Refresh token failed:', refreshError.message);
            }
          } catch (refreshErr) {
            console.error('[apiRequest] Error refreshing with refresh token:', refreshErr);
          }
        }
      }
    } catch (error) {
      console.error('[apiRequest] Error refreshing session:', error);
    }
  }
  
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  // Set Content-Type for JSON requests (body is already stringified in apiPost/apiPut)
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  
  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Send cookies for session-based auth
    headers,
  });
  
  // Auto-logout on 401 - nur wenn kein gültiges Token vorhanden ist
  if (response.status === 401) {
    const hasToken = !!(localStorage.getItem('supabase_token') || sessionStorage.getItem('supabase_refresh_token') ||
                        sessionStorage.getItem('supabase_token') || localStorage.getItem('supabase_refresh_token'));
    
    if (!hasToken) {
      // Kein Token vorhanden - wirklich nicht authentifiziert, umleiten
      localStorage.removeItem('supabase_token');
      sessionStorage.removeItem('supabase_token');
      localStorage.removeItem('supabase_refresh_token');
      sessionStorage.removeItem('supabase_refresh_token');
      window.location.href = '/login';
    } else {
      // Token vorhanden aber 401 - Token könnte abgelaufen sein, aber nicht umleiten
      // AuthContext wird die Session automatisch wiederherstellen
      console.warn('[apiRequest] 401 received but token exists - session might be expired, will retry');
    }
  }
  
  return response;
}

export async function apiGet<T>(url: string): Promise<T> {
  const response = await apiRequest(url);
  if (!response.ok) throw new Error('Request failed');
  return response.json();
}

export async function apiPost<T>(url: string, data?: any): Promise<T> {
  const response = await apiRequest(url, {
    method: 'POST',
    body: data instanceof FormData ? data : JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Request failed');
  return response.json();
}

export async function apiPut<T>(url: string, data: any): Promise<T> {
  const response = await apiRequest(url, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Request failed');
  return response.json();
}

export async function apiDelete<T>(url: string): Promise<T> {
  const response = await apiRequest(url, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Request failed');
  return response.json();
}

export async function apiDownload(url: string, data: any, filename: string): Promise<void> {
  const response = await apiRequest(url, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  
  if (!response.ok) throw new Error('Download failed');
  
  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}
