import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@physiocore/db', () => ({
  prisma: {
    soapNote: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    appointment: {
      findFirst: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
    therapist: {
      findFirst: vi.fn(),
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

import { prisma, Role } from '@physiocore/db';
import * as soapNoteService from '../services/soap-note.service';

describe('soap-note.service', () => {
  const tenantId = 'tenant-1';
  const mockSoapNote = {
    id: 'note-1',
    tenantId,
    appointmentId: 'apt-1',
    patientId: 'patient-1',
    therapistId: 'user-1',
    subjective: 'Pain in lower back',
    objective: 'Reduced ROM',
    assessment: 'Lumbar strain',
    plan: 'Continue exercises',
    icd10Codes: ['M54.5'],
    cptCodes: ['97110'],
    painScore: 6,
    signedAt: null,
    signedByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    const validData = {
      appointmentId: 'apt-1',
      patientId: 'patient-1',
      subjective: 'Pain in lower back',
      objective: 'Reduced ROM',
      assessment: 'Lumbar strain',
      plan: 'Continue exercises',
      icd10Codes: ['M54.5'],
      cptCodes: ['97110'],
      painScore: 6,
      complaint: 'Painful shoulder',
      painLocation: 'Right shoulder',
      symptomsSince: '6 months',
      painPattern: 'Intermittent',
      radiatesTo: 'Upper arm',
      aggravatedBy: 'Lifting',
      easedBy: 'Rest',
      medications: 'None',
      imagingFindings: 'Degenerative changes on X-ray',
      dayNightSymptoms: 'Disturbs sleep',
      presentingHistory: 'Gradual onset after activity',
      pastMedicalHistory: 'Previous lower back surgery',
      palpationFindings: 'Pain over joint',
      rangeOfMotion: 'Full ROM with pain',
      treatmentProvided: 'Reassurance, TENS, ROM exercises, advice and education',
    };

    it('should create a SOAP note when appointment exists', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ id: 'apt-1', therapistId: 'user-1' } as any);
      vi.mocked(prisma.soapNote.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.soapNote.create).mockResolvedValue({
        ...mockSoapNote,
        appointment: { startAt: new Date(), type: 'INITIAL' },
      } as any);

      const result = await soapNoteService.create(tenantId, validData);

      expect(result.id).toBe('note-1');
      expect(prisma.soapNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            appointmentId: 'apt-1',
            patientId: 'patient-1',
            therapistId: 'user-1',
            complaint: 'Painful shoulder',
            painLocation: 'Right shoulder',
            treatmentProvided: 'Reassurance, TENS, ROM exercises, advice and education',
          }),
        }),
      );
    });

    it('should throw NotFoundError when appointment does not exist', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue(null);

      await expect(soapNoteService.create(tenantId, validData)).rejects.toThrow('Appointment not found');
    });

    it('should throw NotFoundError when SOAP note already exists for appointment', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ id: 'apt-1', therapistId: 'user-1' } as any);
      vi.mocked(prisma.soapNote.findUnique).mockResolvedValue({ id: 'existing-note' } as any);

      await expect(soapNoteService.create(tenantId, validData)).rejects.toThrow('SOAP note already exists for this appointment');
    });

    it('should default icd10Codes and cptCodes to empty arrays', async () => {
      vi.mocked(prisma.appointment.findFirst).mockResolvedValue({ id: 'apt-1', therapistId: 'user-1' } as any);
      vi.mocked(prisma.soapNote.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.soapNote.create).mockResolvedValue(mockSoapNote as any);

      await soapNoteService.create(tenantId, { ...validData, icd10Codes: undefined, cptCodes: undefined } as any);

      expect(prisma.soapNote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ icd10Codes: [], cptCodes: [] }),
        }),
      );
    });
  });

  describe('getById', () => {
    it('should return SOAP note by id', async () => {
      vi.mocked(prisma.soapNote.findFirst).mockResolvedValue({
        ...mockSoapNote,
        appointment: { id: 'apt-1', startAt: new Date(), endAt: new Date(), type: 'INITIAL', status: 'SCHEDULED' },
      } as any);

      const result = await soapNoteService.getById(tenantId, 'note-1');
      expect(result.id).toBe('note-1');
    });

    it('should throw NotFoundError for non-existent note', async () => {
      vi.mocked(prisma.soapNote.findFirst).mockResolvedValue(null);

      await expect(soapNoteService.getById(tenantId, 'note-999')).rejects.toThrow('SOAP note not found');
    });
  });

  describe('update', () => {
    it('should update an unsigned SOAP note', async () => {
      vi.mocked(prisma.soapNote.findFirst).mockResolvedValue(mockSoapNote as any);
      vi.mocked(prisma.soapNote.update).mockResolvedValue({ ...mockSoapNote, subjective: 'Updated pain' } as any);

      const result = await soapNoteService.update(tenantId, 'note-1', { subjective: 'Updated pain' });

      expect((result as any).subjective).toBe('Updated pain');
    });

    it('should throw ForbiddenError when updating a signed note', async () => {
      vi.mocked(prisma.soapNote.findFirst).mockResolvedValue({ ...mockSoapNote, signedAt: new Date() } as any);

      await expect(soapNoteService.update(tenantId, 'note-1', { subjective: 'Updated' })).rejects.toThrow(
        'Cannot update a signed SOAP note',
      );
    });

    it('should throw NotFoundError for non-existent note', async () => {
      vi.mocked(prisma.soapNote.findFirst).mockResolvedValue(null);

      await expect(soapNoteService.update(tenantId, 'note-999', { subjective: 'Updated' })).rejects.toThrow('SOAP note not found');
    });
  });

  describe('sign', () => {
    it('should allow therapist to sign their own note', async () => {
      vi.mocked(prisma.soapNote.findFirst).mockResolvedValue({
        ...mockSoapNote,
        therapistId: 'user-1',
        appointment: {},
      } as any);
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'user-1', tenantId, role: Role.THERAPIST } as any);
      vi.mocked(prisma.soapNote.update).mockResolvedValue({ ...mockSoapNote, signedAt: new Date(), signedByUserId: 'user-1' } as any);

      const result = await soapNoteService.sign(tenantId, 'note-1', 'user-1');

      expect(prisma.soapNote.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ signedAt: expect.any(Date), signedByUserId: 'user-1' }),
        }),
      );
    });

    it('should allow admin to sign any note', async () => {
      vi.mocked(prisma.soapNote.findFirst).mockResolvedValue({
        ...mockSoapNote,
        therapistId: 'other-user',
        appointment: {},
      } as any);
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'admin-1', tenantId, role: Role.ADMIN } as any);
      vi.mocked(prisma.soapNote.update).mockResolvedValue({} as any);

      await soapNoteService.sign(tenantId, 'note-1', 'admin-1');

      expect(prisma.soapNote.update).toHaveBeenCalled();
    });

    it('should throw ForbiddenError when non-owner non-admin tries to sign', async () => {
      vi.mocked(prisma.soapNote.findFirst).mockResolvedValue({
        ...mockSoapNote,
        therapistId: 'other-user',
        appointment: {},
      } as any);
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'random-user', tenantId, role: Role.THERAPIST } as any);

      await expect(soapNoteService.sign(tenantId, 'note-1', 'random-user')).rejects.toThrow(
        'Only the note author or an admin can sign this note',
      );
    });

    it('should throw NotFoundError when note already signed', async () => {
      vi.mocked(prisma.soapNote.findFirst).mockResolvedValue({
        ...mockSoapNote,
        signedAt: new Date(),
        appointment: {},
      } as any);

      await expect(soapNoteService.sign(tenantId, 'note-1', 'user-1')).rejects.toThrow('SOAP note is already signed');
    });

    it('should throw NotFoundError when note does not exist', async () => {
      vi.mocked(prisma.soapNote.findFirst).mockResolvedValue(null);

      await expect(soapNoteService.sign(tenantId, 'note-999', 'user-1')).rejects.toThrow('SOAP note not found');
    });
  });

  describe('getSuggestions', () => {
    it('should return mock ICD-10 and CPT codes', async () => {
      const suggestions = await soapNoteService.getSuggestions('any-note-id');

      expect(suggestions).toHaveProperty('icd10Codes');
      expect(suggestions).toHaveProperty('cptCodes');
      expect(suggestions.icd10Codes.length).toBeGreaterThan(0);
      expect(suggestions.cptCodes.length).toBeGreaterThan(0);
      expect(suggestions.icd10Codes[0]).toHaveProperty('code');
      expect(suggestions.icd10Codes[0]).toHaveProperty('description');
    });
  });
});
