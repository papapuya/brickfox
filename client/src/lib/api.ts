export async function apiRequest(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('supabase_token');
  
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  // Auto-logout on 401
  if (response.status === 401) {
    localStorage.removeItem('supabase_token');
    window.location.href = '/login';
  }
  
  return response;
}

export async function apiGet<T>(url: string): Promise<T> {
  const response = await apiRequest(url);
  if (!response.ok) throw new Error('Request failed');
  return response.json();
}

export async function apiPost<T>(url: string, data?: any): Promise<T> {
  console.log('[apiPost] URL:', url);
  console.log('[apiPost] Data:', data);
  console.log('[apiPost] Stringified:', JSON.stringify(data));
  
  const response = await apiRequest(url, {
    method: 'POST',
    body: data instanceof FormData ? data : JSON.stringify(data),
  });
  
  console.log('[apiPost] Response status:', response.status);
  console.log('[apiPost] Response ok:', response.ok);
  
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
