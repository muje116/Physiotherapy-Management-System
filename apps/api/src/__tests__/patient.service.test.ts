import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@physiocore/db', () => ({
  prisma: {
    patient: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    appointment: {
      findMany: vi.fn(),
    },
    soapNote: {
      findMany: vi.fn(),
    },
    invoice: {
      findMany: vi.fn(),
    },
    exercisePlan: {
      findMany: vi.fn(),
    },
    outcomeMeasure: {
      findMany: vi.fn(),
    },
    treatmentPlan: {
      findMany: vi.fn(),
    },
    payment: {
      findMany: vi.fn(),
    },
    paymentRequest: {
      findMany: vi.fn(),
    },
    clientTask: {
      findMany: vi.fn(),
    },
    schemeClaim: {
      findMany: vi.fn(),
    },
    followUp: {
      findMany: vi.fn(),
    },
    reminderLog: {
      findMany: vi.fn(),
    },
    patientFeedback: {
      findMany: vi.fn(),
    },
    drugStockMovement: {
      findMany: vi.fn(),
    },
  },
  Role: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    THERAPIST: 'THERAPIST',
    FRONT_DESK: 'FRONT_DESK',
    BILLING: 'BILLING',
    PATIENT: 'PATIENT',
  },
}));

vi.mock('../utils/helpers', () => ({
  generatePatientCode: vi.fn(() => Promise.resolve('P-00001')),
  sanitizeInput: vi.fn((s: string) => s),
  calculateVat: vi.fn((a: number) => ({ subtotal: a, vatAmount: a * 0.15, total: a * 1.15 })),
}));

import { prisma, Role } from '@physiocore/db';
import * as patientService from '../services/patient.service';

