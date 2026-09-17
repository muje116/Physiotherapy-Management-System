import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let redis: Redis | null = null;

function getClient(): Redis {
  if (!redis) {
    redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 3 });
  }
  return redis;
}

const DEFAULT_TTL = 300; // 5 minutes

export async function getCached<T>(key: string, fetcher: () => Promise<T>, ttl = DEFAULT_TTL): Promise<T> {
  try {
    const client = getClient();
    const cached = await client.get(key);
    if (cached) return JSON.parse(cached);

    const data = await fetcher();
    await client.setex(key, ttl, JSON.stringify(data));
    return data;
  } catch {
    return fetcher();
  }
}

export async function invalidateCache(pattern: string): Promise<void> {
  try {
    const client = getClient();
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch {
    // Silently fail cache invalidation
  }
}

export async function clearAllCache(): Promise<void> {
  try {
    const client = getClient();
    await client.flushdb();
  } catch {}
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
