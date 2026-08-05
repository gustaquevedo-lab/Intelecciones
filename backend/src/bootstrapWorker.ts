/**
 * bootstrapWorker.ts
 *
 * Runs inside a Node.js Worker Thread.
 * Calls runBootstrapChecks() in a SEPARATE OS THREAD so the main Express
 * event loop is NEVER blocked — preventing Railway 502 timeouts.
 */
import { parentPort } from 'worker_threads';

try {
  parentPort?.postMessage({ status: 'started' });
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { runBootstrapChecks } = require('./db');
  parentPort?.postMessage({ status: 'running_bootstrap' });
  runBootstrapChecks();
  parentPort?.postMessage({ status: 'done' });
} catch (err: any) {
  parentPort?.postMessage({ status: 'error', message: err?.message });
  process.exit(1);
}
