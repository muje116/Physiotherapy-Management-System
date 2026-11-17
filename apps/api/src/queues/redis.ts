export type RedisConnection = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: Record<string, never>;
};

export function parseRedisConnection(value = process.env.REDIS_URL): RedisConnection {
  const redisUrl = value ? new URL(value) : null;
  const connection: RedisConnection = {
    host: process.env.REDIS_HOST || redisUrl?.hostname || 'localhost',
    port: parseInt(process.env.REDIS_PORT || redisUrl?.port || '6379', 10),
  };

  if (redisUrl?.username) connection.username = decodeURIComponent(redisUrl.username);
  if (redisUrl?.password) connection.password = decodeURIComponent(redisUrl.password);
  if (redisUrl?.pathname && redisUrl.pathname !== '/') connection.db = Number(redisUrl.pathname.slice(1));
  if (redisUrl?.protocol === 'rediss:') connection.tls = {};

  return connection;
}

export const redisConnection = parseRedisConnection();

// API requests should fail quickly when Redis is unavailable instead of
// keeping an open reconnect loop that adds latency and floods the logs. The
// worker owns long-lived Redis connections and can use the base connection.
export const redisProducerConnection = {
  ...redisConnection,
  connectTimeout: 3000,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  retryStrategy: () => null,
};