describe('patient.service', () => {
  const tenantId = 'tenant-1';
  const mockPatient = {
    id: 'patient-1',
    tenantId,
    patientCode: 'P-00001',
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: new Date('1990-01-01'),
    gender: 'Male',
    phone: '0712345678',
    email: 'john@example.com',
    address: '123 Main St',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.treatmentPlan.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.outcomeMeasure.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.paymentRequest.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.clientTask.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.schemeClaim.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.followUp.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.reminderLog.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.patientFeedback.findMany).mockResolvedValue([] as any);
    vi.mocked(prisma.drugStockMovement.findMany).mockResolvedValue([] as any);
  });

  describe('list', () => {
    it('should return paginated patients', async () => {
      const mockItems = [{ ...mockPatient, therapists: [], _count: { appointments: 0, invoices: 0 } }];
      vi.mocked(prisma.patient.findMany).mockResolvedValue(mockItems as any);
      vi.mocked(prisma.patient.count).mockResolvedValue(1);

      const result = await patientService.list(tenantId, { page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should filter by search query', async () => {
      vi.mocked(prisma.patient.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.patient.count).mockResolvedValue(0);

      await patientService.list(tenantId, { page: 1, limit: 10, search: 'John' });

      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ firstName: { contains: 'John', mode: 'insensitive' } }),
            ]),
          }),
        }),
      );
    });

    it('should filter by therapist role', async () => {
      vi.mocked(prisma.patient.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.patient.count).mockResolvedValue(0);

      await patientService.list(tenantId, { page: 1, limit: 10 }, 'user-1', Role.THERAPIST);

      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            therapists: { some: { therapist: { userId: 'user-1', tenantId } } },
          }),
        }),
      );
    });

    it('should filter by isActive', async () => {
      vi.mocked(prisma.patient.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.patient.count).mockResolvedValue(0);

      await patientService.list(tenantId, { page: 1, limit: 10, isActive: false });

      expect(prisma.patient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: false }),
        }),
      );
    });
  });

  describe('create', () => {
    it('should create a patient with generated code', async () => {
      vi.mocked(prisma.patient.create).mockResolvedValue(mockPatient as any);
      const { generatePatientCode } = await import('../utils/helpers');

      const result = await patientService.create(tenantId, {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        gender: 'Male',
        phone: '0712345678',
        email: 'john@example.com',
        occupation: 'Teacher',
        employer: 'Example School',
        clinic: 'Main Clinic',
        paymentMethod: 'INSURANCE',
        paymentResponsibilityAcknowledged: true,
        nextOfKinName: 'Jane Doe',
        nextOfKinPhone: '0711111111',
        howHeardAboutClinic: 'Doctor referral',
      });

      expect(generatePatientCode).toHaveBeenCalledWith(tenantId);
      expect(result.patientCode).toBe('P-00001');
      expect(prisma.patient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            patientCode: 'P-00001',
            tenantId,
            occupation: 'Teacher',
            employer: 'Example School',
            clinic: 'Main Clinic',
            paymentMethod: 'INSURANCE',
            paymentResponsibilityAcknowledged: true,
            nextOfKinName: 'Jane Doe',
            nextOfKinPhone: '0711111111',
            howHeardAboutClinic: 'Doctor referral',
          }),
        }),
      );
    });
  });

  describe('getById', () => {
    it('should return patient for valid id within tenant', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue({
        ...mockPatient,
        therapists: [],
        _count: { appointments: 0, invoices: 0, soapNotes: 0, exercisePlans: 0, outcomeMeasures: 0 },
      } as any);

      const result = await patientService.getById(tenantId, 'patient-1');
      expect(result.id).toBe('patient-1');
    });

    it('should throw NotFoundError for patient not in tenant', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue(null);

      await expect(patientService.getById(tenantId, 'patient-999')).rejects.toThrow('Patient not found');
    });

    it('should enforce tenant scoping', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue(null);

      await expect(patientService.getById('other-tenant', 'patient-1')).rejects.toThrow('Patient not found');
      expect(prisma.patient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'patient-1', tenantId: 'other-tenant' }),
        }),
      );
    });

    it('should prevent therapist from accessing unassigned patient', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue(null);

      await expect(
        patientService.getById(tenantId, 'patient-1', 'therapist-1', Role.THERAPIST),
      ).rejects.toThrow('Patient not found');

      expect(prisma.patient.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            therapists: { some: { therapist: { userId: 'therapist-1', tenantId } } },
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('should update an existing patient', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue(mockPatient as any);
      vi.mocked(prisma.patient.update).mockResolvedValue({ ...mockPatient, firstName: 'Jane' } as any);

      const result = await patientService.update(tenantId, 'patient-1', { firstName: 'Jane' });

      expect(result.firstName).toBe('Jane');
      expect(prisma.patient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'patient-1' },
          data: expect.objectContaining({ firstName: 'Jane' }),
        }),
      );
    });

    it('should throw NotFoundError if patient not found', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue(null);

      await expect(patientService.update(tenantId, 'patient-999', { firstName: 'Jane' })).rejects.toThrow(
        'Patient not found',
      );
    });
  });

  describe('softDelete', () => {
    it('should set isActive to false', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue(mockPatient as any);
      vi.mocked(prisma.patient.update).mockResolvedValue({ ...mockPatient, isActive: false } as any);

      const result = await patientService.softDelete(tenantId, 'patient-1');

      expect(result.isActive).toBe(false);
      expect(prisma.patient.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'patient-1' },
          data: { isActive: false },
        }),
      );
    });

    it('should throw NotFoundError for non-existent patient', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue(null);

      await expect(patientService.softDelete(tenantId, 'patient-999')).rejects.toThrow('Patient not found');
    });
  });

  describe('getAppointments', () => {
    it('should return patient appointments', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue(mockPatient as any);
      vi.mocked(prisma.appointment.findMany).mockResolvedValue([{ id: 'apt-1' }] as any);

      const result = await patientService.getAppointments(tenantId, 'patient-1');

      expect(result).toHaveLength(1);
      expect(prisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { patientId: 'patient-1', tenantId } }),
      );
    });
  });

  describe('getSoapNotes', () => {
    it('should return patient soap notes', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue(mockPatient as any);
      vi.mocked(prisma.soapNote.findMany).mockResolvedValue([{ id: 'note-1' }] as any);

      const result = await patientService.getSoapNotes(tenantId, 'patient-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('getInvoices', () => {
    it('should return patient invoices', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue(mockPatient as any);
      vi.mocked(prisma.invoice.findMany).mockResolvedValue([{ id: 'inv-1' }] as any);

      const result = await patientService.getInvoices(tenantId, 'patient-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('getExercisePlans', () => {
    it('should return patient exercise plans with items', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue(mockPatient as any);
      vi.mocked(prisma.exercisePlan.findMany).mockResolvedValue([{ id: 'ep-1', items: [] }] as any);

      const result = await patientService.getExercisePlans(tenantId, 'patient-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('getOutcomeMeasures', () => {
    it('should return patient outcome measures', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue(mockPatient as any);
      vi.mocked(prisma.outcomeMeasure.findMany).mockResolvedValue([{ id: 'om-1' }] as any);

      const result = await patientService.getOutcomeMeasures(tenantId, 'patient-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('getTimeline', () => {
    it('should return merged timeline sorted by date desc', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue(mockPatient as any);
      vi.mocked(prisma.appointment.findMany).mockResolvedValue([
        { id: 'apt-1', startAt: new Date('2024-06-01') },
      ] as any);
      vi.mocked(prisma.soapNote.findMany).mockResolvedValue([
        { id: 'note-1', createdAt: new Date('2024-06-02') },
      ] as any);
      vi.mocked(prisma.invoice.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.exercisePlan.findMany).mockResolvedValue([] as any);
      vi.mocked(prisma.treatmentPlan.findMany).mockResolvedValue([
        { id: 'plan-1', createdAt: new Date('2024-06-03') },
      ] as any);
      vi.mocked(prisma.outcomeMeasure.findMany).mockResolvedValue([
        { id: 'measure-1', recordedAt: new Date('2024-06-04') },
      ] as any);
      vi.mocked(prisma.payment.findMany).mockResolvedValue([
        { id: 'payment-1', paidAt: new Date('2024-06-05'), createdAt: new Date('2024-06-05') },
      ] as any);
      vi.mocked(prisma.clientTask.findMany).mockResolvedValue([
        { id: 'task-1', createdAt: new Date('2024-06-06') },
      ] as any);

      const result = await patientService.getTimeline(tenantId, 'patient-1');

      expect(result).toHaveLength(6);
      expect(result.map((item) => item.type)).toEqual([
        'client_task',
        'payment',
        'outcome_measure',
        'treatment_plan',
        'soap_note',
        'appointment',
      ]);
    });
  });

  describe('getHistory', () => {
    it('includes medication issues in the patient summary and timeline', async () => {
      vi.mocked(prisma.patient.findFirst).mockResolvedValue(mockPatient as any);
      vi.mocked(prisma.drugStockMovement.findMany).mockResolvedValue([
        {
          id: 'issue-1',
          type: 'ISSUE',
          quantity: 2,
          createdAt: new Date('2024-06-07'),
          drugInventory: { name: 'Ibuprofen', unit: 'tablet' },
          recordedBy: { firstName: 'Front', lastName: 'Desk' },
        },
      ] as any);

      const result = await patientService.getHistory(tenantId, 'patient-1');

      expect(result.summary.medicationIssues).toBe(1);
      expect(result.timeline[0]).toEqual(expect.objectContaining({
        type: 'drug_issue',
        title: 'Medication issued',
        summary: 'Ibuprofen x2 tablet',
        actor: 'Front Desk',
      }));
    });
  });
});
