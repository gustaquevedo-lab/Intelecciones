import Piscina from 'piscina';
import path from 'path';

const workerPath = path.resolve(__dirname, 'db-worker.js');

const pool = new Piscina({
  filename: workerPath,
  maxThreads: 3,
  minThreads: 1,
  idleTimeout: 30000,
});

export async function dbQueryAsync<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return pool.run({ sql, params, method: 'all' }) as Promise<T[]>;
}

export async function dbGetAsync<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
  return pool.run({ sql, params, method: 'get' }) as Promise<T | undefined>;
}

export { pool };
