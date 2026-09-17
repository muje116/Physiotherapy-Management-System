import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@physiocore/db', () => ({
  prisma: {
    patient: {
      findFirst: vi.fn(),
    },
  },
}));

import { sanitizeInput, calculateVat, generatePatientCode } from '../utils/helpers';
import { prisma } from '@physiocore/db';

describe('sanitizeInput', () => {
  it('should strip HTML tags', () => {
    const result = sanitizeInput('<script>alert("xss")</script>Hello');
    expect(result).toBe('alert("xss")Hello');
  });

  it('should strip all angle bracket tags', () => {
    const result = sanitizeInput('<p>Hello <b>World</b></p>');
    expect(result).toBe('Hello World');
  });

  it('should return empty string for entirely HTML input', () => {
    const result = sanitizeInput('<div><span></span></div>');
    expect(result).toBe('');
  });

  it('should return same string when no HTML present', () => {
    const result = sanitizeInput('Hello World');
    expect(result).toBe('Hello World');
  });

  it('should handle self-closing tags', () => {
    const result = sanitizeInput('Line 1<br/>Line 2');
    expect(result).toBe('Line 1Line 2');
  });
});

describe('calculateVat', () => {
  it('should calculate VAT at default 15% rate', () => {
    const result = calculateVat(100);
    expect(result.subtotal).toBe(100);
    expect(result.vatAmount).toBe(15);
    expect(result.total).toBe(115);
  });

  it('should round to 2 decimal places', () => {
    const result = calculateVat(99.99);
    expect(result.subtotal).toBe(99.99);
    expect(result.vatAmount).toBe(15.0);
    expect(result.total).toBe(114.99);
  });

  it('should handle zero amount', () => {
    const result = calculateVat(0);
    expect(result.subtotal).toBe(0);
    expect(result.vatAmount).toBe(0);
    expect(result.total).toBe(0);
  });

  it('should accept custom VAT rate', () => {
    const result = calculateVat(200, 0.07);
    expect(result.subtotal).toBe(200);
    expect(result.vatAmount).toBe(14);
    expect(result.total).toBe(214);
  });

  it('should handle large amounts', () => {
    const result = calculateVat(1000000);
    expect(result.subtotal).toBe(1000000);
    expect(result.vatAmount).toBe(150000);
    expect(result.total).toBe(1150000);
  });
});

describe('generatePatientCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate P-00001 when no patients exist', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue(null);

    const code = await generatePatientCode('tenant-1');
    expect(code).toBe('P-00001');
  });

  it('should increment from last patient code', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ patientCode: 'P-00005' } as any);

    const code = await generatePatientCode('tenant-1');
    expect(code).toBe('P-00006');
  });

  it('should handle non-standard code format gracefully', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ patientCode: 'XYZ-001' } as any);

    const code = await generatePatientCode('tenant-1');
    expect(code).toBe('P-00001');
  });

  it('should pad sequence to 5 digits', async () => {
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ patientCode: 'P-99999' } as any);

    const code = await generatePatientCode('tenant-1');
    expect(code).toBe('P-100000');
  });
});
