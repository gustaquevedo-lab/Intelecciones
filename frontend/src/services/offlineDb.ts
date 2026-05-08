
const DB_NAME = 'InteleccionesOffline';
const DB_VERSION = 1;
const STORE_NAME = 'electors';

export const initOfflineDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'ci' });
        store.createIndex('nombre', 'nombre', { unique: false });
        store.createIndex('apellido', 'apellido', { unique: false });
        store.createIndex('full_name', ['nombre', 'apellido'], { unique: false });
      }
    };
  });
};

export const savePadronOffline = async (electors: any[], onProgress?: (pct: number) => void) => {
  const db = await initOfflineDB();
  
  // Clear existing data first
  await new Promise<void>((resolve, reject) => {
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

        const elector = {
          ci: electorArr[0].toString(),
          nombre: electorArr[1] || '',
          apellido: electorArr[2] || '',
          local_votacion: electorArr[3] || 'DESCONOCIDO',
          mesa: electorArr[4] || 0,
          orden: electorArr[5] || 0,
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
    // Yield to main thread
    await new Promise(r => setTimeout(r, 0));
  }

  console.log(`Successfully saved ${total} electors offline in chunks.`);
};

export const searchElectorOffline = async (query: string): Promise<any[]> => {
  const db = await initOfflineDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const results: any[] = [];
    const cleanQuery = query.toLowerCase().trim();
    const isNumeric = /^\d+$/.test(cleanQuery);

    if (isNumeric) {
      // Direct CI lookup
      const request = store.get(cleanQuery);
      request.onsuccess = () => {
        if (request.result) resolve([request.result]);
        else resolve([]);
      };
      return;
    }

    // Name/Apellido search (Cursor-based)
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
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const countRequest = store.count();
    countRequest.onsuccess = () => resolve(countRequest.result);
  });
};
