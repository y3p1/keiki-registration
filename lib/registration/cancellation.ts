import type { Pool } from 'pg';
import { withTransaction } from '../../db/tx';

// The brief says parents "request a cancellation" — so cancellation is a
// two-step, staff-approved flow, never a self-service delete:
//   active -> cancel_requested   (parent)
//   cancel_requested -> canceled (staff approval; seat released)

export type RequestOutcome = 'requested' | 'not_active';

// Parent asks to cancel. Guarded to active enrollments so a double-click or a
// request on an already-canceled row is a safe no-op.
export async function requestCancellation(pool: Pool, enrollmentId: string): Promise<RequestOutcome> {
  const { rowCount } = await pool.query(
    "UPDATE enrollment SET status = 'cancel_requested' WHERE id = $1 AND status = 'active'",
    [enrollmentId],
  );
  return rowCount ? 'requested' : 'not_active';
}

export type ApproveOutcome = 'canceled' | 'not_requested';

// Staff approves the request: flip to canceled AND release the seat, in one
// transaction. Guarded on cancel_requested so a double approval decrements the
// class counter only once (double-release-proof).
export async function approveCancellation(pool: Pool, enrollmentId: string): Promise<ApproveOutcome> {
  return withTransaction(pool, async (client) => {
    const { rows } = await client.query<{ class_id: string }>(
      `UPDATE enrollment
          SET status = 'canceled', drop_date = CURRENT_DATE
        WHERE id = $1 AND status = 'cancel_requested'
        RETURNING class_id`,
      [enrollmentId],
    );
    if (rows.length === 0) return 'not_requested';
    await client.query('UPDATE class SET seats_taken = seats_taken - 1 WHERE id = $1', [rows[0].class_id]);
    return 'canceled';
  });
}
