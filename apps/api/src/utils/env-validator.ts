const REQUIRED_VARS = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
const OPTIONAL_VARS = ['REDIS_URL', 'FRONTEND_URL', 'AWS_S3_BUCKET', 'RESEND_API_KEY', 'TWILIO_ACCOUNT_SID', 'ANTHROPIC_API_KEY'];

export function validateEnv(): void {
  const missing: string[] = [];

  for (const key of REQUIRED_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (process.env.NODE_ENV === 'production') {
    for (const key of REQUIRED_VARS) {
      if (process.env[key]?.includes('change-me') || process.env[key]?.includes('dev')) {
        console.warn(`WARNING: ${key} appears to use a development/default value in production`);
      }
    }
  }
}
