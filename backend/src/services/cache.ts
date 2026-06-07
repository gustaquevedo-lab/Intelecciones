import Redis from 'ioredis';
import logger from '../utils/logger';

class CacheService {
  private redis: Redis | null = null;
  private memoryCache: Map<string, { value: any; expiry: number }> = new Map();
  private redisConnected = false;

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      logger.info(`[CACHE] Redis URL detected. Initializing connection...`);
      try {
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 1,
          retryStrategy: (times) => {
            if (times > 3) {
              logger.warn(`[CACHE] Redis connection failed 3 times. Falling back to Memory Cache (degraded mode).`);
              this.redisConnected = false;
              return null; // stop retrying
            }
            return Math.min(times * 100, 2000);
          }
        });

        this.redis.on('connect', () => {
          logger.info('[CACHE] Redis connected successfully.');
          this.redisConnected = true;
        });

        this.redis.on('error', (err) => {
          logger.error({ err }, '[CACHE] Redis error');
          this.redisConnected = false;
        });
      } catch (e) {
        logger.error({ err: e }, '[CACHE] Failed to create Redis client. Running in degraded memory mode');
      }
    } else {
      logger.info('[CACHE] No REDIS_URL environment variable found. Operating in local memory cache mode.');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redisConnected && this.redis) {
      try {
        const val = await this.redis.get(key);
        if (val) return JSON.parse(val) as T;
        return null;
      } catch (e) {
        logger.error({ err: e }, `[CACHE] Redis get error for key ${key}`);
      }
    }

    // Memory Fallback
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.memoryCache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async delete(key: string): Promise<void> {
    if (this.redisConnected && this.redis) {
      try {
        await this.redis.del(key);
        return;
      } catch (e) {
        logger.error({ err: e }, `[CACHE] Redis delete error for key ${key}`);
      }
    }
    this.memoryCache.delete(key);
  }

  async set<T>(key: string, value: T, ttlSec: number): Promise<void> {
    if (this.redisConnected && this.redis) {
      try {
        await this.redis.set(key, JSON.stringify(value), 'EX', ttlSec);
        return;
      } catch (e) {
        logger.error({ err: e }, `[CACHE] Redis set error for key ${key}`);
      }
    }

    // Memory Fallback
    const expiry = Date.now() + ttlSec * 1000;
    this.memoryCache.set(key, { value, expiry });
  }

  async invalidate(prefix: string): Promise<void> {
    if (this.redisConnected && this.redis) {
      try {
        const keys = await this.redis.keys(`${prefix}*`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
        return;
      } catch (e) {
        logger.error({ err: e }, `[CACHE] Redis invalidate error for prefix ${prefix}`);
      }
    }

    // Memory Fallback
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        this.memoryCache.delete(key);
      }
    }
  }

  async clearAll(): Promise<void> {
    if (this.redisConnected && this.redis) {
      try {
        await this.redis.flushdb();
        return;
      } catch (e) {
        logger.error({ err: e }, '[CACHE] Redis flushdb error');
      }
    }
    this.memoryCache.clear();
  }

  cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now > entry.expiry) {
        this.memoryCache.delete(key);
      }
    }
  }
}

export const cacheService = new CacheService();

// Periodically clean up expired local memory cache keys every 5 minutes
setInterval(() => {
  cacheService.cleanupExpired();
}, 300000);
