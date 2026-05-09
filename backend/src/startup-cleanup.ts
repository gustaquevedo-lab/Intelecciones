/**
 * startup-cleanup.ts
 *
 * Runs once at startup (production only) to:
 *  1. Remove stale / empty WhatsApp session directories from /app/data
 *  2. Run SQLite VACUUM + optimize to compact the database and reclaim space
 *
 * Failures are caught and logged — they never crash the app.
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

// ─── Constants ────────────────────────────────────────────────────────────────

const DATA_DIR = '/app/data';

/**
 * A session directory is considered "stale" when its most-recently-modified
 * file is older than this threshold.  Active Puppeteer sessions touch their
 * lock files every few seconds, so 2 hours is a very conservative cutoff.
 */
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Recursively compute the newest mtime inside a directory tree. */
function newestMtime(dirPath: string): number {
  let newest = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        newest = Math.max(newest, newestMtime(full));
      } else {
        const mtime = fs.statSync(full).mtimeMs;
        newest = Math.max(newest, mtime);
      }
    }
  } catch {
    // Ignore permission errors or race conditions
  }
  return newest;
}

/** Recursively compute the total size (bytes) of a directory tree. */
function dirSize(dirPath: string): number {
  let total = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        total += dirSize(full);
      } else {
        total += fs.statSync(full).size;
      }
    }
  } catch {
    // Ignore
  }
  return total;
}

/** Recursively delete a directory and all its contents. */
function rmrf(dirPath: string): void {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      rmrf(full);
    } else {
      fs.unlinkSync(full);
    }
  }
  fs.rmdirSync(dirPath);
}

// ─── WhatsApp session cleanup ─────────────────────────────────────────────────

/**
 * Scans DATA_DIR for directories whose names start with "whatsapp_session"
 * (covers both the legacy "whatsapp_session" and "whatsapp_session_<id>"
 * patterns) and removes any that are either empty or have not been touched
 * within STALE_THRESHOLD_MS.
 *
 * Active sessions are left untouched.
 */
export function cleanupWhatsAppSessions(): void {
  if (!fs.existsSync(DATA_DIR)) {
    console.log('[CLEANUP] /app/data does not exist — skipping WhatsApp session cleanup.');
    return;
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
  } catch (err) {
    console.error('[CLEANUP] Cannot read /app/data:', err);
    return;
  }

  const sessionDirs = entries.filter(
    e => e.isDirectory() && e.name.startsWith('whatsapp_session')
  );

  if (sessionDirs.length === 0) {
    console.log('[CLEANUP] No WhatsApp session directories found.');
    return;
  }

  const now = Date.now();
  let removed = 0;
  let skipped = 0;

  for (const entry of sessionDirs) {
    const fullPath = path.join(DATA_DIR, entry.name);
    try {
      const size = dirSize(fullPath);
      const latest = newestMtime(fullPath);
      const ageMs = now - latest;
      const ageMins = Math.round(ageMs / 60_000);

      if (size === 0) {
        console.log(`[CLEANUP] Removing empty session dir: ${entry.name}`);
        rmrf(fullPath);
        removed++;
      } else if (ageMs > STALE_THRESHOLD_MS) {
        console.log(
          `[CLEANUP] Removing stale session dir: ${entry.name} ` +
          `(${(size / 1024 / 1024).toFixed(2)} MB, last active ${ageMins} min ago)`
        );
        rmrf(fullPath);
        removed++;
      } else {
        console.log(
          `[CLEANUP] Keeping active session dir: ${entry.name} ` +
          `(${(size / 1024 / 1024).toFixed(2)} MB, last active ${ageMins} min ago)`
        );
        skipped++;
      }
    } catch (err) {
      console.error(`[CLEANUP] Error processing ${entry.name}:`, err);
    }
  }

  console.log(
    `[CLEANUP] WhatsApp sessions: ${removed} removed, ${skipped} kept.`
  );
}

// ─── Database compaction ──────────────────────────────────────────────────────

/**
 * Runs PRAGMA optimize and VACUUM on the given database to compact it and
 * reclaim free pages left behind by deletions / migrations.
 *
 * Reports before/after file sizes so the effect is visible in logs.
 */
export function compactDatabase(db: Database.Database, dbPath: string): void {
  try {
    const sizeBefore = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
    console.log(
      `[CLEANUP] DB size before compaction: ${(sizeBefore / 1024 / 1024).toFixed(2)} MB`
    );

    // Flush WAL frames back into the main file before VACUUM
    db.pragma('wal_checkpoint(TRUNCATE)');

    // Let SQLite update internal statistics (fast, no-op if already fresh)
    db.pragma('optimize');

    // Rebuild the database file, reclaiming all free pages
    db.exec('VACUUM');

    const sizeAfter = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
    const savedMB = ((sizeBefore - sizeAfter) / 1024 / 1024).toFixed(2);
    console.log(
      `[CLEANUP] DB size after compaction: ${(sizeAfter / 1024 / 1024).toFixed(2)} MB ` +
      `(saved ${savedMB} MB)`
    );
  } catch (err) {
    console.error('[CLEANUP] Database compaction failed (non-fatal):', err);
  }
}
