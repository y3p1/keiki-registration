import type { Pool, PoolClient } from 'pg';

// Anything we can run a query on — the shared Pool, or a checked-out client
// bound to a single transaction. Model helpers accept this so the caller
// decides the transaction boundary.
export type Queryable = Pool | PoolClient;

// Run `fn` inside a single transaction, committing on success and rolling back
// on any throw. The callback gets a dedicated client — all its work lands in
// the same transaction.
export async function withTransaction<T>(
  pool: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
