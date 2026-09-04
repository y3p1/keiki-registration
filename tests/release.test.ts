// Release test: an expired pending hold is released exactly once — seats_taken
// is decremented on the first sweep and NOT again on a second (double-release-
// proof, the property that protects against a racing webhook + lazy expiry).
import { pool } from '../db/pool';
import { claimSeat } from '../lib/registration/claimSeat';
import { releaseExpiredHolds } from '../lib/registration/releaseSeats';

const CLASS_ID = '33333333-3333-3333-3333-333333333333'; // seeded, capacity 20
const EMAIL = 'release-test@example.com';

async function main() {
  const client = await pool.connect();
  try {
    // Clean slate (enrollment has no cascade from child, so clear it first).
    await client.query(
      `DELETE FROM enrollment WHERE child_id IN
         (SELECT id FROM child WHERE parent_id IN (SELECT id FROM parent WHERE email = $1))`,
      [EMAIL],
    );
    await client.query('DELETE FROM parent WHERE email = $1', [EMAIL]);
    await client.query('UPDATE class SET seats_taken = 0 WHERE id = $1', [CLASS_ID]);

    const { rows: [parent] } = await client.query<{ id: string }>(
      `INSERT INTO parent (email, full_name) VALUES ($1, 'Release Test') RETURNING id`,
      [EMAIL],
    );
    const { rows: [child] } = await client.query<{ id: string }>(
      `INSERT INTO child (parent_id, full_name) VALUES ($1, 'Kid') RETURNING id`,
      [parent.id],
    );

    // Claim a seat and create a pending enrollment whose hold ALREADY expired.
    const seats = await claimSeat(client, CLASS_ID);
    await client.query(
      `INSERT INTO enrollment (child_id, class_id, status, reserved_until)
       VALUES ($1, $2, 'pending', now() - interval '1 minute')`,
      [child.id, CLASS_ID],
    );

    const firstRelease = await releaseExpiredHolds(client, CLASS_ID);
    const { rows: [afterFirst] } = await client.query<{ seats_taken: number }>(
      'SELECT seats_taken FROM class WHERE id = $1', [CLASS_ID]);

    const secondRelease = await releaseExpiredHolds(client, CLASS_ID);
    const { rows: [afterSecond] } = await client.query<{ seats_taken: number }>(
      'SELECT seats_taken FROM class WHERE id = $1', [CLASS_ID]);

    console.log(`claimed=${seats} firstRelease=${firstRelease} seatsAfterFirst=${afterFirst.seats_taken} secondRelease=${secondRelease} seatsAfterSecond=${afterSecond.seats_taken}`);

    // Cleanup (enrollment first — no cascade from child).
    await client.query(
      'DELETE FROM enrollment WHERE child_id IN (SELECT id FROM child WHERE parent_id = $1)',
      [parent.id],
    );
    await client.query('DELETE FROM parent WHERE id = $1', [parent.id]);
    await client.query('UPDATE class SET seats_taken = 0 WHERE id = $1', [CLASS_ID]);

    const ok =
      seats === 1 &&
      firstRelease === 1 && afterFirst.seats_taken === 0 &&
      secondRelease === 0 && afterSecond.seats_taken === 0;
    if (!ok) {
      console.error('FAIL — hold not released once-and-only-once');
      process.exit(1);
    }
    console.log('PASS — expired hold released exactly once; no double-decrement');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
