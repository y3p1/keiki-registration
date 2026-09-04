// Runs db/seed.sql (idempotent) and prints a short summary.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './pool';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const sql = readFileSync(join(__dirname, 'seed.sql'), 'utf8');
  await pool.query(sql);

  const { rows } = await pool.query<{ schools: string; classes: string; sessions: string }>(`
    SELECT (SELECT count(*) FROM school)  AS schools,
           (SELECT count(*) FROM class)   AS classes,
           (SELECT count(*) FROM session) AS sessions
  `);
  console.log('seed ok:', rows[0]);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
