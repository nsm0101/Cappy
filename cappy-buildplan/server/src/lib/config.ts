import { z } from 'zod';

const configSchema = z.object({
  nodeEnv: z.enum(['development', 'staging', 'production', 'test']),
  port: z.coerce.number().int().positive(),
  databaseUrl: z.string().url(),
  supabaseUrl: z.string().url(),
  supabaseServiceRoleKey: z.string().min(1),
  supabaseJwtSecret: z.string().min(1),
  kmsKeyId: z.string().min(1),
  kmsRegion: z.string().min(1),
  corsAllowedOrigins: z.array(z.string()).default(['http://localhost:3000']),
  logLevel: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
});

export type Config = z.infer<typeof configSchema>;

export const loadConfig = (): Config => {
  const result = configSchema.safeParse({
    nodeEnv: process.env['NODE_ENV'],
    port: process.env['PORT'] ?? '3000',
    databaseUrl: process.env['DATABASE_URL'],
    supabaseUrl: process.env['SUPABASE_URL'],
    supabaseServiceRoleKey: process.env['SUPABASE_SERVICE_ROLE_KEY'],
    supabaseJwtSecret: process.env['SUPABASE_JWT_SECRET'],
    kmsKeyId: process.env['KMS_KEY_ID'],
    kmsRegion: process.env['KMS_REGION'] ?? 'us-east-1',
    corsAllowedOrigins: process.env['CORS_ALLOWED_ORIGINS']?.split(','),
    logLevel: process.env['LOG_LEVEL'],
  });
  if (!result.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid config:', result.error.format());
    process.exit(1);
  }
  return result.data;
};
