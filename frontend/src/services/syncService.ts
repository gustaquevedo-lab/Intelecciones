import api from './api';
import { getPendingActions, removePendingAction, getPendingActionsCount } from './offlineDb';

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
    console.log(`[SYNC] Deduplicated duplicate request: ${key}`);
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
    console.log('[SYNC] Another tab is syncing, skipping...');
    return { successCount: 0, failedCount: 0, totalProcessed: 0 };
  }
  
  const pending = await getPendingActions();
  if (pending.length === 0) {
    releaseSyncLock();
    return { successCount: 0, failedCount: 0, totalProcessed: 0 };
  }

  console.log(`[SYNC] Iniciando sincronización de ${pending.length} acciones pendientes...`);

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
      console.log(`[SYNC] Acción ${action.id} (${action.type}) sincronizada con éxito.`);
    } catch (err: any) {
      console.error(`[SYNC] Error al sincronizar acción ${action.id}:`, err);
      
      // 4xx errors (client errors) - remove the action, it's broken
      if (err.response && err.response.status >= 400 && err.response.status < 500) {
        console.warn(`[SYNC] Eliminando acción defectuosa (${err.response.status}):`, action);
        await removePendingAction(action.id);
        failedCount++;
        continue;
      }
      
      // 5xx errors or network errors - KEEP the action in queue, will retry next sync
      // This is the key fix: don't break the loop, just log and continue
      console.warn(`[SYNC] Error de servidor/red (${err.response?.status || 'network'}), manteniendo acción para retry:`, action);
      failedCount++;
      // Don't break anymore - continue processing remaining actions
      // The action stays in the queue and will be retried on next sync
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
    console.log(`[SYNC] Duplicate request detected for ${type}, skipping`);
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
    console.warn(`[SYNC] Fallo envío online para ${type}, encolando...`, err);
    
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
      syncPendingActions().catch(console.error);
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

// Auto-sync when coming back online
if (typeof window !== 'undefined') {
  let wasOffline = !navigator.onLine;
  
  window.addEventListener('online', () => {
    console.log('[SYNC] Conexión detectada. Sincronizando...');
    
    // Only trigger sync if we were actually offline (avoid unnecessary syncs on page load)
    if (wasOffline) {
      wasOffline = false;
      // Small delay to ensure connection is stable
      setTimeout(() => {
        syncPendingActions().catch(console.error);
      }, 2000);
    }
  });
  
  window.addEventListener('offline', () => {
    console.log('[SYNC] Sin conexión, guardando localmente...');
    wasOffline = true;
  });
  
  // Periodic sync attempt (less aggressive than before)
  setInterval(() => {
    if (navigator.onLine) {
      getPendingActionsCount().then(count => {
        if (count > 0) {
          console.log(`[SYNC] ${count} acciones pendientes, sincronizando...`);
          syncPendingActions().catch(console.error);
        }
      }).catch(() => {});
    }
  }, 30000); // Reduced from 30s to avoid excessive load
}

// Manual trigger for force sync (useful for UI buttons)
export const forceSyncNow = () => {
  if (navigator.onLine) {
    return syncPendingActions();
  }
  return Promise.resolve({ successCount: 0, failedCount: 0, totalProcessed: 0 });
};