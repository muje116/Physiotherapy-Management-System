import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@physiocore/db', () => ({
  prisma: {
    invoice: {
      findFirst: vi.fn(),
    },
  },
  AppointmentStatus: {
    CANCELLED: 'CANCELLED',
  },
}));

vi.mock('../services/payment-request.service', () => ({
  createPaymentRequest: vi.fn(),
  listPatientPaymentRequests: vi.fn(),
}));

import { prisma } from '@physiocore/db';
import { createPaymentRequest } from '../services/payment-request.service';
import * as portalService from '../services/portal.service';

describe('portal.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a pending payment request instead of completing an invoice directly', async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      id: 'invoice-1',
      patientId: 'patient-1',
      tenantId: 'tenant-1',
      status: 'UNPAID',
    } as any);
    vi.mocked(createPaymentRequest).mockResolvedValue({
      id: 'request-1',
      status: 'PENDING',
    } as any);

    const result = await portalService.payInvoice('tenant-1', 'patient-1', 'invoice-1', 'portal-user-1');

    expect(createPaymentRequest).toHaveBeenCalledWith('tenant-1', 'portal-user-1', {
      invoiceId: 'invoice-1',
    });
    expect(result).toEqual({ id: 'request-1', status: 'PENDING' });
  });

  it('refuses to create a second request for an already paid invoice', async () => {
    vi.mocked(prisma.invoice.findFirst).mockResolvedValue({
      id: 'invoice-1',
      patientId: 'patient-1',
      tenantId: 'tenant-1',
      status: 'PAID',
    } as any);

    await expect(
      portalService.payInvoice('tenant-1', 'patient-1', 'invoice-1', 'portal-user-1'),
    ).rejects.toThrow('Invoice is already paid');
    expect(createPaymentRequest).not.toHaveBeenCalled();
  });
});
