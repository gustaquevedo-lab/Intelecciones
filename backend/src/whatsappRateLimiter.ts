import db from './db';

interface DailyStats {
  terminalId: string;
  date: string;
  sent: number;
  lastSentAt: number;
}

interface WarmupTier {
  maxDaily: number;
  minDelaySec: number;
  maxDelaySec: number;
  batchSize: number;
  batchPauseMinSec: number;
  batchPauseMaxSec: number;
}

// Warmup tiers based on terminal age (days since first connection)
const WARMUP_TIERS: Record<string, WarmupTier> = {
  // Days 0-3: barely send anything
  baby: { maxDaily: 10, minDelaySec: 60, maxDelaySec: 180, batchSize: 3, batchPauseMinSec: 600, batchPauseMaxSec: 1200 },
  // Days 4-7: very conservative
  infant: { maxDaily: 25, minDelaySec: 45, maxDelaySec: 120, batchSize: 5, batchPauseMinSec: 300, batchPauseMaxSec: 600 },
  // Days 8-14: building trust
  young: { maxDaily: 60, minDelaySec: 30, maxDelaySec: 90, batchSize: 8, batchPauseMinSec: 180, batchPauseMaxSec: 420 },
  // Days 15-21: moderate
  teen: { maxDaily: 120, minDelaySec: 20, maxDelaySec: 60, batchSize: 12, batchPauseMinSec: 120, batchPauseMaxSec: 300 },
  // Days 22+: mature (still conservative vs commercial tools)
  adult: { maxDaily: 200, minDelaySec: 15, maxDelaySec: 45, batchSize: 15, batchPauseMinSec: 90, batchPauseMaxSec: 240 },
};

// Track daily sends per terminal in memory (persisted to DB on write)
const dailyCounters = new Map<string, DailyStats>();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function getTerminalAge(terminalId: string): number {
  try {
    const row = db.prepare('SELECT created_at FROM whatsapp_terminals WHERE id = ?').get(terminalId) as any;
    if (!row?.created_at) return 0;
    const created = new Date(row.created_at).getTime();
    return Math.floor((Date.now() - created) / 86400000);
  } catch {
    return 0;
  }
}

export function getWarmupTier(terminalId: string): WarmupTier {
  const age = getTerminalAge(terminalId);
  if (age <= 3) return WARMUP_TIERS.baby;
  if (age <= 7) return WARMUP_TIERS.infant;
  if (age <= 14) return WARMUP_TIERS.young;
  if (age <= 21) return WARMUP_TIERS.teen;
  return WARMUP_TIERS.adult;
}

export function getDailyCount(terminalId: string): number {
  const key = `${terminalId}:${today()}`;
  const stats = dailyCounters.get(key);
  if (stats) return stats.sent;

  try {
    const row = db.prepare(
      'SELECT sent_count FROM whatsapp_daily_stats WHERE terminal_id = ? AND date = ?'
    ).get(terminalId, today()) as any;
    const count = row?.sent_count || 0;
    dailyCounters.set(key, { terminalId, date: today(), sent: count, lastSentAt: 0 });
    return count;
  } catch {
    return 0;
  }
}

export function incrementDailyCount(terminalId: string): void {
  const key = `${terminalId}:${today()}`;
  let stats = dailyCounters.get(key);
  if (!stats) {
    stats = { terminalId, date: today(), sent: 0, lastSentAt: 0 };
  }
  stats.sent++;
  stats.lastSentAt = Date.now();
  dailyCounters.set(key, stats);

  try {
    db.prepare(`
      INSERT INTO whatsapp_daily_stats (terminal_id, date, sent_count)
      VALUES (?, ?, 1)
      ON CONFLICT(terminal_id, date) DO UPDATE SET sent_count = sent_count + 1
    `).run(terminalId, today());
  } catch {}
}

export function canSendMore(terminalId: string): { allowed: boolean; reason?: string; tier: WarmupTier } {
  const tier = getWarmupTier(terminalId);
  const count = getDailyCount(terminalId);

  if (count >= tier.maxDaily) {
    return {
      allowed: false,
      reason: `Límite diario alcanzado (${count}/${tier.maxDaily}). El número necesita más tiempo de warmup para enviar más.`,
      tier
    };
  }

  return { allowed: true, tier };
}

export function getSmartDelay(terminalId: string, messageIndex: number): number {
  const tier = getWarmupTier(terminalId);

  // Is this a batch pause point?
  if (messageIndex > 0 && messageIndex % tier.batchSize === 0) {
    const pause = tier.batchPauseMinSec + Math.random() * (tier.batchPauseMaxSec - tier.batchPauseMinSec);
    return pause * 1000;
  }

  // Normal inter-message delay with gaussian-like distribution (more natural)
  const range = tier.maxDelaySec - tier.minDelaySec;
  const base = tier.minDelaySec + range * gaussianRandom();

  // Add 10% jitter for naturalness
  const jitter = base * 0.1 * (Math.random() - 0.5);
  return Math.max(tier.minDelaySec * 1000, (base + jitter) * 1000);
}

// Produces values clustered around 0.5 (more natural than uniform random)
function gaussianRandom(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(0, Math.min(1, (z / 6) + 0.5));
}

// Calculate a realistic typing delay based on message length
export function getTypingDelay(messageLength: number): number {
  // Average human types 40 WPM = 200 chars/min = 3.3 chars/sec
  // But reading + thinking takes additional time
  const typingTime = (messageLength / 3.3) * 1000;
  const thinkingTime = 1500 + Math.random() * 3000;
  // Cap at reasonable limits
  return Math.min(Math.max(typingTime + thinkingTime, 3000), 15000);
}

// Time-of-day awareness: reduce sends during off-hours
export function isGoodSendingHour(): boolean {
  const hour = new Date().getHours();
  // Paraguay timezone consideration - avoid early morning and late night
  return hour >= 7 && hour <= 21;
}

// Get status summary for the frontend
export function getTerminalWarmupStatus(terminalId: string) {
  const age = getTerminalAge(terminalId);
  const tier = getWarmupTier(terminalId);
  const count = getDailyCount(terminalId);

  let phaseName: string;
  if (age <= 3) phaseName = 'Recién nacido (crítico)';
  else if (age <= 7) phaseName = 'Infante (muy conservador)';
  else if (age <= 14) phaseName = 'Joven (construyendo confianza)';
  else if (age <= 21) phaseName = 'Adolescente (moderado)';
  else phaseName = 'Maduro (estable)';

  return {
    terminalId,
    ageDays: age,
    phase: phaseName,
    maxDailyAllowed: tier.maxDaily,
    sentToday: count,
    remaining: Math.max(0, tier.maxDaily - count),
    delayRange: `${tier.minDelaySec}-${tier.maxDelaySec}s`,
    batchSize: tier.batchSize,
    batchPause: `${Math.round(tier.batchPauseMinSec / 60)}-${Math.round(tier.batchPauseMaxSec / 60)} min`,
    isGoodHour: isGoodSendingHour(),
  };
}

// Ensure the stats table exists
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS whatsapp_daily_stats (
      terminal_id TEXT NOT NULL,
      date TEXT NOT NULL,
      sent_count INTEGER DEFAULT 0,
      PRIMARY KEY (terminal_id, date)
    )
  `);
} catch {}
