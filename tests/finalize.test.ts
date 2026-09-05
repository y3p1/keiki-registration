// Webhook finalize/expire test (deterministic, no Stripe signature needed):
//   A. finalize: pending enrollments -> active, payment paid, submission finalized;
//      a replayed webhook is a no-op (already_finalized).
//   B. expire:   pending holds released, seat count decremented, payment expired.
import { randomUUID } from 'node:crypto';
import { pool } from '../db/pool';
import { claimSeat } from '../lib/registration/claimSeat';
import { finalizeCheckout, expireCheckout } from '../lib/registration/finalize';

const FOOTBALL = '33333333-3333-3333-3333-333333333333'; // cap 20

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
}

// Build a full pending reservation (parent, child, payment, enrollment, submission)
// with a seat actually claimed, mirroring what /api/register leaves behind.
async function seedPending(email: string, sessionId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [parent] } = await client.query(
      `INSERT INTO parent (email, full_name) VALUES ($1, 'Webhook Test') RETURNING id`, [email]);
    const { rows: [child] } = await client.query(
      `INSERT INTO child (parent_id, full_name) VALUES ($1, 'Kid') RETURNING id`, [parent.id]);
    const { rows: [pay] } = await client.query(
      `INSERT INTO payment (parent_id, stripe_checkout_session_id, amount_cents, currency, status)
       VALUES ($1, $2, 9000, 'usd', 'pending') RETURNING id`, [parent.id, sessionId]);
    const submissionId = randomUUID();
    await client.query(
      `INSERT INTO submission (id, parent_id, payment_id, payload, status)
       VALUES ($1, $2, $3, '{}'::jsonb, 'checkout_created')`, [submissionId, parent.id, pay.id]);
    const seat = await claimSeat(client, FOOTBALL);
    assert(seat !== null, 'seed seat claim');
    await client.query(
      `INSERT INTO enrollment (child_id, class_id, payment_id, status, join_date, reserved_until)
       VALUES ($1, $2, $3, 'pending', CURRENT_DATE, now() + interval '35 minutes')`,
      [child.id, FOOTBALL, pay.id]);
    await client.query('COMMIT');
    return { parentId: parent.id, paymentId: pay.id };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function cleanup(email: string) {
  await pool.query(
    `DELETE FROM enrollment WHERE child_id IN
       (SELECT id FROM child WHERE parent_id IN (SELECT id FROM parent WHERE email = $1))`, [email]);
  await pool.query(`DELETE FROM submission WHERE parent_id IN (SELECT id FROM parent WHERE email = $1)`, [email]);
  await pool.query(`DELETE FROM payment WHERE parent_id IN (SELECT id FROM parent WHERE email = $1)`, [email]);
  await pool.query('DELETE FROM parent WHERE email = $1', [email]);
  await pool.query('UPDATE class SET seats_taken = 0 WHERE id = $1', [FOOTBALL]);
}

async function scenarioFinalize() {
  const email = 'wh-finalize@example.com';
  const session = `cs_test_fin_${randomUUID()}`;
  await cleanup(email);
  const { paymentId } = await seedPending(email, session);

  const r1 = await finalizeCheckout(pool, session, 'pi_test_123');
  assert(r1.outcome === 'finalized', `expected finalized, got ${r1.outcome}`);

  const state = await pool.query<{ e_status: string; p_status: string; s_status: string; held: boolean }>(
    `SELECT (SELECT status FROM enrollment WHERE payment_id=$1 LIMIT 1) e_status,
            (SELECT status FROM payment WHERE id=$1) p_status,
            (SELECT status FROM submission WHERE payment_id=$1) s_status,
            (SELECT reserved_until IS NOT NULL FROM enrollment WHERE payment_id=$1 LIMIT 1) held`, [paymentId]);
  const s = state.rows[0];
  assert(s.e_status === 'active', `enrollment ${s.e_status}`);
  assert(s.p_status === 'paid', `payment ${s.p_status}`);
  assert(s.s_status === 'finalized', `submission ${s.s_status}`);
  assert(s.held === false, 'hold not cleared');

  // Replay the webhook — must be a no-op.
  const r2 = await finalizeCheckout(pool, session, 'pi_test_123');
  assert(r2.outcome === 'already_finalized', `replay ${r2.outcome}`);

  await cleanup(email);
  console.log('PASS A — finalize: enrollments active, payment paid, submission finalized; replay is a no-op');
}

async function scenarioExpire() {
  const email = 'wh-expire@example.com';
  const session = `cs_test_exp_${randomUUID()}`;
  await cleanup(email);
  const { paymentId } = await seedPending(email, session);

  const before = await pool.query<{ seats_taken: number }>('SELECT seats_taken FROM class WHERE id=$1', [FOOTBALL]);
  const r = await expireCheckout(pool, session);
  assert(r.outcome === 'expired' && r.released === 1, `expire ${JSON.stringify(r)}`);

  const state = await pool.query<{ e_status: string; p_status: string; seats_taken: number }>(
    `SELECT (SELECT status FROM enrollment WHERE payment_id=$1 LIMIT 1) e_status,
            (SELECT status FROM payment WHERE id=$1) p_status,
            (SELECT seats_taken FROM class WHERE id=$2) seats_taken`, [paymentId, FOOTBALL]);
  const s = state.rows[0];
  assert(s.e_status === 'expired', `enrollment ${s.e_status}`);
  assert(s.p_status === 'expired', `payment ${s.p_status}`);
  assert(s.seats_taken === before.rows[0].seats_taken - 1, `seat not released: ${s.seats_taken}`);

  await cleanup(email);
  console.log('PASS B — expire: holds released, seat decremented, payment expired');
}

async function main() {
  try {
    await scenarioFinalize();
    await scenarioExpire();
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
