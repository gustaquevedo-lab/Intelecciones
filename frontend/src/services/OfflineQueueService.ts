import { queuePendingAction, getPendingActionsCount } from './offlineDb';
import { syncPendingActions } from './syncService';
import { debug } from '../utils/debug';

export interface QueuedAction {
  type: string;
  url: string;
  method: 'POST' | 'PUT';
  data: any;
  timestamp: number;
}

export const OfflineQueueService = {
  /**
   * Enqueues an operation to the persistent offline sync queue.
   * If online, it queues and initiates a non-blocking sync broadcast.
   */
  enqueue: async (action: Omit<QueuedAction, 'timestamp'>): Promise<{ queued: boolean; message: string }> => {
    const fullAction: QueuedAction = {
      ...action,
      timestamp: Date.now()
    };

    try {
      // 1. Persist the action in our offline storage
      await queuePendingAction(fullAction);
      debug.log(`[OFFLINE_QUEUE] Action enqueued successfully: ${action.type}`);

      // 2. If online, trigger background processing immediately
      if (navigator.onLine) {
        setTimeout(() => {
          syncPendingActions().catch(err => {
            debug.error('[OFFLINE_QUEUE] Auto-sync failed:', err);
          });
        }, 1000);
      }

      return {
        queued: true,
        message: navigator.onLine 
          ? 'Registrado e iniciando sincronización en segundo plano.'
          : 'Guardado localmente. Se sincronizará de manera segura al recuperar conexión.'
      };
    } catch (err) {
      debug.error('[OFFLINE_QUEUE] Failed to enqueue action, attempting localStorage fallback:', err);
      try {
        const fallbackQueue = JSON.parse(localStorage.getItem('offline_fallback_queue') || '[]');
        fallbackQueue.push(fullAction);
        localStorage.setItem('offline_fallback_queue', JSON.stringify(fallbackQueue));
        return {
          queued: true,
          message: 'Guardado localmente (Fallback). Sincronización diferida activa.'
        };
      } catch (fallbackErr) {
        debug.error('[OFFLINE_QUEUE] Critical failure: LocalStorage write failed too', fallbackErr);
        throw new Error('No se pudo guardar la acción para sincronización offline.');
      }
    }
  },

  /**
   * Returns total count of pending items to sync
   */
  getPendingCount: async (): Promise<number> => {
    try {
      const dbCount = await getPendingActionsCount();
      const fallbackQueue = JSON.parse(localStorage.getItem('offline_fallback_queue') || '[]');
      return dbCount + fallbackQueue.length;
    } catch {
      return 0;
    }
  },

  /**
   * Process and flush elements in the localStorage fallback queue
   */
  syncFallbackQueue: async () => {
    if (!navigator.onLine) return;
    try {
      const fallbackQueue: QueuedAction[] = JSON.parse(localStorage.getItem('offline_fallback_queue') || '[]');
      if (fallbackQueue.length === 0) return;

      debug.log(`[OFFLINE_QUEUE] Syncing ${fallbackQueue.length} fallback items...`);
      const api = (await import('./api')).default;

      const remaining: QueuedAction[] = [];

      for (const action of fallbackQueue) {
        try {
          if (action.method === 'POST') {
            await api.post(action.url, action.data);
          } else if (action.method === 'PUT') {
            await api.put(action.url, action.data);
          }
          debug.log(`[OFFLINE_QUEUE] Fallback action synchronized: ${action.type}`);
        } catch (err) {
          debug.error(`[OFFLINE_QUEUE] Fallback action failed, keeping in queue: ${action.type}`, err);
          remaining.push(action);
        }
      }

      if (remaining.length > 0) {
        localStorage.setItem('offline_fallback_queue', JSON.stringify(remaining));
      } else {
        localStorage.removeItem('offline_fallback_queue');
      }
    } catch (err) {
      debug.error('[OFFLINE_QUEUE] Failed syncing fallback queue:', err);
    }
  }
};

// Monitor online connection recovery to flush local storage fallback queue
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    OfflineQueueService.syncFallbackQueue();
  });
}
