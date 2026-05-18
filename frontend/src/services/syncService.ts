import api from './api';
import { getPendingActions, removePendingAction } from './offlineDb';

let isSyncing = false;

export const syncPendingActions = async () => {
  if (isSyncing || !navigator.onLine) return;
  
  const pending = await getPendingActions();
  if (pending.length === 0) return;

  isSyncing = true;
  console.log(`[SYNC] Iniciando sincronización de ${pending.length} acciones pendientes...`);

  for (const action of pending) {
    try {
      if (action.method.toUpperCase() === 'POST') {
        // Special handling for FormData (Actas) if needed
        await api.post(action.url, action.data);
      } else if (action.method.toUpperCase() === 'PUT') {
        await api.put(action.url, action.data);
      }
      
      await removePendingAction(action.id);
      console.log(`[SYNC] Acción ${action.id} (${action.type}) sincronizada con éxito.`);
    } catch (err: any) {
      console.error(`[SYNC] Error al sincronizar acción ${action.id}:`, err);
      if (err.response && err.response.status < 500) {
        console.warn(`[SYNC] Eliminando acción defectuosa de la cola para no bloquear la sincronización:`, action);
        await removePendingAction(action.id);
        continue;
      }
      // Stop syncing on network or server error to preserve order
      break; 
    }
  }

  isSyncing = false;
};

export const safePost = async (type: string, url: string, data: any) => {
  try {
    if (navigator.onLine) {
      return await api.post(url, data);
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
  }, 60000); // Every minute
}
