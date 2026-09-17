import { prisma, Role } from '@physiocore/db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { UnauthorizedError, ConflictError, NotFoundError } from '../utils/errors';
import { resetTokenStore } from './reset-token.store';
import { PERMISSIONS } from '../utils/permissions';

function generateAccessToken(payload: { sub: string; tenantId: string; role: Role }): string {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET || 'access-secret-dev', { expiresIn: '15m' });
}

async function generateRefreshToken(userId: string): Promise<string> {
  const rawToken = crypto.randomUUID();
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId,
      token: hashedToken,
      expiresAt,
    },
  });

  return rawToken;
}

export async function registerTenant(data: {
  name: string;
  slug: string;
  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;
}) {
  const existingTenant = await prisma.tenant.findUnique({ where: { slug: data.slug } });
  if (existingTenant) throw new ConflictError('Tenant slug already exists');

  const existingUser = await prisma.user.findFirst({
    where: { email: data.adminEmail },
  });
  if (existingUser) throw new ConflictError('Email already registered');

  const passwordHash = await bcrypt.hash(data.adminPassword, 10);

  const tenant = await prisma.tenant.create({
    data: {
      name: data.name,
      slug: data.slug,
      settings: {
        create: {},
      },
      users: {
        create: {
          email: data.adminEmail,
          passwordHash,
          firstName: data.adminFirstName,
          lastName: data.adminLastName,
          role: Role.SUPER_ADMIN,
        },
      },
    },
    include: {
      users: true,
    },
  });

  const user = tenant.users[0];
  const accessToken = generateAccessToken({ sub: user.id, tenantId: tenant.id, role: user.role });
  const refreshToken = await generateRefreshToken(user.id);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: tenant.id,
    },
  };
}

export async function login(email: string, password: string, tenantSlug?: string) {
  let tenantFilter: any = { email };

  if (tenantSlug) {
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) throw new UnauthorizedError('Invalid credentials');
    tenantFilter = { email, tenantId: tenant.id };
  }

  const user = await prisma.user.findFirst({
    where: tenantFilter,
    include: { tenant: true },
  });

  if (!user || !user.isActive) throw new UnauthorizedError('Invalid credentials');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new UnauthorizedError('Invalid credentials');

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const accessToken = generateAccessToken({ sub: user.id, tenantId: user.tenantId, role: user.role });
  const refreshToken = await generateRefreshToken(user.id);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId,
    },
  };
}

export async function refreshToken(rawToken: string) {
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: hashedToken },
    include: { user: true },
  });

  if (!storedToken || storedToken.expiresAt < new Date()) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  if (!storedToken.user.isActive) {
    throw new UnauthorizedError('User account is inactive');
  }

  await prisma.refreshToken.delete({ where: { id: storedToken.id } });

  const accessToken = generateAccessToken({
    sub: storedToken.user.id,
    tenantId: storedToken.user.tenantId,
    role: storedToken.user.role,
  });
  const newRefreshToken = await generateRefreshToken(storedToken.user.id);

  return { accessToken, refreshToken: newRefreshToken };
}

export async function logout(rawToken: string) {
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
  await prisma.refreshToken.deleteMany({ where: { token: hashedToken } });
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) return;

  const resetToken = crypto.randomUUID();
  resetTokenStore.set(resetToken, email);
}

export async function resetPassword(token: string, password: string) {
  const entry = resetTokenStore.get(token);
  if (!entry) throw new NotFoundError('Invalid or expired reset token');

  const user = await prisma.user.findFirst({ where: { email: entry.email } });
  if (!user) throw new NotFoundError('Invalid or expired reset token');

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  resetTokenStore.delete(token);
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { tenant: true },
  });

  if (!user) throw new NotFoundError('User not found');

  const permissions = Object.entries(PERMISSIONS)
    .filter(([_, roles]) => (roles as readonly string[]).includes(user.role))
    .map(([permission]) => permission);

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    tenantId: user.tenantId,
    tenant: user.tenant,
    permissions,
  };
}
