// Cancellation + session-exception test:
//   A. request -> approve: active -> cancel_requested -> canceled, seat released once
//   B. guards: request on non-active is a no-op; approve without a request is a no-op
//   C. session: cancel and reschedule touch one session, not the class/others
import { randomUUID } from 'node:crypto';
import { pool } from '../db/pool';
import { claimSeat } from '../lib/registration/claimSeat';
import { requestCancellation, approveCancellation } from '../lib/registration/cancellation';
import { cancelSession, rescheduleSession } from '../lib/registration/session';

const FOOTBALL = '33333333-3333-3333-3333-333333333333';
const EMAIL = 'cancel-test@example.com';

function assert(c: boolean, m: string) { if (!c) throw new Error(`ASSERT FAILED: ${m}`); }

async function makeActiveEnrollment(): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [p] } = await client.query(`INSERT INTO parent (email, full_name) VALUES ($1,'C') RETURNING id`, [EMAIL]);
    const { rows: [ch] } = await client.query(`INSERT INTO child (parent_id, full_name) VALUES ($1,'K') RETURNING id`, [p.id]);
    const { rows: [pay] } = await client.query(
      `INSERT INTO payment (parent_id, amount_cents, currency, status) VALUES ($1,9000,'usd','paid') RETURNING id`, [p.id]);
    await claimSeat(client, FOOTBALL);
    const { rows: [e] } = await client.query(
      `INSERT INTO enrollment (child_id, class_id, payment_id, status, join_date) VALUES ($1,$2,$3,'active',CURRENT_DATE) RETURNING id`,
      [ch.id, FOOTBALL, pay.id]);
    await client.query('COMMIT');
    return e.id;
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
}

async function cleanup() {
  await pool.query(`DELETE FROM enrollment WHERE child_id IN (SELECT id FROM child WHERE parent_id IN (SELECT id FROM parent WHERE email=$1))`, [EMAIL]);
  await pool.query(`DELETE FROM payment WHERE parent_id IN (SELECT id FROM parent WHERE email=$1)`, [EMAIL]);
  await pool.query('DELETE FROM parent WHERE email=$1', [EMAIL]);
  await pool.query('UPDATE class SET seats_taken=0 WHERE id=$1', [FOOTBALL]);
}

async function scenarioRequestApprove() {
  await cleanup();
  const id = await makeActiveEnrollment();
  const before = (await pool.query<{ seats_taken: number }>('SELECT seats_taken FROM class WHERE id=$1', [FOOTBALL])).rows[0].seats_taken;

  assert((await requestCancellation(pool, id)) === 'requested', 'request should succeed');
  assert(((await pool.query('SELECT 1 FROM enrollment WHERE id=$1 AND status=$2', [id, 'cancel_requested'])).rowCount ?? 0) === 1, 'status not cancel_requested');

  assert((await approveCancellation(pool, id)) === 'canceled', 'approve should succeed');
  const after = await pool.query<{ status: string; seats: number }>(
    `SELECT (SELECT status FROM enrollment WHERE id=$1) status, (SELECT seats_taken FROM class WHERE id=$2) seats`, [id, FOOTBALL]);
  assert(after.rows[0].status === 'canceled', `status ${after.rows[0].status}`);
  assert(after.rows[0].seats === before - 1, `seat not released: ${after.rows[0].seats} vs ${before}`);

  // Double approve is a no-op (seat not decremented twice).
  assert((await approveCancellation(pool, id)) === 'not_requested', 'double approve should no-op');
  const seatsNow = (await pool.query<{ seats_taken: number }>('SELECT seats_taken FROM class WHERE id=$1', [FOOTBALL])).rows[0].seats_taken;
  assert(seatsNow === before - 1, `double-release: ${seatsNow}`);
  await cleanup();
  console.log('PASS A — request→approve: active→cancel_requested→canceled, seat released once (double approve no-op)');
}

async function scenarioGuards() {
  await cleanup();
  const id = await makeActiveEnrollment();
  await pool.query("UPDATE enrollment SET status='dropped' WHERE id=$1", [id]); // not active
  assert((await requestCancellation(pool, id)) === 'not_active', 'request on non-active should no-op');
  assert((await approveCancellation(pool, id)) === 'not_requested', 'approve without request should no-op');
  await cleanup();
  console.log('PASS B — guards: request on non-active and approve without request are safe no-ops');
}

async function scenarioSession() {
  const { rows: [s] } = await pool.query<{ id: string; scheduled_date: string }>(
    `SELECT id, scheduled_date FROM session WHERE class_id=$1 AND week_number=4`, [FOOTBALL]);
  const totalBefore = (await pool.query<{ n: number }>('SELECT count(*)::int n FROM session WHERE class_id=$1', [FOOTBALL])).rows[0].n;

  assert((await cancelSession(pool, s.id, 'Thanksgiving')) === 'updated', 'cancel session');
  assert(((await pool.query('SELECT 1 FROM session WHERE id=$1 AND status=$2', [s.id, 'canceled'])).rowCount ?? 0) === 1, 'session not canceled');

  assert((await rescheduleSession(pool, s.id, { scheduledDate: '2026-10-15', startTime: '16:00', endTime: '17:00', note: 'moved' })) === 'updated', 'reschedule');
  const after = (await pool.query<{ status: string; d: string }>('SELECT status, scheduled_date::text d FROM session WHERE id=$1', [s.id])).rows[0];
  assert(after.status === 'rescheduled' && after.d === '2026-10-15', `reschedule state ${JSON.stringify(after)}`);

  const totalAfter = (await pool.query<{ n: number }>('SELECT count(*)::int n FROM session WHERE class_id=$1', [FOOTBALL])).rows[0].n;
  assert(totalAfter === totalBefore, 'session count changed (should touch one row only)');

  // Restore the seeded session so re-runs stay clean.
  await pool.query(
    `UPDATE session SET status='scheduled', scheduled_date=$2, start_time=NULL, end_time=NULL, note=NULL WHERE id=$1`,
    [s.id, s.scheduled_date]);
  console.log('PASS C — session cancel + reschedule affect one row only, class untouched');
}

async function main() {
  try {
    await scenarioRequestApprove();
    await scenarioGuards();
    await scenarioSession();
  } finally { await pool.end(); }
}

main().catch((err) => { console.error(err); process.exit(1); });
