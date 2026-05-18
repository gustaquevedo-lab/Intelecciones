import api from './api';
import { getPendingActions, removePendingAction } from './offlineDb';

let isSyncing = false;

export const syncPendingActions = async (): Promise<{ successCount: number; failedCount: number; totalProcessed: number }> => {
  if (isSyncing) return { successCount: 0, failedCount: 0, totalProcessed: 0 };
  
  const pending = await getPendingActions();
  if (pending.length === 0) return { successCount: 0, failedCount: 0, totalProcessed: 0 };

  isSyncing = true;
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
      if (err.response && err.response.status < 500) {
        console.warn(`[SYNC] Eliminando acción defectuosa de la cola para no bloquear la sincronización:`, action);
        await removePendingAction(action.id);
        failedCount++;
        continue;
      }
      // Stop syncing on network or server error to preserve order
      failedCount += (pending.length - successCount);
      break; 
    }
  }

  isSyncing = false;
  return { successCount, failedCount, totalProcessed: pending.length };
};

export const safePost = async (type: string, url: string, data: any) => {
  try {
    if (navigator.onLine) {
      const res = await api.post(url, data);
      // Trigger background sync immediately to clear any queue
      syncPendingActions();
      return res;
    }
  } catch (err) {
    console.warn(`[SYNC] Fallo envío online para ${type}, encolando...`, err);
  }

  // If we reach here, either offline or request failed
  const { queuePendingAction } = await import('./offlineDb');
  await queuePendingAction({
    type,
    url,
    method: 'POST',
    data,
    timestamp: Date.now()
  });

  // Automatically trigger a background sync in 1 second in case it was a transient drop
  setTimeout(() => {
    syncPendingActions();
  }, 1000);

  return { data: { offline: true, message: 'Guardado localmente' } };
};

// Auto-sync when coming back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[SYNC] Conexión detectada. Sincronizando...');
    syncPendingActions();
  });
  
  // Also try to sync periodically if online
  setInterval(() => {
    if (navigator.onLine) syncPendingActions();
  }, 30000); // Increased frequency to every 30 seconds
}
