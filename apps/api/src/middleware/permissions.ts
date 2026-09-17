import { FastifyRequest, FastifyReply } from 'fastify';
import { PERMISSIONS, Permission } from '../utils/permissions';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';
import { Role } from '@physiocore/db';

export const requirePermission = (permission: Permission) => {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    if (!request.user?.role) {
      throw new UnauthorizedError('Authentication required');
    }

    const role = request.user.role;
    const allowedRoles = PERMISSIONS[permission] as readonly Role[];
    if (!allowedRoles.includes(role)) {
      throw new ForbiddenError('Insufficient permissions');
    }
  };
};
