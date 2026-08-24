import axios from 'axios';
import axiosRetry from 'axios-retry';

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

// Configure axios-retry
axiosRetry(api, {
  retries: 3,
  retryDelay: (retryCount) => retryCount * 1000,
  retryCondition: (error) => {
    // Retry on network errors, timeouts, and 502/503/504 Bad Gateway from proxy restart
    const isNetworkError = !error.response;
    const isTimeout = error.code === 'ECONNABORTED';
    const is502or503 = error.response?.status === 502 || error.response?.status === 503 || error.response?.status === 504;
    return isNetworkError || isTimeout || is502or503;
  }
});

const BUILD_VERSION_KEY = 'app_build_version';

// 401 Interceptor - Safe handling without disruptive page reloads
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      // Only force login redirect if explicit session verification fails
      if (url.includes('/me') && !url.includes('/login')) {
        localStorage.removeItem('auth_user');
        localStorage.removeItem('active_list_id');
        localStorage.removeItem('active_district');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Build Version Interceptor — tracks server version silently.
// NO automatic reload: main.tsx already unregisters all SWs on every load,
// so calling reg.update() or window.location.reload() here creates infinite loops
// (InvalidStateError → vite:preloadError → reload → repeat).
api.interceptors.response.use(
  (response) => {
    const serverVersion = response.headers['x-build-version'];
    if (serverVersion) {
      sessionStorage.setItem(BUILD_VERSION_KEY, serverVersion);
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);


api.interceptors.request.use((config) => {
  // Dynamic timeouts based on endpoint type
  const url = config.url || '';
  if (url.includes('/my-team/reports') || url.includes('/full-report') || url.includes('/coverage') || url.includes('/stats/command') || url.includes('/process-acta')) {
    config.timeout = 120000; // 120s for reports & complex actas ocr
  } else if (url.includes('/offline/padron')) {
    config.timeout = 300000; // 300s for offline padron
  } else if (config.method?.toLowerCase() === 'post' || config.method?.toLowerCase() === 'put' || config.method?.toLowerCase() === 'delete' || url.includes('/login')) {
    config.timeout = 15000; // 15s for login/writes
  } else {
    config.timeout = 30000; // 30s default
  }

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
    let base = API_BASE.replace(/\/api$/, '');
    if (!base.startsWith('http') && typeof window !== 'undefined') {
      base = `${window.location.origin}${base}`;
    }
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

// Start warmup with proper visibility detection (guarded: only runs once)
let _warmupInitialized = false;
if (typeof window !== 'undefined' && !_warmupInitialized) {
  _warmupInitialized = true;
  
  warmupIntervalId = setInterval(() => {
    if (document.visibilityState === 'visible' && !document.hidden) {
      warmup();
    }
  }, 90000);
  
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      warmup();
    }
  });
}

// API cache for reducing redundant requests
const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 5000;
const CACHE_MAX = 50;

export const cachedApiGet = async <T>(url: string, forceRefresh = false): Promise<T> => {
  const cached = apiCache.get(url);
  
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T;
  }
  
  const response = await api.get<T>(url);
  if (apiCache.size >= CACHE_MAX) {
    const oldest = apiCache.keys().next().value;
    if (oldest) apiCache.delete(oldest);
  }
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