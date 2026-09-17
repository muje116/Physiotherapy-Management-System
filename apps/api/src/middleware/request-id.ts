import { FastifyInstance } from 'fastify';
import crypto from 'crypto';

export function setupRequestId(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request, reply) => {
    const requestId = request.headers['x-request-id'] || crypto.randomUUID();
    reply.header('x-request-id', requestId);
  });
}

export default async function requestIdPlugin(fastify: FastifyInstance) {
  setupRequestId(fastify);
}
