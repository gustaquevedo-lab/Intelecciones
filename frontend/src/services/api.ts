import axios from 'axios';

let baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
if (!baseURL.startsWith('http')) baseURL = `https://${baseURL}`;
baseURL = baseURL.replace(/\/$/, '') + '/api';

const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  const userStr = localStorage.getItem('auth_user');
  const activeListId = localStorage.getItem('active_list_id');
  if (userStr) {
    const user = JSON.parse(userStr);
    config.headers['x-list-id'] = activeListId === 'null' ? '' : (activeListId || user.assigned_list_id || '');
    config.headers['x-user-role'] = user.role || '';
    config.headers['x-user-id'] = user.id || '';
  }
  return config;
});

export default api;
