import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
  keys: vi.fn(),
  del: vi.fn(),
  flushdb: vi.fn(),
  quit: vi.fn(),
};

vi.mock('ioredis', () => ({
  default: vi.fn(() => mockRedis),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

import { getCached, invalidateCache, clearAllCache, closeRedis } from '../services/cache.service';

describe('cache.service', () => {
  describe('getCached', () => {
    it('should return cached data when available', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ id: 1, name: 'cached' }));
      const fetcher = vi.fn();

      const result = await getCached('test-key', fetcher, 60);

      expect(result).toEqual({ id: 1, name: 'cached' });
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('should fetch and cache when cache misses', async () => {
      mockRedis.get.mockResolvedValue(null);
      const fetcher = vi.fn().mockResolvedValue({ id: 2, name: 'fresh' });

      const result = await getCached('test-key', fetcher, 60);

      expect(result).toEqual({ id: 2, name: 'fresh' });
      expect(fetcher).toHaveBeenCalledOnce();
      expect(mockRedis.setex).toHaveBeenCalledWith('test-key', 60, JSON.stringify({ id: 2, name: 'fresh' }));
    });

    it('should fall through to fetcher on Redis error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis down'));
      const fetcher = vi.fn().mockResolvedValue({ id: 3, name: 'fallback' });

      const result = await getCached('test-key', fetcher, 60);

      expect(result).toEqual({ id: 3, name: 'fallback' });
      expect(fetcher).toHaveBeenCalledOnce();
    });
  });

  describe('invalidateCache', () => {
    it('should delete keys matching the pattern', async () => {
      mockRedis.keys.mockResolvedValue(['user:1', 'user:2']);

      await invalidateCache('user:*');

      expect(mockRedis.keys).toHaveBeenCalledWith('user:*');
      expect(mockRedis.del).toHaveBeenCalledWith('user:1', 'user:2');
    });

    it('should not call del when no keys match', async () => {
      mockRedis.keys.mockResolvedValue([]);

      await invalidateCache('nonexistent:*');

      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('should silently handle errors', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));

      await expect(invalidateCache('test:*')).resolves.toBeUndefined();
    });
  });

  describe('clearAllCache', () => {
    it('should flush the Redis database', async () => {
      await clearAllCache();
      expect(mockRedis.flushdb).toHaveBeenCalledOnce();
    });

    it('should silently handle errors', async () => {
      mockRedis.flushdb.mockRejectedValue(new Error('Redis error'));
      await expect(clearAllCache()).resolves.toBeUndefined();
    });
  });

  describe('closeRedis', () => {
    it('should quit the Redis connection', async () => {
      await closeRedis();
      expect(mockRedis.quit).toHaveBeenCalledOnce();
    });
  });
});
