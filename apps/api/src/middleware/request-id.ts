import { FastifyInstance } from 'fastify';

export function setupRequestId(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request, reply) => {
    reply.header('x-request-id', String(request.id));
  });
}

export default async function requestIdPlugin(fastify: FastifyInstance) {
  setupRequestId(fastify);
}
