import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import { type Logger } from 'pino';
import { type Config } from './lib/config.js';
import { healthRoutes } from './modules/health/routes.js';

export type BuildServerOptions = {
  config: Config;
  logger: Logger;
};

export const buildServer = async (opts: BuildServerOptions) => {
  const app = Fastify({
    logger: opts.logger,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    genReqId: () => crypto.randomUUID(),
    trustProxy: true,
    bodyLimit: 1024 * 1024, // 1MB
  });

  await app.register(helmet, { global: true });
  await app.register(cors, {
    origin: opts.config.corsAllowedOrigins,
    credentials: true,
  });
  await app.register(sensible);
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  await app.register(healthRoutes, { prefix: '/v1' });

  // Module registrations go here as they are built:
  // await app.register(identityRoutes, { prefix: '/v1' });
  // await app.register(familyRoutes, { prefix: '/v1' });
  // await app.register(childrenRoutes, { prefix: '/v1' });
  // await app.register(medicationRoutes, { prefix: '/v1' });
  // await app.register(doseRoutes, { prefix: '/v1' });
  // await app.register(nfcRoutes, { prefix: '/v1' });
  // await app.register(inviteRoutes, { prefix: '/v1' });

  app.setErrorHandler((err, req, reply) => {
    req.log.error({ err }, 'unhandled error');
    const e = err as { statusCode?: number; message?: string };
    if (e.statusCode && e.statusCode < 500) {
      void reply
        .status(e.statusCode)
        .type('application/problem+json')
        .send({
          type: 'about:blank',
          title: e.message,
          status: e.statusCode,
        });
      return;
    }
    void reply.status(500).type('application/problem+json').send({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      // Never include err.message in 500 — could leak PHI
    });
  });

  return app;
};
