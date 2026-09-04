import type { Queryable } from '../../db/tx';

// Guarded seat release — the single shape used by every "give a seat back" path
// (hold expiry, checkout expired, cancel approval, drop).
//
// Double-release-proof: the status guard means only rows that ACTUALLY
// transition are counted, and the class counter is decremented by exactly that
// count in the same statement. A racing webhook or double-clicked approval that
// finds the row already released transitions nothing and decrements nothing.

const LIVE_HOLDING_STATUSES = ['pending', 'active', 'cancel_requested'] as const;

// Lazy expiry: release pending holds whose reserved_until has elapsed for one
// class. Called at the start of a seat-claim transaction so abandoned checkouts
// never dead-lock seats — no background sweeper needed. Returns rows released.
export async function releaseExpiredHolds(db: Queryable, classId: string): Promise<number> {
  const { rows } = await db.query<{ released: number }>(
    `WITH released AS (
        UPDATE enrollment
           SET status = 'expired'
         WHERE class_id = $1
           AND status = 'pending'
           AND reserved_until < now()
        RETURNING class_id
     ), dec AS (
        UPDATE class c
           SET seats_taken = seats_taken - r.n
          FROM (SELECT class_id, count(*) AS n FROM released GROUP BY class_id) r
         WHERE c.id = r.class_id
        RETURNING c.id
     )
     SELECT count(*)::int AS released FROM released`,
    [classId],
  );
  return rows[0].released;
}

// Release a specific set of enrollments to a terminal status (canceled, dropped,
// expired), guarded so only live-holding rows transition. Sets drop_date when
// dropping. Used by cancel-approval and drop flows. Returns rows released.
export async function releaseEnrollments(
  db: Queryable,
  enrollmentIds: string[],
  toStatus: 'canceled' | 'dropped' | 'expired',
): Promise<number> {
  if (enrollmentIds.length === 0) return 0;
  const { rows } = await db.query<{ released: number }>(
    `WITH released AS (
        UPDATE enrollment
           SET status = $2,
               drop_date = CASE WHEN $2 = 'dropped' THEN CURRENT_DATE ELSE drop_date END
         WHERE id = ANY($1)
           AND status = ANY($3)
        RETURNING class_id
     ), dec AS (
        UPDATE class c
           SET seats_taken = seats_taken - r.n
          FROM (SELECT class_id, count(*) AS n FROM released GROUP BY class_id) r
         WHERE c.id = r.class_id
        RETURNING c.id
     )
     SELECT count(*)::int AS released FROM released`,
    [enrollmentIds, toStatus, LIVE_HOLDING_STATUSES as unknown as string[]],
  );
  return rows[0].released;
}
