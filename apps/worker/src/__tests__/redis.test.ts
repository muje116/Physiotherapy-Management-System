import { describe, expect, it } from 'vitest';
import { parseRedisConnection } from '../redis';

describe('redis connection parsing', () => {
  it('preserves authentication, database, and TLS settings from a managed Redis URL', () => {
    expect(parseRedisConnection('rediss://worker:secret%21@redis.example.com:6380/4')).toEqual({
      host: 'redis.example.com',
      port: 6380,
      username: 'worker',
      password: 'secret!',
      db: 4,
      tls: {},
    });
  });

  it('uses safe local defaults when no URL is supplied', () => {
    expect(parseRedisConnection(undefined)).toEqual({ host: 'localhost', port: 6379 });
  });
});
