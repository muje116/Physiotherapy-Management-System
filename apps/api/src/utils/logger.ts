import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  transport: isProduction
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true } },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'body.password', 'body.passwordHash'],
    censor: '[REDACTED]',
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      headers: { ...req.headers, authorization: '[REDACTED]' },
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
    err: pino.stdSerializers.err,
  },
});

export function createRequestLogger(requestId: string) {
  return logger.child({ requestId });
}
