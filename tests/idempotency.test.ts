// Idempotency test: the same submission UUID submitted twice must insert exactly
// one row, and the second call must report created:false (so the caller returns
// the existing checkout instead of charging again).
import { pool } from '../db/pool';
import { insertSubmission } from '../lib/registration/submission';

const SUB_ID = '99999999-9999-9999-9999-999999999999';
const EMAIL = 'idem-test@example.com';

async function main() {
  const client = await pool.connect();
  try {
    // Clean slate + a parent to satisfy the FK.
    await client.query('DELETE FROM submission WHERE id = $1', [SUB_ID]);
    await client.query('DELETE FROM parent WHERE email = $1', [EMAIL]);
    const { rows: [parent] } = await client.query<{ id: string }>(
      `INSERT INTO parent (email, full_name) VALUES ($1, 'Idempotency Test')
       RETURNING id`,
      [EMAIL],
    );

    const first = await insertSubmission(client, SUB_ID, parent.id, { children: 2 });
    const second = await insertSubmission(client, SUB_ID, parent.id, { children: 2 });

    const { rows: [{ count }] } = await client.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM submission WHERE id = $1',
      [SUB_ID],
    );

    console.log(`first.created=${first.created} second.created=${second.created} rowCount=${count}`);

    // Cleanup.
    await client.query('DELETE FROM submission WHERE id = $1', [SUB_ID]);
    await client.query('DELETE FROM parent WHERE id = $1', [parent.id]);

    const ok = first.created === true && second.created === false && count === 1;
    if (!ok) {
      console.error('FAIL — duplicate submission was not deduplicated');
      process.exit(1);
    }
    console.log('PASS — duplicate submission is a no-op; one row, no second charge path');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
