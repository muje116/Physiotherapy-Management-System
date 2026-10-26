const REQUIRED_VARS = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
const OPTIONAL_VARS = [
  'REDIS_URL',
  'FRONTEND_URL',
  'AWS_S3_BUCKET',
  'RESEND_API_KEY',
  'TWILIO_ACCOUNT_SID',
  'ANTHROPIC_API_KEY',
  'ONEKHUSA_API_KEY',
  'ONEKHUSA_API_SECRET',
  'ONEKHUSA_ORGANISATION_ID',
  'ONEKHUSA_MERCHANT_ACCOUNT_NUMBER',
  'ONEKHUSA_ENVIRONMENT',
  'ONEKHUSA_CURRENCY',
  'ONEKHUSA_CAPTURED_BY',
  'ONEKHUSA_WEBHOOK_SECRET',
  'ONEKHUSA_SANDBOX_URL',
  'ONEKHUSA_PRODUCTION_URL',
];

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
    const productionRequired = ['FRONTEND_URL', 'REDIS_URL'];
    const productionMissing = productionRequired.filter((key) => !process.env[key]);
    if (productionMissing.length > 0) {
      throw new Error(`Missing production environment variables: ${productionMissing.join(', ')}`);
    }

    const weakSecrets = REQUIRED_VARS.filter((key) => /change-me|dev|example|password/i.test(process.env[key] || ''));
    if (weakSecrets.length > 0) {
      throw new Error(`Production secrets must be replaced for: ${weakSecrets.join(', ')}`);
    }

    const frontendOrigins = (process.env.FRONTEND_URL || '').split(',').map((origin) => origin.trim()).filter(Boolean);
    if (frontendOrigins.length === 0) {
      throw new Error('FRONTEND_URL must contain at least one absolute URL in production');
    }
    for (const origin of frontendOrigins) {
      try {
        new URL(origin);
      } catch {
        throw new Error('Every FRONTEND_URL entry must be a valid absolute URL in production');
      }
    }

    try {
      const redisUrl = new URL(process.env.REDIS_URL as string);
      if (!['redis:', 'rediss:'].includes(redisUrl.protocol)) throw new Error('unsupported protocol');
    } catch {
      throw new Error('REDIS_URL must be a valid redis:// or rediss:// URL in production');
    }

    if (process.env.ONEKHUSA_ENVIRONMENT === 'PRODUCTION') {
      const paymentVars = [
        'ONEKHUSA_API_KEY',
        'ONEKHUSA_API_SECRET',
        'ONEKHUSA_ORGANISATION_ID',
        'ONEKHUSA_MERCHANT_ACCOUNT_NUMBER',
        'ONEKHUSA_WEBHOOK_SECRET',
      ];
      const missingPaymentVars = paymentVars.filter((key) => !process.env[key]);
      if (missingPaymentVars.length > 0) {
        throw new Error(`Missing production OneKhusa variables: ${missingPaymentVars.join(', ')}`);
      }
    }
  }
}
