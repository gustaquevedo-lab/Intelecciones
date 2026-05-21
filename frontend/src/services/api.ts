import axios from 'axios';

let baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
if (!baseURL.startsWith('http')) baseURL = `https://${baseURL}`;
baseURL = baseURL.replace(/\/$/, '');
if (!baseURL.endsWith('/api')) {
  baseURL += '/api';
}

const api = axios.create({
  baseURL,
  timeout: 30000,
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_user');
      localStorage.removeItem('active_list_id');
      localStorage.removeItem('active_district');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

api.interceptors.request.use((config) => {
  const userStr = localStorage.getItem('auth_user');
  const activeListId = localStorage.getItem('active_list_id');
  const activeDistrict = localStorage.getItem('active_district');
  if (userStr) {
    const user = JSON.parse(userStr);
    config.headers['x-list-id'] = (activeListId === null || activeListId === 'null') ? '' : activeListId;
    config.headers['x-user-role'] = user.role || '';
    config.headers['x-user-id'] = user.id || '';
    config.headers['x-district'] = activeDistrict === 'null' ? '' : (activeDistrict || '');
  }
  return config;
});

export const API_BASE = baseURL;

export const getImageUrl = (url?: string) => {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  
  let finalUrl = url;
  
  if (url.includes('/uploads/')) {
    const parts = url.split('/uploads/');
    finalUrl = '/uploads/' + parts[parts.length - 1];
  } else if (!url.startsWith('http') && !url.includes('/')) {
    finalUrl = `/uploads/${url}`;
  }

  if (!finalUrl.startsWith('http')) {
    const base = API_BASE.replace('/api', '');
    finalUrl = `${base}${finalUrl.startsWith('/') ? '' : '/'}${finalUrl}`;
  }
  
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && finalUrl.startsWith('http://')) {
    finalUrl = finalUrl.replace('http://', 'https://');
  }
  
  return finalUrl;
};

// Non-blocking warmup - fire and forget, never blocks UI
let warmupIntervalId: ReturnType<typeof setInterval> | null = null;
let lastWarmupTime = 0;
const MIN_WARMUP_INTERVAL = 60000; // Minimum 60s between warmups

export const warmup = async () => {
  // Skip if recently warmed up
  if (Date.now() - lastWarmupTime < MIN_WARMUP_INTERVAL) {
    return;
  }
  
  lastWarmupTime = Date.now();
  
  // Use ping to check backend, but don't await - fire and forget
  api.get('/ping', { timeout: 5000 })
    .then(() => {
      if (import.meta.env.DEV) console.log('[API] Backend warm');
    })
    .catch(() => {
      // Silently fail - don't log in prod
    });
};

// Start warmup with proper visibility detection
if (typeof window !== 'undefined') {
  // Only warmup when tab is visible
  const startWarmupCycle = () => {
    if (warmupIntervalId) clearInterval(warmupIntervalId);
    
    warmupIntervalId = setInterval(() => {
      if (document.visibilityState === 'visible' && !document.hidden) {
        warmup();
      }
    }, 90000); // 90s interval - reduced for battery
  };
  
  startWarmupCycle();
  
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      warmup(); // Immediate warmup when tab becomes visible
    }
  });
}

// API cache for reducing redundant requests
const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5000; // 5 second cache

export const cachedApiGet = async <T>(url: string, forceRefresh = false): Promise<T> => {
  const cached = apiCache.get(url);
  
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  
  const response = await api.get<T>(url);
  apiCache.set(url, { data: response.data, timestamp: Date.now() });
  return response.data;
};

export const clearApiCache = () => {
  apiCache.clear();
};

// Clear cache when user logs in/out
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'auth_user' && !e.newValue) {
      clearApiCache();
    }
  });
}

export default api;