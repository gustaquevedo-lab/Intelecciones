import localforage from 'localforage';
import { debug } from '../utils/debug';

const DB_NAME = 'InteleccionesOffline';
const DB_VERSION = 3; // Incremented for new indexes
const STORE_NAME = 'electors';

// Configure localforage for the pending sync queue
const pendingSyncStore = localforage.createInstance({
  name: DB_NAME,
  storeName: 'pending_sync'
});

// Singleton connection to avoid creating multiple connections
let dbInstance: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase> | null = null;

export const initOfflineDB = (): Promise<IDBDatabase> => {
  // Return existing promise if already initializing
  if (dbInitPromise) return dbInitPromise;
  
  // Return existing instance if already open
  if (dbInstance && dbInstance.objectStoreNames.contains(STORE_NAME)) {
    return Promise.resolve(dbInstance);
  }
  
  dbInitPromise = new Promise((resolve, reject) => {
    try {
      debug.log(`[DB] Opening IndexedDB: ${DB_NAME} v${DB_VERSION}`);
      
      // Close existing connection if version mismatch
      if (dbInstance) {
        try { dbInstance.close(); } catch {}
        dbInstance = null;
      }
      
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        debug.error("[DB] Error opening IndexedDB:", request.error);
        dbInitPromise = null;
        reject(request.error);
      };
      
      request.onsuccess = () => {
        const db = request.result;
        dbInstance = db;
        dbInitPromise = null;
        
        // Handle version change for existing connections
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          debug.warn(`[DB] Store ${STORE_NAME} missing, recreating...`);
          db.close();
          dbInitPromise = null;
          // Trigger reopen
          indexedDB.open(DB_NAME, DB_VERSION + 1).onsuccess = () => {
            dbInstance = request.result;
            resolve(dbInstance);
          };
          return;
        }
        
        resolve(db);
      };

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result;
        dbInstance = db;
        
        // Store for Electors (Padron)
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'ci' });
          store.createIndex('nombre', 'nombre', { unique: false });
          store.createIndex('apellido', 'apellido', { unique: false });
          store.createIndex('full_name', ['nombre', 'apellido'], { unique: false });
        }
        
        debug.log(`[DB] IndexedDB schema updated to v${DB_VERSION}`);
      };
    } catch (e) {
      debug.error("[DB] Critical error opening DB:", e);
      dbInitPromise = null;
      reject(e);
    }
  });
  
  return dbInitPromise;
};

// Force close and reset connection (useful for error recovery)
export const resetOfflineDB = () => {
  if (dbInstance) {
    try { dbInstance.close(); } catch {}
    dbInstance = null;
  }
  dbInitPromise = null;
};

export const queuePendingAction = async (action: { type: string; url: string; method: string; data: any; timestamp: number }) => {
  try {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    const actionWithId = { ...action, id };
    await pendingSyncStore.setItem(id, actionWithId);
    debug.log(`[localforage] Action queued: ${action.type} (ID: ${id})`);
    return id;
  } catch (err) {
    debug.error('[localforage] Failed to queue action:', err);
    throw err;
  }
};

export const getPendingActions = async (): Promise<any[]> => {
  try {
    const fetchPromise = (async () => {
      const actions: any[] = [];
      await pendingSyncStore.iterate((value) => {
        actions.push(value);
      });
      return actions.sort((a, b) => a.timestamp - b.timestamp);
    })();
    // Timeout of 500ms to avoid blocking online operations
    const timeoutPromise = new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 500));
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (err) {
    debug.error('[localforage] Failed to get pending actions:', err);
    return [];
  }
};

export const getPendingActionsCount = async (): Promise<number> => {
  try {
    const lenPromise = pendingSyncStore.length();
    const timeoutPromise = new Promise<number>((resolve) => setTimeout(() => resolve(0), 500));
    return await Promise.race([lenPromise, timeoutPromise]);
  } catch {
    return 0;
  }
};

export const removePendingAction = async (id: any): Promise<void> => {
  try {
    await pendingSyncStore.removeItem(String(id));
    debug.log(`[localforage] Action removed: ID ${id}`);
  } catch (err) {
    debug.error('[localforage] Failed to remove action:', err);
  }
};

