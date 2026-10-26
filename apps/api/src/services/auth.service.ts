import { prisma, Role } from '@physiocore/db';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { UnauthorizedError, ConflictError, NotFoundError } from '../utils/errors';
import { PERMISSIONS } from '../utils/permissions';
import { sendEmail } from './integrations/email.service';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function getJwtAccessSecret() {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET is not configured');
  return secret;
}

function generateAccessToken(payload: { sub: string; tenantId: string; role: Role }): string {
  return jwt.sign(payload, getJwtAccessSecret(), { expiresIn: '15m' });
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

  const resetToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${encodeURIComponent(resetToken)}`;
  await sendEmail({
    to: user.email,
    subject: 'Reset your PhysioCore password',
    body: `<p>Hello ${user.firstName || 'there'},</p><p>Use the link below to reset your password. It expires in one hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, you can ignore this email.</p>`,
    textBody: `Reset your PhysioCore password: ${resetUrl}`,
  });
}

export async function resetPassword(token: string, password: string) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const entry = await prisma.passwordResetToken.findFirst({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    include: { user: true },
  });
  if (!entry || !entry.user.isActive) throw new NotFoundError('Invalid or expired reset token');

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({
      where: { id: entry.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) throw new NotFoundError('Invalid or expired reset token');

    await tx.user.update({
      where: { id: entry.user.id },
      data: { passwordHash },
    });
    await tx.refreshToken.deleteMany({ where: { userId: entry.user.id } });
  });
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
