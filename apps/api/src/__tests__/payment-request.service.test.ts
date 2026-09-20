import { createHmac } from 'node:crypto';
import { describe, expect, it, vi, afterEach } from 'vitest';

vi.mock('@physiocore/db', () => ({
  prisma: {},
  InvoiceStatus: {
    PAID: 'PAID',
    MEDICAL_AID_APPROVED: 'MEDICAL_AID_APPROVED',
    VOID: 'VOID',
    UNPAID: 'UNPAID',
  },
}));

vi.mock('../services/notification.service', () => ({
  sendNotification: vi.fn(),
}));

vi.mock('../services/payment.service', () => ({
  recordPayment: vi.fn(),
}));

import { verifyWebhookSignature } from '../services/payment-request.service';

describe('payment-request.service', () => {
  afterEach(() => {
    delete process.env.ONEKHUSA_WEBHOOK_SECRET;
  });

  it('verifies OneKhusa webhook signatures against the raw body', () => {
    const rawBody = '{"transactionAmount":500}';
    process.env.ONEKHUSA_WEBHOOK_SECRET = 'webhook-secret';
    const signature = createHmac('sha512', process.env.ONEKHUSA_WEBHOOK_SECRET)
      .update(rawBody, 'utf8')
      .digest('hex');

    expect(verifyWebhookSignature(rawBody, signature)).toBe(true);
    expect(verifyWebhookSignature(`${rawBody} `, signature)).toBe(false);
    expect(verifyWebhookSignature(rawBody, 'invalid')).toBe(false);
  });
});
