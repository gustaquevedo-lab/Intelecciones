import api from './api';
import { getPendingActions, removePendingAction, getPendingActionsCount } from './offlineDb';
import { debug } from '../utils/debug';

// Mutex for sync to prevent race conditions across tabs via BroadcastChannel
let isSyncing = false;
const SYNC_LOCK_KEY = 'intelecciones_sync_lock';
const SYNC_LOCK_TTL = 30000; // 30 seconds max lock time

// Use BroadcastChannel for cross-tab sync coordination
const syncChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('intelecciones_sync') : null;

// Request deduplication - prevent same data from being sent multiple times
const recentRequests = new Map<string, number>();
const DEDUP_WINDOW_MS = 5000; // 5 second window for deduplication

const getDeduplicationKey = (url: string, data: any): string => {
  const dataStr = typeof data === 'object' ? JSON.stringify(data) : String(data);
  return `${url}:${dataStr}`;
};

const isDuplicateRequest = (url: string, data: any): boolean => {
  const key = getDeduplicationKey(url, data);
  const now = Date.now();
  const lastRequest = recentRequests.get(key);
  
  if (lastRequest && (now - lastRequest) < DEDUP_WINDOW_MS) {
    debug.log(`[SYNC] Deduplicated duplicate request: ${key}`);
    return true;
  }
  
  recentRequests.set(key, now);
  // Cleanup old entries
  if (recentRequests.size > 100) {
    const entriesToDelete: string[] = [];
    recentRequests.forEach((timestamp, k) => {
      if (now - timestamp > DEDUP_WINDOW_MS) entriesToDelete.push(k);
    });
    entriesToDelete.forEach(k => recentRequests.delete(k));
  }
  
  return false;
};

// Try to acquire sync lock using localStorage (fallback for browsers without BroadcastChannel)
const acquireSyncLock = (): boolean => {
  if (isSyncing) return false;
  
  const lockValue = localStorage.getItem(SYNC_LOCK_KEY);
  if (lockValue) {
    const lockTime = parseInt(lockValue, 10);
    if (Date.now() - lockTime < SYNC_LOCK_TTL) {
      // Lock is held by another tab
      return false;
    }
  }
  
  // Acquire lock
  try {
    localStorage.setItem(SYNC_LOCK_KEY, Date.now().toString());
    isSyncing = true;
    return true;
  } catch {
    // localStorage might be full or disabled
    isSyncing = true;
    return true;
  }
};

const releaseSyncLock = () => {
  isSyncing = false;
  try {
    localStorage.removeItem(SYNC_LOCK_KEY);
  } catch {}
};

// Listen for sync events from other tabs
if (syncChannel) {
  syncChannel.onmessage = (event) => {
    if (event.data === 'SYNC_COMPLETE' || event.data === 'SYNC_RELEASE') {
      releaseSyncLock();
    }
  };
}

