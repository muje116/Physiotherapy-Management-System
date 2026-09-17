import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@physiocore/db', () => ({
  prisma: {
    notificationTemplate: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    notificationChannel: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn() },
    reminderLog: { create: vi.fn() },
    followUp: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
    appointment: { findUnique: vi.fn(), update: vi.fn() },
    patient: { findMany: vi.fn() },
    clientTask: { findUnique: vi.fn(), update: vi.fn() },
    therapist: { findUnique: vi.fn() },
  },
}));

vi.mock('../services/integrations/email.service', () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/integrations/sms.service', () => ({
  sendSms: vi.fn().mockResolvedValue(true),
  sendWhatsApp: vi.fn().mockResolvedValue(true),
}));

import { prisma } from '@physiocore/db';
import * as notificationService from '../services/notification.service';

describe('notification.service', () => {
  const tenantId = 'tenant-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('renderTemplate', () => {
    it('should replace {{variables}} with values', () => {
      const result = notificationService.renderTemplate(
        'Hello {{patientName}}, your appointment is on {{date}} at {{time}}.',
        { patientName: 'John', date: '2024-06-15', time: '10:00' },
      );
      expect(result).toBe('Hello John, your appointment is on 2024-06-15 at 10:00.');
    });

    it('should replace multiple occurrences of the same variable', () => {
      const result = notificationService.renderTemplate(
        '{{name}} is here. Welcome {{name}}!',
        { name: 'Alice' },
      );
      expect(result).toBe('Alice is here. Welcome Alice!');
    });

    it('should leave unmatched variables unchanged', () => {
      const result = notificationService.renderTemplate(
        'Hello {{name}}, your code is {{code}}.',
        { name: 'Bob' },
      );
      expect(result).toBe('Hello Bob, your code is {{code}}.');
    });
  });

  describe('sendNotification', () => {
    const payload = {
      to: 'john@example.com',
      subject: 'Reminder',
      body: 'Your appointment is tomorrow.',
      channel: 'EMAIL' as const,
      tenantId,
      patientId: 'patient-1',
    };

    it('should return true and create ReminderLog with SENT status on success', async () => {
      vi.mocked(prisma.notificationChannel.findFirst).mockResolvedValue({ id: 'ch-1', isActive: true } as any);
      vi.mocked(prisma.reminderLog.create).mockResolvedValue({ id: 'log-1' } as any);

      const result = await notificationService.sendNotification(payload);

      expect(result).toBe(true);
      expect(prisma.notificationChannel.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId, type: 'RESEND_EMAIL', isActive: true } }),
      );
      expect(prisma.reminderLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SENT' }),
        }),
      );
    });

    it('should return false when no active channel is found', async () => {
      vi.mocked(prisma.notificationChannel.findFirst).mockResolvedValue(null);

      const result = await notificationService.sendNotification(payload);

      expect(result).toBe(false);
      expect(prisma.reminderLog.create).not.toHaveBeenCalled();
    });

    it('should return false and create FAILED log on error', async () => {
      vi.mocked(prisma.notificationChannel.findFirst).mockResolvedValue({ id: 'ch-1', isActive: true } as any);
      vi.mocked(prisma.reminderLog.create).mockRejectedValueOnce(new Error('DB error'));
      vi.mocked(prisma.reminderLog.create).mockResolvedValueOnce({ id: 'log-fail' } as any);

      const result = await notificationService.sendNotification(payload);

      expect(result).toBe(false);
      expect(prisma.reminderLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
      );
    });

    it('should map SMS to TWILIO_SMS channel type', async () => {
      vi.mocked(prisma.notificationChannel.findFirst).mockResolvedValue({ id: 'ch-1' } as any);
      vi.mocked(prisma.reminderLog.create).mockResolvedValue({} as any);

      await notificationService.sendNotification({ ...payload, channel: 'SMS' });

      expect(prisma.notificationChannel.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ type: 'TWILIO_SMS' }) }),
      );
    });
  });

  describe('sendAppointmentReminder', () => {
    const mockAppointment = {
      id: 'apt-1',
      tenantId,
      patientId: 'patient-1',
      therapistId: 'therapist-1',
      startAt: new Date('2024-06-15T10:00:00'),
      patient: { id: 'patient-1', firstName: 'John', email: 'john@example.com', phone: '0712345678' },
      therapist: { id: 'therapist-1', user: { firstName: 'Dr. Smith' } },
    };

    it('should find template and send notifications for each channel', async () => {
      vi.mocked(prisma.appointment.findUnique).mockResolvedValue(mockAppointment as any);
      vi.mocked(prisma.notificationTemplate.findFirst).mockResolvedValue({
        id: 'tmpl-1',
        tenantId,
        trigger: 'APPOINTMENT_REMINDER',
        subject: 'Reminder: {{date}}',
        body: 'Hi {{patientName}}, see you on {{date}} at {{time}}.',
        channel: ['EMAIL', 'SMS'],
        isActive: true,
      } as any);
      vi.mocked(prisma.notificationChannel.findFirst).mockResolvedValue({ id: 'ch-1', isActive: true } as any);
      vi.mocked(prisma.reminderLog.create).mockResolvedValue({ id: 'log-1' } as any);

      await notificationService.sendAppointmentReminder('apt-1', 'APPOINTMENT_REMINDER');

      expect(prisma.reminderLog.create).toHaveBeenCalledTimes(2);
    });

    it('should return early if appointment not found', async () => {
      vi.mocked(prisma.appointment.findUnique).mockResolvedValue(null);

      await notificationService.sendAppointmentReminder('apt-999', 'APPOINTMENT_REMINDER');

      expect(prisma.notificationTemplate.findFirst).not.toHaveBeenCalled();
    });

    it('should return early if no active template found', async () => {
      vi.mocked(prisma.appointment.findUnique).mockResolvedValue(mockAppointment as any);
      vi.mocked(prisma.notificationTemplate.findFirst).mockResolvedValue(null);

      await notificationService.sendAppointmentReminder('apt-1', 'APPOINTMENT_REMINDER');

      expect(prisma.reminderLog.create).not.toHaveBeenCalled();
    });
  });

  describe('createNoShowFollowUp', () => {
    const mockAppointment = {
      id: 'apt-1',
      tenantId,
      patientId: 'patient-1',
      therapistId: 'therapist-1',
      startAt: new Date('2024-06-15T10:00:00'),
      patient: { id: 'patient-1', firstName: 'John', email: 'john@example.com', phone: '0712345678' },
    };

    it('should create follow-up record and send SMS and EMAIL', async () => {
      vi.mocked(prisma.appointment.findUnique).mockResolvedValue(mockAppointment as any);
      vi.mocked(prisma.followUp.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.followUp.create).mockResolvedValue({ id: 'fu-1' } as any);
      vi.mocked(prisma.notificationTemplate.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.notificationChannel.findFirst).mockResolvedValue({ id: 'ch-1', isActive: true } as any);
      vi.mocked(prisma.reminderLog.create).mockResolvedValue({ id: 'log-1' } as any);

      await notificationService.createNoShowFollowUp('apt-1');

      expect(prisma.followUp.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'NO_SHOW', status: 'PENDING' }),
        }),
      );
      expect(prisma.reminderLog.create).toHaveBeenCalledTimes(2);
    });

    it('should not create duplicate follow-up if one already exists', async () => {
      vi.mocked(prisma.appointment.findUnique).mockResolvedValue(mockAppointment as any);
      vi.mocked(prisma.followUp.findFirst).mockResolvedValue({ id: 'fu-existing' } as any);

      await notificationService.createNoShowFollowUp('apt-1');

      expect(prisma.followUp.create).not.toHaveBeenCalled();
      expect(prisma.reminderLog.create).not.toHaveBeenCalled();
    });

    it('should return early if appointment not found', async () => {
      vi.mocked(prisma.appointment.findUnique).mockResolvedValue(null);

      await notificationService.createNoShowFollowUp('apt-999');

      expect(prisma.followUp.create).not.toHaveBeenCalled();
    });

    it('should not send SMS if patient has no phone', async () => {
      const noPhoneAppointment = {
        ...mockAppointment,
        patient: { ...mockAppointment.patient, phone: null },
      };
      vi.mocked(prisma.appointment.findUnique).mockResolvedValue(noPhoneAppointment as any);
      vi.mocked(prisma.followUp.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.followUp.create).mockResolvedValue({ id: 'fu-1' } as any);
      vi.mocked(prisma.notificationTemplate.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.notificationChannel.findFirst).mockResolvedValue({ id: 'ch-1', isActive: true } as any);
      vi.mocked(prisma.reminderLog.create).mockResolvedValue({ id: 'log-1' } as any);

      await notificationService.createNoShowFollowUp('apt-1');

      expect(prisma.reminderLog.create).toHaveBeenCalledTimes(1);
      expect(prisma.reminderLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ channel: 'EMAIL' }) }),
      );
    });
  });

  describe('sendReengagementNotifications', () => {
    it('should query inactive patients and send notifications', async () => {
      vi.mocked(prisma.patient.findMany).mockResolvedValue([
        { id: 'patient-1', tenantId, firstName: 'John', email: 'john@example.com', phone: '0712345678', isActive: true, appointments: [], tenant: { id: tenantId } },
      ] as any);
      vi.mocked(prisma.notificationTemplate.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.notificationChannel.findFirst).mockResolvedValue({ id: 'ch-1', isActive: true } as any);
      vi.mocked(prisma.reminderLog.create).mockResolvedValue({ id: 'log-1' } as any);

      const count = await notificationService.sendReengagementNotifications();

      expect(count).toBe(1);
      expect(prisma.reminderLog.create).toHaveBeenCalledTimes(2);
    });

    it('should return 0 when no inactive patients', async () => {
      vi.mocked(prisma.patient.findMany).mockResolvedValue([]);

      const count = await notificationService.sendReengagementNotifications();

      expect(count).toBe(0);
      expect(prisma.reminderLog.create).not.toHaveBeenCalled();
    });
  });

  describe('sendClientTaskNotification', () => {
    const mockTask = {
      id: 'task-1',
      tenantId,
      patientId: 'patient-1',
      title: 'Do exercises',
      description: 'Repeat 3x',
      dueDate: new Date('2024-07-01'),
      status: 'PENDING',
      emailSentAt: null,
      patient: { id: 'patient-1', firstName: 'Jane', email: 'jane@example.com' },
      therapist: { id: 'therapist-1', user: { firstName: 'Dr. Adams' } },
    };

    it('should send email and update task status to SENT', async () => {
      vi.mocked(prisma.clientTask.findUnique).mockResolvedValue(mockTask as any);
      vi.mocked(prisma.notificationTemplate.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.notificationChannel.findFirst).mockResolvedValue({ id: 'ch-1', isActive: true } as any);
      vi.mocked(prisma.reminderLog.create).mockResolvedValue({ id: 'log-1' } as any);
      vi.mocked(prisma.clientTask.update).mockResolvedValue({ ...mockTask, status: 'SENT' } as any);

      await notificationService.sendClientTaskNotification('task-1');

      expect(prisma.clientTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: expect.objectContaining({ status: 'SENT' }),
        }),
      );
      expect(prisma.reminderLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ channel: 'EMAIL' }) }),
      );
    });

    it('should return early if task not found', async () => {
      vi.mocked(prisma.clientTask.findUnique).mockResolvedValue(null);

      await notificationService.sendClientTaskNotification('task-999');

      expect(prisma.reminderLog.create).not.toHaveBeenCalled();
    });

    it('should return early if patient has no email', async () => {
      vi.mocked(prisma.clientTask.findUnique).mockResolvedValue({
        ...mockTask,
        patient: { ...mockTask.patient, email: null },
      } as any);

      await notificationService.sendClientTaskNotification('task-1');

      expect(prisma.reminderLog.create).not.toHaveBeenCalled();
    });
  });

  describe('CRUD - Templates', () => {
    const mockTemplate = { id: 'tmpl-1', tenantId, name: 'Reminder', trigger: 'APPOINTMENT_REMINDER', body: 'Hello', channel: ['EMAIL'], isActive: true };

    it('listTemplates should return all templates for tenant', async () => {
      vi.mocked(prisma.notificationTemplate.findMany).mockResolvedValue([mockTemplate] as any);

      const result = await notificationService.listTemplates(tenantId);

      expect(result).toHaveLength(1);
      expect(prisma.notificationTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId } }),
      );
    });

    it('createTemplate should create a new template', async () => {
      vi.mocked(prisma.notificationTemplate.create).mockResolvedValue(mockTemplate as any);

      const result = await notificationService.createTemplate(tenantId, { name: 'Reminder', trigger: 'APPOINTMENT_REMINDER', body: 'Hello' });

      expect(result.id).toBe('tmpl-1');
      expect(prisma.notificationTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tenantId }) }),
      );
    });

    it('updateTemplate should update an existing template', async () => {
      vi.mocked(prisma.notificationTemplate.update).mockResolvedValue({ ...mockTemplate, isActive: false } as any);

      const result = await notificationService.updateTemplate(tenantId, 'tmpl-1', { isActive: false });

      expect((result as any).isActive).toBe(false);
      expect(prisma.notificationTemplate.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'tmpl-1', tenantId } }),
      );
    });

    it('deleteTemplate should delete the template', async () => {
      vi.mocked(prisma.notificationTemplate.delete).mockResolvedValue(mockTemplate as any);

      await notificationService.deleteTemplate(tenantId, 'tmpl-1');

      expect(prisma.notificationTemplate.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'tmpl-1', tenantId } }),
      );
    });
  });

  describe('CRUD - Channels', () => {
    const mockChannel = { id: 'ch-1', tenantId, type: 'RESEND_EMAIL', name: 'Resend', isActive: true };

    it('listChannels should return all channels for tenant', async () => {
      vi.mocked(prisma.notificationChannel.findMany).mockResolvedValue([mockChannel] as any);

      const result = await notificationService.listChannels(tenantId);

      expect(result).toHaveLength(1);
    });

    it('upsertChannel should upsert a channel', async () => {
      vi.mocked(prisma.notificationChannel.create).mockResolvedValue(mockChannel as any);

      const result = await notificationService.upsertChannel(tenantId, 'RESEND_EMAIL', { name: 'Resend' });

      expect(result.id).toBe('ch-1');
    });
  });

  describe('listFollowUps', () => {
    it('should filter by status and return paginated results', async () => {
      vi.mocked(prisma.followUp.findMany).mockResolvedValue([{ id: 'fu-1', patient: {}, therapist: { user: {} } }] as any);
      vi.mocked(prisma.followUp.count).mockResolvedValue(1);

      const result = await notificationService.listFollowUps(tenantId, { status: 'PENDING', page: 1, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prisma.followUp.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'PENDING' }) }),
      );
    });

    it('should filter by type and patientId', async () => {
      vi.mocked(prisma.followUp.findMany).mockResolvedValue([]);
      vi.mocked(prisma.followUp.count).mockResolvedValue(0);

      await notificationService.listFollowUps(tenantId, { type: 'NO_SHOW', patientId: 'patient-1' });

      expect(prisma.followUp.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'NO_SHOW', patientId: 'patient-1' }),
        }),
      );
    });
  });

  describe('getFollowUpStats', () => {
    it('should return correct counts and reengagement rate', async () => {
      vi.mocked(prisma.followUp.count).mockResolvedValueOnce(100);
      vi.mocked(prisma.followUp.count).mockResolvedValueOnce(50);
      vi.mocked(prisma.followUp.count).mockResolvedValueOnce(30);
      vi.mocked(prisma.followUp.count).mockResolvedValueOnce(20);

      const result = await notificationService.getFollowUpStats(tenantId);

      expect(result.total).toBe(100);
      expect(result.pending).toBe(50);
      expect(result.rescheduled).toBe(30);
      expect(result.closed).toBe(20);
      expect(result.reengagementRate).toBe(30);
    });

    it('should return 0 reengagement rate when no follow-ups exist', async () => {
      vi.mocked(prisma.followUp.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.followUp.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.followUp.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.followUp.count).mockResolvedValueOnce(0);

      const result = await notificationService.getFollowUpStats(tenantId);

      expect(result.total).toBe(0);
      expect(result.reengagementRate).toBe(0);
    });

    it('should include contacted follow-ups in the stats response', async () => {
      vi.mocked(prisma.followUp.count).mockResolvedValueOnce(4);
      vi.mocked(prisma.followUp.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.followUp.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.followUp.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.followUp.count).mockResolvedValueOnce(1);

      const result = await notificationService.getFollowUpStats(tenantId);

      expect(result.contacted).toBe(1);
    });
  });
});
