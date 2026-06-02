import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let dbDir = process.env.NODE_ENV === 'production' ? '/app/data' : process.cwd();
if (process.env.NODE_ENV !== 'production') {
  const rootBackendPath = path.join(process.cwd(), 'backend');
  if (fs.existsSync(rootBackendPath) && fs.statSync(rootBackendPath).isDirectory()) {
    dbDir = rootBackendPath;
  }
}
const dbPath = path.join(dbDir, 'intellecciones.db');

const db = new Database(dbPath, { readonly: true });
try {
  db.pragma('journal_mode = WAL');
} catch (err: any) {
  console.warn("WARNING: SQLite WAL mode failed to initialize (readonly worker), falling back to DELETE mode:", err.message);
  try {
    db.pragma('journal_mode = DELETE');
  } catch (err2) {
    console.error("Critical: Fallback journal mode failed (readonly worker):", err2);
  }
}
db.pragma('cache_size = -32768');
db.pragma('temp_store = MEMORY');
db.pragma('mmap_size = 268435456');
db.pragma('query_only = true');

interface QueryTask {
  sql: string;
  params: any[];
  method: 'all' | 'get';
}

export default function runQuery({ sql, params, method }: QueryTask) {
  const stmt = db.prepare(sql);
  return method === 'get' ? stmt.get(...params) : stmt.all(...params);
}
