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
    config.headers['x-list-id'] = activeListId === 'null' ? '' : (activeListId || user.assigned_list_id || '');
    config.headers['x-user-role'] = user.role || '';
    config.headers['x-user-id'] = user.id || '';
    config.headers['x-district'] = activeDistrict === 'null' ? '' : (activeDistrict || '');
  }
  return config;
});

export const API_BASE = baseURL;

export const getImageUrl = (url?: string) => {
  if (!url) return null;
  
  let finalUrl = url;
  
  // If it's a relative path, prepend the base API URL (without /api)
  if (!url.startsWith('http')) {
    const base = API_BASE.replace('/api', '');
    finalUrl = `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  }
  
  // Upgrade HTTP to HTTPS if the current page is HTTPS to avoid Mixed Content warnings
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && finalUrl.startsWith('http://')) {
    finalUrl = finalUrl.replace('http://', 'https://');
  }
  
  return finalUrl;
};

export default api;
