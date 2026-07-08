import type { FastifyPluginAsync } from 'fastify';

const VERSION = '0.1.0-alpha';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/healthz', () => ({
    status: 'ok',
    version: VERSION,
  }));

  app.get('/readyz', (_req, reply) => {
    // In a future ticket: check DB connectivity, KMS reachability, etc.
    // For now, a simple OK matches healthz.
    return reply.send({ status: 'ready', version: VERSION });
  });

  await Promise.resolve();
};
