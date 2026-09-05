import type { Pool } from 'pg';

// Session exceptions. Sessions are materialized rows (not computed from the class
// recurrence), so a holiday cancel or a reschedule touches ONE session and
// leaves the class and every other week untouched.

export type SessionOutcome = 'updated' | 'not_found';

export async function cancelSession(pool: Pool, sessionId: string, note?: string): Promise<SessionOutcome> {
  const { rowCount } = await pool.query(
    "UPDATE session SET status = 'canceled', note = COALESCE($2, note) WHERE id = $1",
    [sessionId, note ?? null],
  );
  return rowCount ? 'updated' : 'not_found';
}

export interface RescheduleInput {
  scheduledDate: string; // ISO date
  startTime?: string | null; // HH:MM, optional override
  endTime?: string | null;
  note?: string | null;
}

export async function rescheduleSession(
  pool: Pool,
  sessionId: string,
  input: RescheduleInput,
): Promise<SessionOutcome> {
  const { rowCount } = await pool.query(
    `UPDATE session
        SET status = 'rescheduled',
            scheduled_date = $2::date,
            start_time = $3,
            end_time = $4,
            note = COALESCE($5, note)
      WHERE id = $1`,
    [sessionId, input.scheduledDate, input.startTime ?? null, input.endTime ?? null, input.note ?? null],
  );
  return rowCount ? 'updated' : 'not_found';
}
