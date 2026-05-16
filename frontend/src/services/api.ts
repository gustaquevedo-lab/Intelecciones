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
  
  // If it's already a full data URL (base64), return as is
  if (url.startsWith('data:')) return url;
  
  let finalUrl = url;
  
  // 1. If the URL is a full URL but contains /uploads/, extract the relative path
  // This fixes cases where localhost or old dev IPs were saved in the DB
  if (url.includes('/uploads/')) {
    const parts = url.split('/uploads/');
    finalUrl = '/uploads/' + parts[parts.length - 1];
  }
  // 2. If it's just a filename (no slash and no http), assume it's in /uploads/
  else if (!url.startsWith('http') && !url.includes('/')) {
    finalUrl = `/uploads/${url}`;
  }

  // 3. If it's a relative path, prepend the current base API URL (without /api)
  if (!finalUrl.startsWith('http')) {
    const base = API_BASE.replace('/api', '');
    finalUrl = `${base}${finalUrl.startsWith('/') ? '' : '/'}${finalUrl}`;
  }
  
  // 4. Upgrade HTTP to HTTPS if needed
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && finalUrl.startsWith('http://')) {
    finalUrl = finalUrl.replace('http://', 'https://');
  }
  
  return finalUrl;
};

/** Background Warmup: Keeps the backend alive on platforms like Railway/Vercel */
export const warmup = async () => {
  try {
    await api.get('/ping');
    console.log('[API] Backend warmed up successfully');
  } catch (e) {
    console.warn('[API] Warmup failed, backend might be sleeping');
  }
};

// Auto-warmup every 45 seconds while the tab is active to prevent Cold Starts on Railway
if (typeof window !== 'undefined') {
  setInterval(() => {
    if (document.visibilityState === 'visible') {
      warmup();
    }
  }, 45000);

  // Also warmup immediately when the tab becomes visible again
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      warmup();
    }
  });
}

export default api;
