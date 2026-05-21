const DB_NAME = 'InteleccionesOffline';
const DB_VERSION = 3; // Incremented for new indexes
const STORE_NAME = 'electors';
const SYNC_STORE = 'pending_sync';

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
      console.log(`[DB] Opening IndexedDB: ${DB_NAME} v${DB_VERSION}`);
      
      // Close existing connection if version mismatch
      if (dbInstance) {
        try { dbInstance.close(); } catch {}
        dbInstance = null;
      }
      
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error("[DB] Error opening IndexedDB:", request.error);
        dbInitPromise = null;
        reject(request.error);
      };
      
      request.onsuccess = () => {
        const db = request.result;
        dbInstance = db;
        dbInitPromise = null;
        
        // Handle version change for existing connections
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          console.warn(`[DB] Store ${STORE_NAME} missing, recreating...`);
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

        // Store for Pending Sync Actions (Captures, Votes, etc.)
        if (!db.objectStoreNames.contains(SYNC_STORE)) {
          const syncStore = db.createObjectStore(SYNC_STORE, { keyPath: 'id', autoIncrement: true });
          // Add indexes for faster lookups
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
          syncStore.createIndex('type', 'type', { unique: false });
        }
        
        console.log(`[DB] IndexedDB schema updated to v${DB_VERSION}`);
      };
    } catch (e) {
      console.error("[DB] Critical error opening DB:", e);
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
  const db = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    // Check if transaction is active
    if (!db.objectStoreNames.contains(SYNC_STORE)) {
      console.error('[DB] Sync store not available');
      reject(new Error('Sync store not available'));
      return;
    }
    
    try {
      const transaction = db.transaction(SYNC_STORE, 'readwrite');
      const store = transaction.objectStore(SYNC_STORE);
      const request = store.add(action);
      
      request.onsuccess = () => {
        console.log(`[DB] Action queued: ${action.type} (ID: ${request.result})`);
        resolve(request.result);
      };
      
      request.onerror = () => {
        console.error('[DB] Failed to queue action:', request.error);
        reject(request.error);
      };
      
      // Handle transaction errors
      transaction.onerror = () => {
        console.error('[DB] Transaction error:', transaction.error);
        reject(transaction.error);
      };
    } catch (err) {
      console.error('[DB] Exception queueing action:', err);
      // Reset connection on error
      resetOfflineDB();
      reject(err);
    }
  });
};

export const getPendingActions = async (): Promise<any[]> => {
  const db = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(SYNC_STORE)) {
      resolve([]);
      return;
    }
    
    try {
      const transaction = db.transaction(SYNC_STORE, 'readonly');
      const store = transaction.objectStore(SYNC_STORE);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const results = request.result || [];
        console.log(`[DB] Retrieved ${results.length} pending actions`);
        resolve(results);
      };
      
      request.onerror = () => {
        console.error('[DB] Failed to get pending actions:', request.error);
        reject(request.error);
      };
      
      transaction.onerror = () => {
        console.error('[DB] Transaction error:', transaction.error);
        reject(transaction.error);
      };
    } catch (err) {
      console.error('[DB] Exception getting pending actions:', err);
      resolve([]); // Return empty on error rather than crashing
    }
  });
};

export const getPendingActionsCount = async (): Promise<number> => {
  const db = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(SYNC_STORE)) {
      resolve(0);
      return;
    }
    
    try {
      const transaction = db.transaction(SYNC_STORE, 'readonly');
      const store = transaction.objectStore(SYNC_STORE);
      const countRequest = store.count();
      
      countRequest.onsuccess = () => resolve(countRequest.result);
      countRequest.onerror = () => reject(countRequest.error);
    } catch {
      resolve(0);
    }
  });
};

export const removePendingAction = async (id: number): Promise<void> => {
  const db = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(SYNC_STORE)) {
      resolve(); // Already empty
      return;
    }
    
    try {
      const transaction = db.transaction(SYNC_STORE, 'readwrite');
      const store = transaction.objectStore(SYNC_STORE);
      const request = store.delete(id);
      
      request.onsuccess = () => {
        console.log(`[DB] Action removed: ID ${id}`);
        resolve();
      };
      
      request.onerror = () => {
        console.error('[DB] Failed to remove action:', request.error);
        reject(request.error);
      };
    } catch (err) {
      console.error('[DB] Exception removing action:', err);
      resolve(); // Don't fail on remove errors
    }
  });
};

export const savePadronOffline = async (electors: any[], onProgress?: (pct: number) => void) => {
  const db = await initOfflineDB();
  
  // Clear existing data first
  await new Promise<void>((resolve, reject) => {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      resolve();
      return;
    }
    
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  const CHUNK_SIZE = 500;
  let processed = 0;
  const total = electors.length;

  const processChunk = async (startIndex: number) => {
    return new Promise<void>((resolve, reject) => {
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
        processed = endIndex;
        if (onProgress) onProgress(Math.round((processed / total) * 100));
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  };

  for (let i = 0; i < total; i += CHUNK_SIZE) {
    await processChunk(i);
    // Yield to main thread to keep UI responsive
    await new Promise(r => setTimeout(r, 0));
  }

  console.log(`Successfully saved ${total} electors offline in chunks.`);
};

export const searchElectorOffline = async (query: string): Promise<any[]> => {
  const db = await initOfflineDB();
  
  return new Promise((resolve, reject) => {
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
      // Direct CI lookup (O(1) instead of O(n))
      const request = store.get(cleanQuery);
      request.onsuccess = () => {
        if (request.result) resolve([request.result]);
        else resolve([]);
      };
      request.onerror = () => reject(request.error);
      return;
    }

    // Name/Apellido search (Cursor-based) - O(n) but limited to 50 results
    const request = store.openCursor();
    request.onsuccess = (event: any) => {
      const cursor = event.target.result;
      if (cursor) {
        const { nombre_clean, apellido_clean } = cursor.value;
        if (nombre_clean.includes(cleanQuery) || apellido_clean.includes(cleanQuery)) {
          results.push(cursor.value);
        }
        
        // Limit results to 50 for performance
        if (results.length < 50) {
          cursor.continue();
        } else {
          resolve(results);
        }
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
};

export const getOfflineStats = async () => {
  const db = await initOfflineDB();
  
  return new Promise<number>((resolve) => {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      resolve(0);
      return;
    }
    
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const countRequest = store.count();
    countRequest.onsuccess = () => resolve(countRequest.result);
    countRequest.onerror = () => resolve(0);
  });
};