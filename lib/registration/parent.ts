import type { PoolClient } from 'pg';
import type { Queryable } from '../../db/tx';

export interface ParentInput {
  email: string;
  fullName: string;
  phone?: string | null;
}

export interface ChildInput {
  fullName: string;
  dateOfBirth?: string | null; // ISO date
  classIds: string[];
}

// Race-safe parent dedupe. Two simultaneous first-time submissions from the same
// new email both resolve to the same row — no SELECT-then-INSERT race — because
// the unique(email) constraint drives an upsert. Runs outside the seat
// transaction (a parent created for a later-failed submission is harmless and
// reused next attempt).
export async function upsertParent(db: Queryable, input: ParentInput): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO parent (email, full_name, phone)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE
       SET full_name = EXCLUDED.full_name,
           phone     = COALESCE(EXCLUDED.phone, parent.phone)
     RETURNING id`,
    [input.email.trim(), input.fullName.trim(), input.phone ?? null],
  );
  return rows[0].id;
}

// Find-or-create each child by (parent, name, dob), so re-submitting the same
// family doesn't duplicate children. Returns the resolved child id per input,
// index-aligned with `children`.
export async function findOrCreateChildren(
  client: PoolClient,
  parentId: string,
  children: ChildInput[],
): Promise<string[]> {
  const ids: string[] = [];
  for (const child of children) {
    const dob = child.dateOfBirth ?? null;
    const existing = await client.query<{ id: string }>(
      `SELECT id FROM child
        WHERE parent_id = $1
          AND lower(full_name) = lower($2)
          AND date_of_birth IS NOT DISTINCT FROM $3::date
        LIMIT 1`,
      [parentId, child.fullName.trim(), dob],
    );
    if (existing.rows.length) {
      ids.push(existing.rows[0].id);
      continue;
    }
    const created = await client.query<{ id: string }>(
      `INSERT INTO child (parent_id, full_name, date_of_birth)
       VALUES ($1, $2, $3::date)
       RETURNING id`,
      [parentId, child.fullName.trim(), dob],
    );
    ids.push(created.rows[0].id);
  }
  return ids;
}
