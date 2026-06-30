import pg from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { logger } from './logger.js';

const { Pool } = pg;

let cachedPool: pg.Pool | null = null;
let cachedDb: NodePgDatabase | null = null;

export const getDb = (databaseUrl: string): NodePgDatabase => {
  if (cachedDb) return cachedDb;
  cachedPool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl:
      process.env['NODE_ENV'] === 'production'
        ? { rejectUnauthorized: true }
        : undefined,
  });
  cachedPool.on('error', (err) => {
    logger.error({ err }, 'unexpected postgres pool error');
  });
  cachedDb = drizzle(cachedPool);
  return cachedDb;
};

export const closeDb = async (): Promise<void> => {
  if (cachedPool) {
    await cachedPool.end();
    cachedPool = null;
    cachedDb = null;
  }
};