export const syncPendingActions = async (): Promise<{ successCount: number; failedCount: number; totalProcessed: number }> => {
  // Try to acquire lock (prevents race conditions across tabs)
  if (!acquireSyncLock()) {
    debug.log('[SYNC] Another tab is syncing, skipping...');
    return { successCount: 0, failedCount: 0, totalProcessed: 0 };
  }
  
  const pending = await getPendingActions();
  if (pending.length === 0) {
    releaseSyncLock();
    return { successCount: 0, failedCount: 0, totalProcessed: 0 };
  }

  debug.log(`[SYNC] Iniciando sincronización de ${pending.length} acciones pendientes...`);

  let successCount = 0;
  let failedCount = 0;

  for (const action of pending) {
    try {
      if (action.method.toUpperCase() === 'POST') {
        await api.post(action.url, action.data);
      } else if (action.method.toUpperCase() === 'PUT') {
        await api.put(action.url, action.data);
      }
      
      await removePendingAction(action.id);
      successCount++;
      debug.log(`[SYNC] Acción ${action.id} (${action.type}) sincronizada con éxito.`);
    } catch (err: any) {
      debug.error(`[SYNC] Error al sincronizar acción ${action.id}:`, err);
      
      const status = err.response?.status;

      // 429 (Rate Limit), 401/403 (Auth/Permission), 408 (Timeout), 5xx (Server Error), or Network Error:
      // DO NOT REMOVE! Keep in queue and retry on next sync interval.
      if (!status || status === 429 || status === 401 || status === 403 || status === 408 || status >= 500) {
        debug.warn(`[SYNC] Error temporal/reintentable (${status || 'network'}), manteniendo acción ${action.id} en cola para reintento:`, action);
        failedCount++;
        continue;
      }

      // Only discard if explicitly unprocessable entity or bad request format (400, 422) after logging to failed audit
      try {
        const failedKey = 'intelecciones_failed_actions';
        const existingFailed = JSON.parse(localStorage.getItem(failedKey) || '[]');
        existingFailed.unshift({ ...action, failedAt: Date.now(), errorStatus: status, errorMessage: err.message });
        localStorage.setItem(failedKey, JSON.stringify(existingFailed.slice(0, 50)));
      } catch {}

      debug.warn(`[SYNC] Descartando acción con formato no procesable (${status}):`, action);
      await removePendingAction(action.id);
      failedCount++;
    }
  }

  releaseSyncLock();
  
  // Notify other tabs that sync is complete
  if (syncChannel) {
    syncChannel.postMessage('SYNC_COMPLETE');
  }

  return { successCount, failedCount, totalProcessed: pending.length };
};

export const safePost = async (type: string, url: string, data: any) => {
  // Check for duplicate requests before sending
  if (isDuplicateRequest(url, data)) {
    debug.log(`[SYNC] Duplicate request detected for ${type}, skipping`);
    return { data: { duplicate: true, message: 'Solicitud duplicada, omitida' } };
  }
  
  try {
    if (navigator.onLine) {
      const res = await api.post(url, data, { timeout: 15000 }); // Reduced timeout for faster feedback
      // Trigger background sync immediately to clear any queue
      syncPendingActions();
      return res;
    }
  } catch (err: any) {
    debug.warn(`[SYNC] Fallo envío online para ${type}, encolando...`, err);
    
    // Network error or server error - enqueue for later
    const { queuePendingAction } = await import('./offlineDb');
    await queuePendingAction({
      type,
      url,
      method: 'POST',
      data,
      timestamp: Date.now()
    });
    
    // Try to sync immediately in background (non-blocking)
    setTimeout(() => {
      syncPendingActions().catch(debug.error);
    }, 1000);
    
    return { data: { offline: true, message: 'Guardado localmente, se sincronizará cuando haya conexión' } };
  }

  // Actually offline - enqueue immediately
  const { queuePendingAction } = await import('./offlineDb');
  await queuePendingAction({
    type,
    url,
    method: 'POST',
    data,
    timestamp: Date.now()
  });

  return { data: { offline: true, message: 'Sin conexión, guardado localmente' } };
};

// Auto-sync when coming back online (guarded: only runs once)
let _syncInitialized = false;
if (typeof window !== 'undefined' && !_syncInitialized) {
  _syncInitialized = true;
  let wasOffline = !navigator.onLine;
  
  window.addEventListener('online', () => {
    if (wasOffline) {
      wasOffline = false;
      setTimeout(() => {
        syncPendingActions().catch(debug.error);
      }, 2000);
    }
  });
  
  window.addEventListener('offline', () => {
    wasOffline = true;
  });
  
  setInterval(() => {
    if (navigator.onLine) {
      getPendingActionsCount().then(count => {
        if (count > 0) {
          syncPendingActions().catch(debug.error);
        }
      }).catch(() => {});
    }
  }, 30000);
}

// Manual trigger for force sync (useful for UI buttons)
export const forceSyncNow = () => {
  if (navigator.onLine) {
    return syncPendingActions();
  }
  return Promise.resolve({ successCount: 0, failedCount: 0, totalProcessed: 0 });
};