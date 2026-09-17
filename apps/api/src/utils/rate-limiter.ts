export const RATE_LIMIT_CONFIG = {
  auth: { max: 100, timeWindow: '1 minute' },
  default: { max: 500, timeWindow: '1 minute' },
  sensitive: { max: 20, timeWindow: '1 minute' },
  export: { max: 10, timeWindow: '1 minute' },
};

export function getRateLimitConfig(route: string) {
  if (route.startsWith('/api/v1/auth/')) return RATE_LIMIT_CONFIG.auth;
  if (route.includes('/reset-password') || route.includes('/forgot-password')) return RATE_LIMIT_CONFIG.sensitive;
  if (route.includes('/export') || route.includes('/pdf')) return RATE_LIMIT_CONFIG.export;
  return RATE_LIMIT_CONFIG.default;
}
