// Oversell test: fire N concurrent seat claims at the 12-seat class and assert
// exactly 12 win and seats_taken lands on 12. This is the "50 parents, 12 seats,
// 8am rush" scenario from the brief.
import { pool } from '../db/pool';
import { claimSeat } from '../lib/registration/claimSeat';

const CLASS_ID = '22222222-2222-2222-2222-222222222222'; // seeded, capacity 12
const N = 50;

async function main() {
  const { rows: [cls] } = await pool.query<{ capacity: number }>(
    'SELECT capacity FROM class WHERE id = $1',
    [CLASS_ID],
  );
  const capacity = cls.capacity;

  // Reset to a clean slate for a repeatable test.
  await pool.query('UPDATE class SET seats_taken = 0 WHERE id = $1', [CLASS_ID]);

  // Fire all claims concurrently (pool max = 20, so ~20 truly race at once).
  const results = await Promise.all(
    Array.from({ length: N }, () => claimSeat(pool, CLASS_ID)),
  );

  const winners = results.filter((r) => r !== null).length;
  const losers = results.filter((r) => r === null).length;
  const { rows: [after] } = await pool.query<{ seats_taken: number }>(
    'SELECT seats_taken FROM class WHERE id = $1',
    [CLASS_ID],
  );

  console.log(`attempts=${N} capacity=${capacity} winners=${winners} losers=${losers} seats_taken=${after.seats_taken}`);

  // Reset so the seed stays pristine for other work.
  await pool.query('UPDATE class SET seats_taken = 0 WHERE id = $1', [CLASS_ID]);
  await pool.end();

  const ok = winners === capacity && losers === N - capacity && after.seats_taken === capacity;
  if (!ok) {
    console.error('FAIL — oversell or undersell detected');
    process.exit(1);
  }
  console.log(`PASS — exactly ${capacity} seats sold under ${N}-way contention, no oversell`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
