import { Pool } from 'pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set (see .env.example)');
}

// Supabase (and most hosted Postgres) require TLS. Local Docker does not.
const needsSsl = /supabase\.com|neon\.tech|sslmode=require/.test(connectionString);

export const pool = new Pool({
  connectionString,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});