export const savePadronOffline = async (electors: any[], onProgress?: (pct: number) => void) => {
  const db = await initOfflineDB();
  
  // Clear existing data first with timeout
  try {
    await new Promise<void>((resolve, reject) => {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        resolve();
        return;
      }
      
      const timer = setTimeout(() => resolve(), 3000);
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => { clearTimeout(timer); resolve(); };
      request.onerror = () => { clearTimeout(timer); resolve(); };
    });
  } catch {}

  const CHUNK_SIZE = 4000;
  let processed = 0;
  const total = electors.length;

  const processChunk = async (startIndex: number) => {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        debug.warn(`[DB] Chunk timeout at index ${startIndex}`);
        resolve();
      }, 10000);

      try {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        const endIndex = Math.min(startIndex + CHUNK_SIZE, total);
        
        for (let i = startIndex; i < endIndex; i++) {
          const electorArr = electors[i];
          if (!electorArr || !electorArr[0]) continue;

          const rawLocal = (electorArr[3] || '').toString().trim();
          const cleanLocal = (!rawLocal || rawLocal === '0' || rawLocal.toLowerCase() === 'sin local' || rawLocal.toLowerCase() === 'desconocido' || rawLocal.toLowerCase() === 'dato no registrado') 
            ? 'DATO NO REGISTRADO' 
            : rawLocal.toUpperCase();

          const rawMesa = parseInt(electorArr[4]) || 0;
          const cleanMesa = rawMesa === 0 ? 'DATO NO REGISTRADO' : rawMesa;

          const rawOrden = parseInt(electorArr[5]) || 0;
          const cleanOrden = rawOrden === 0 ? 'DATO NO REGISTRADO' : rawOrden;

          const elector = {
            ci: electorArr[0].toString().trim(),
            nombre: electorArr[1] ? electorArr[1].toString().trim().toUpperCase() : 'SIN NOMBRE',
            apellido: electorArr[2] ? electorArr[2].toString().trim().toUpperCase() : 'DATO NO REGISTRADO',
            local_votacion: cleanLocal,
            mesa: cleanMesa,
            orden: cleanOrden,
            nombre_clean: (electorArr[1] || '').toString().toLowerCase().trim(),
            apellido_clean: (electorArr[2] || '').toString().toLowerCase().trim()
          };
          store.put(elector);
        }

        transaction.oncomplete = () => {
          clearTimeout(timer);
          processed = endIndex;
          if (onProgress) onProgress(Math.round((processed / total) * 100));
          resolve();
        };
        transaction.onerror = () => { clearTimeout(timer); resolve(); };
        transaction.onabort = () => { clearTimeout(timer); resolve(); };
      } catch (err) {
        clearTimeout(timer);
        resolve();
      }
    });
  };

  for (let i = 0; i < total; i += CHUNK_SIZE) {
    await processChunk(i);
    // Yield to main thread for 25ms to let UI render smoothly
    await new Promise(r => setTimeout(r, 25));
  }

  debug.log(`Successfully saved ${total} electors offline.`);
};

export const searchElectorOffline = async (query: string): Promise<any[]> => {
  try {
    const searchPromise = (async () => {
      const db = await initOfflineDB();
      return new Promise<any[]>((resolve, reject) => {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          resolve([]);
          return;
        }
        
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const results: any[] = [];
        const cleanQuery = query.toLowerCase().trim();
        const isNumeric = /^\d+$/.test(cleanQuery);

        if (isNumeric) {
          // Direct CI lookup (O(1))
          const request = store.get(cleanQuery);
          request.onsuccess = () => {
            if (request.result) resolve([request.result]);
            else resolve([]);
          };
          request.onerror = () => resolve([]);
          return;
        }

        // Cursor-based search limited to 20 results
        const request = store.openCursor();
        request.onsuccess = (event: any) => {
          const cursor = event.target.result;
          if (cursor) {
            const { nombre_clean, apellido_clean } = cursor.value;
            if (nombre_clean?.includes(cleanQuery) || apellido_clean?.includes(cleanQuery)) {
              results.push(cursor.value);
            }
            if (results.length < 20) {
              cursor.continue();
            } else {
              resolve(results);
            }
          } else {
            resolve(results);
          }
        };
        request.onerror = () => resolve([]);
      });
    })();

    const timeoutPromise = new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 1200));
    return await Promise.race([searchPromise, timeoutPromise]);
  } catch {
    return [];
  }
};

export const getOfflineStats = async (): Promise<number> => {
  try {
    const countPromise = (async () => {
      const db = await initOfflineDB();
      return new Promise<number>((resolve) => {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          resolve(0);
          return;
        }
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const countRequest = store.count();
        countRequest.onsuccess = () => resolve(countRequest.result || 0);
        countRequest.onerror = () => resolve(0);
      });
    })();

    const timeoutPromise = new Promise<number>((resolve) => setTimeout(() => resolve(0), 1000));
    return await Promise.race([countPromise, timeoutPromise]);
  } catch {
    return 0;
  }
};