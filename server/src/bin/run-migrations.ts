/* eslint-disable no-console */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is not set in environment.');
    process.exit(1);
  }

  console.log(`Connecting to database: ${dbUrl.replace(/:[^:@]+@/, ':***@')}`);
  const client = new pg.Client({ connectionString: dbUrl });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL database successfully.');

    // Path to migrations SQL files in the workspace
    const projectRoot = path.resolve(__dirname, '../..');
    const baselinePath = path.join(projectRoot, 'migrations/0001_alpha_baseline.sql');
    const seedPath = path.join(projectRoot, 'migrations/seed-medications-alpha.sql');

    console.log(`Reading baseline migration file from: ${baselinePath}`);
    const baselineSql = fs.readFileSync(baselinePath, 'utf8');
    console.log('Applying baseline migration...');
    await client.query(baselineSql);
    console.log('Baseline migration applied successfully.');

    console.log(`Reading seed migration file from: ${seedPath}`);
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    console.log('Applying seed migration...');
    await client.query(seedSql);
    console.log('Seed migration applied successfully.');

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Migration failed:', msg);
    process.exit(1);
  } finally {
    await client.end();
  }
}

void main();
