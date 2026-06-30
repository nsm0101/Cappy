import { buildServer } from './server.js';
import { logger } from './lib/logger.js';
import { loadConfig } from './lib/config.js';

const main = async (): Promise<void> => {
  const config = loadConfig();
  const server = await buildServer({ config, logger });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutdown signal received');
    try {
      await server.close();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await server.listen({ port: config.port, host: '0.0.0.0' });
    logger.info({ port: config.port }, 'cappy backend listening');
  } catch (err) {
    logger.error({ err }, 'failed to start server');
    process.exit(1);
  }
};

void main();
