import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@physiocore/db', () => ({
  prisma: {
    clientTask: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    therapist: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    patient: {
      findFirst: vi.fn(),
    },
    treatmentPlan: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('../services/notification.service', () => ({
  sendClientTaskNotification: vi.fn(),
}));

import { prisma } from '@physiocore/db';
import * as clientTaskService from '../services/client-task.service';
import { sendClientTaskNotification } from '../services/notification.service';

describe('client-task.service', () => {
  const tenantId = 'tenant-1';
  const userId = 'user-1';
  const mockTask = {
    id: 'task-1',
    tenantId,
    patientId: 'patient-1',
    therapistId: 'therapist-1',
    treatmentPlanId: null,
    title: 'Stretch exercises',
    description: 'Hamstring stretch 3x daily',
    taskType: 'EXERCISE',
    status: 'PENDING',
    dueDate: new Date('2024-07-01'),
    completedAt: null,
    emailSentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    patient: { id: 'patient-1', firstName: 'Jane', lastName: 'Doe' },
    therapist: { id: 'therapist-1', user: { firstName: 'Dr. Adams' } },
    treatmentPlan: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'patient-1' } as any);
    vi.mocked(prisma.therapist.findFirst).mockResolvedValue({ id: 'therapist-1' } as any);
    vi.mocked(prisma.clientTask.findFirst).mockResolvedValue({ id: 'task-1' } as any);
  });

  describe('listTasks', () => {
    it('should return paginated tasks with patient filter', async () => {
      vi.mocked(prisma.clientTask.findMany).mockResolvedValue([mockTask] as any);
      vi.mocked(prisma.clientTask.count).mockResolvedValue(1);

      const result = await clientTaskService.listTasks(tenantId, { page: 1, limit: 10, patientId: 'patient-1' });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prisma.clientTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ patientId: 'patient-1' }) }),
      );
    });

    it('should filter by status and taskType', async () => {
      vi.mocked(prisma.clientTask.findMany).mockResolvedValue([]);
      vi.mocked(prisma.clientTask.count).mockResolvedValue(0);

      await clientTaskService.listTasks(tenantId, { status: 'PENDING', taskType: 'EXERCISE' });

      expect(prisma.clientTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING', taskType: 'EXERCISE' }),
        }),
      );
    });

    it('should include patient, therapist and treatmentPlan relations', async () => {
      vi.mocked(prisma.clientTask.findMany).mockResolvedValue([]);
      vi.mocked(prisma.clientTask.count).mockResolvedValue(0);

      await clientTaskService.listTasks(tenantId, { page: 1, limit: 20 });

      expect(prisma.clientTask.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            patient: true,
            therapist: { include: { user: true } },
            treatmentPlan: true,
          }),
        }),
      );
    });
  });

  describe('createTask', () => {
    it('should create a task and auto-send email notification', async () => {
      vi.mocked(prisma.clientTask.create).mockResolvedValue(mockTask as any);
      vi.mocked(sendClientTaskNotification).mockResolvedValue(undefined);

      const result = await clientTaskService.createTask(tenantId, userId, {
        patientId: 'patient-1',
        title: 'Stretch exercises',
        description: 'Hamstring stretch 3x daily',
        taskType: 'EXERCISE',
      });

      expect(result.id).toBe('task-1');
      expect(result.status).toBe('PENDING');
      expect(sendClientTaskNotification).toHaveBeenCalledWith('task-1', tenantId);
      expect(prisma.clientTask.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId, title: 'Stretch exercises' }),
        }),
      );
    });

    it('should skip email notification when autoSendEmail is false', async () => {
      vi.mocked(prisma.clientTask.create).mockResolvedValue(mockTask as any);

      const result = await clientTaskService.createTask(tenantId, userId, {
        patientId: 'patient-1',
        title: 'Stretch exercises',
        autoSendEmail: false,
      });

      expect(result.id).toBe('task-1');
      expect(sendClientTaskNotification).not.toHaveBeenCalled();
    });

    it('should look up therapist by userId when therapistId not provided', async () => {
      vi.mocked(prisma.clientTask.create).mockResolvedValue(mockTask as any);

      await clientTaskService.createTask(tenantId, userId, {
        patientId: 'patient-1',
        title: 'Test task',
        autoSendEmail: false,
      });

      expect(prisma.therapist.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId, tenantId } }),
      );
      expect(prisma.clientTask.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ therapistId: 'therapist-1' }),
        }),
      );
    });

    it('should use provided therapistId when therapist lookup returns undefined', async () => {
      vi.mocked(prisma.therapist.findFirst)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'external-therapist' } as any);
      vi.mocked(prisma.patient.findFirst).mockResolvedValue({ id: 'patient-1' } as any);
      vi.mocked(prisma.clientTask.create).mockResolvedValue({
        ...mockTask,
        therapistId: 'external-therapist',
      } as any);

      const result = await clientTaskService.createTask(tenantId, userId, {
        patientId: 'patient-1',
        title: 'Test task',
        therapistId: 'external-therapist',
        autoSendEmail: false,
      });

      expect((result as any).therapistId).toBe('external-therapist');
    });
  });

  describe('updateTask', () => {
    it('should update an existing task', async () => {
      vi.mocked(prisma.clientTask.findFirst).mockResolvedValue({ id: 'task-1' } as any);
      vi.mocked(prisma.clientTask.update).mockResolvedValue({ ...mockTask, title: 'Updated task' } as any);

      const result = await clientTaskService.updateTask(tenantId, 'task-1', { title: 'Updated task' });

      expect((result as any).title).toBe('Updated task');
      expect(prisma.clientTask.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'task-1' } }),
      );
    });
  });

  describe('completeTask', () => {
    it('should set status to COMPLETED and set completedAt', async () => {
      const now = new Date();
      vi.mocked(prisma.clientTask.update).mockResolvedValue({
        ...mockTask,
        status: 'COMPLETED',
        completedAt: now,
      } as any);

      const result = await clientTaskService.completeTask(tenantId, 'task-1');

      expect((result as any).status).toBe('COMPLETED');
      expect((result as any).completedAt).toBeDefined();
      expect(prisma.clientTask.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: expect.objectContaining({ status: 'COMPLETED', completedAt: expect.any(Date) }),
        }),
      );
    });
  });

  describe('sendTaskEmail', () => {
    it('should call sendClientTaskNotification with the task id', async () => {
      vi.mocked(sendClientTaskNotification).mockResolvedValue(undefined);

      await clientTaskService.sendTaskEmail(tenantId, 'task-1');

      expect(sendClientTaskNotification).toHaveBeenCalledWith('task-1', tenantId);
    });
  });

  describe('getTaskStats', () => {
    it('should return correct counts and completion rate', async () => {
      vi.mocked(prisma.clientTask.count).mockResolvedValueOnce(100);
      vi.mocked(prisma.clientTask.count).mockResolvedValueOnce(30);
      vi.mocked(prisma.clientTask.count).mockResolvedValueOnce(20);
      vi.mocked(prisma.clientTask.count).mockResolvedValueOnce(40);
      vi.mocked(prisma.clientTask.count).mockResolvedValueOnce(10);

      const result = await clientTaskService.getTaskStats(tenantId);

      expect(result.total).toBe(100);
      expect(result.pending).toBe(30);
      expect(result.sent).toBe(20);
      expect(result.completed).toBe(40);
      expect(result.overdue).toBe(10);
      expect(result.completionRate).toBe(40);
    });

    it('should return 0 completion rate when no tasks exist', async () => {
      vi.mocked(prisma.clientTask.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.clientTask.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.clientTask.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.clientTask.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.clientTask.count).mockResolvedValueOnce(0);

      const result = await clientTaskService.getTaskStats(tenantId);

      expect(result.total).toBe(0);
      expect(result.completionRate).toBe(0);
    });
  });
});
