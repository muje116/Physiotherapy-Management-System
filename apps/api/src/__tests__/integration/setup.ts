import { vi } from 'vitest';

process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5433/physiocore_test';
process.env.REDIS_URL ??= 'redis://localhost:6380';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

// Integration tests exercise HTTP contracts and mock persistence; queue delivery is
// covered by worker tests and should not require a live Redis daemon here.
vi.mock('bullmq', () => ({
  Queue: class {
    add = vi.fn();
    close = vi.fn();
  },
}));
