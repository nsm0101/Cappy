import pino, { type Logger } from 'pino';

/**
 * PHI field names that must never appear in logs in plain form.
 * The redaction layer removes them; do not depend on this — also
 * proactively avoid passing PHI to log calls.
 */
const PHI_FIELDS = [
  'email',
  'phone',
  'phone_number',
  'phoneNumber',
  'name',
  'displayName',
  'display_name',
  'firstName',
  'first_name',
  'lastName',
  'last_name',
  'dateOfBirth',
  'date_of_birth',
  'dob',
  'note',
  'notes',
  'weight',
  'valueGrams',
  'value_grams',
  'address',
  'ssn',
];

const REDACTION_PATHS: string[] = [];
for (const field of PHI_FIELDS) {
  REDACTION_PATHS.push(field);
  REDACTION_PATHS.push(`*.${field}`);
  REDACTION_PATHS.push(`*.*.${field}`);
  REDACTION_PATHS.push(`req.body.${field}`);
  REDACTION_PATHS.push(`req.query.${field}`);
  REDACTION_PATHS.push(`res.body.${field}`);
}

export const logger: Logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  redact: {
    paths: REDACTION_PATHS,
    censor: '[REDACTED-PHI]',
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport:
    process.env['NODE_ENV'] === 'development'
      ? { target: 'pino-pretty' }
      : undefined,
});

export const createChildLogger = (context: Record<string, unknown>): Logger =>
  logger.child(context);
