import Piscina from 'piscina';
import path from 'path';

const isTs = __filename.endsWith('.ts');
const workerPath = path.resolve(__dirname, isTs ? 'db-worker.ts' : 'db-worker.js');

const pool = new Piscina({
  filename: workerPath,
  execArgv: isTs ? ['-r', 'ts-node/register'] : [],
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
