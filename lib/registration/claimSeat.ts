import type { Queryable } from '../../db/tx';

// Postgres serializes the row-level write, so N concurrent callers against a
// K-seat class yield exactly K winners. Fail-closed: a full class returns null
// and the caller aborts the whole submission. No lock is held across the slow
// Stripe call — the claim is one statement.
//
// Run inside the caller's registration transaction so that a later failure
// (another child's class is full) rolls the increment back.
export async function claimSeat(db: Queryable, classId: string): Promise<number | null> {
  const { rows } = await db.query<{ seats_taken: number }>(
    `UPDATE class
        SET seats_taken = seats_taken + 1
      WHERE id = $1
        AND seats_taken < capacity
      RETURNING seats_taken`,
    [classId],
  );
  return rows.length ? rows[0].seats_taken : null;
}
