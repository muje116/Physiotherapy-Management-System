import { prisma, Role } from '@physiocore/db';
import bcrypt from 'bcrypt';
import { NotFoundError, ConflictError } from '../utils/errors';
import { PaginatedResult } from '../types';

interface UserQuery {
  page: number;
  limit: number;
  role?: string;
  search?: string;
}

export async function list(tenantId: string, query: UserQuery): Promise<PaginatedResult<any>> {
  const where: any = { tenantId };

  if (query.role) {
    where.role = query.role as Role;
  }

  if (query.search) {
    where.OR = [
      { firstName: { contains: query.search, mode: 'insensitive' } },
      { lastName: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return { items, total, page: query.page, limit: query.limit };
}

export async function create(tenantId: string, data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
}) {
  const existing = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email: data.email } },
  });
  if (existing) throw new ConflictError('Email already exists in this tenant');

  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = await prisma.user.create({
    data: {
      tenantId,
      email: data.email,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role as Role,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  return user;
}

export async function getById(tenantId: string, userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) throw new NotFoundError('User not found');
  return user;
}

export async function update(tenantId: string, userId: string, data: { firstName?: string; lastName?: string; role?: string; isActive?: boolean }) {
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
  if (!user) throw new NotFoundError('User not found');

  if (user.role === Role.SUPER_ADMIN && data.role && data.role !== Role.SUPER_ADMIN) {
    throw new ConflictError('Cannot change SUPER_ADMIN role');
  }

  const updateData: any = {};
  if (data.firstName !== undefined) updateData.firstName = data.firstName;
  if (data.lastName !== undefined) updateData.lastName = data.lastName;
  if (data.role !== undefined) updateData.role = data.role as Role;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      updatedAt: true,
    },
  });

  return updated;
}

export async function deactivate(tenantId: string, userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
  if (!user) throw new NotFoundError('User not found');
  if (user.role === Role.SUPER_ADMIN) throw new ConflictError('Cannot deactivate SUPER_ADMIN');

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
    select: { id: true, isActive: true },
  });

  return updated;
}

export async function resetPassword(tenantId: string, userId: string, newPassword: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, tenantId } });
  if (!user) throw new NotFoundError('User not found');

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
}
