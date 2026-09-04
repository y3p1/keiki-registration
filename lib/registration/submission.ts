import type { Queryable } from '../../db/tx.ts';

export type SubmissionState = 'received' | 'checkout_created' | 'finalized' | 'failed';

export interface SubmissionRetry {
  submissionStatus: SubmissionState;
  checkoutUrl: string | null;
  paymentStatus: string | null;
}

export type InsertResult =
  | { created: true }
  | { created: false; existing: SubmissionRetry };

// Idempotency gate. The client generates the submission UUID once and sends it
// with the form; a double-click / resubmit carries the same UUID.
//
// Fresh id  -> row inserted, { created: true }, caller proceeds with the flow.
// Duplicate -> nothing inserted, { created: false, existing }, and the caller
//              branches on existing.submissionStatus (return stored checkout URL
//              for 'checkout_created', resume for 'received', etc. — see PRD 5.5).
export async function insertSubmission(
  db: Queryable,
  id: string,
  parentId: string,
  payload: unknown,
): Promise<InsertResult> {
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO submission (id, parent_id, payload)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [id, parentId, JSON.stringify(payload)],
  );
  if (rows.length) return { created: true };
  return { created: false, existing: await getSubmissionRetry(db, id) };
}

// Fetch what a retry needs to respond without creating a second charge: the
// submission's own status plus the linked payment's checkout URL (if a checkout
// was already created).
export async function getSubmissionRetry(db: Queryable, id: string): Promise<SubmissionRetry> {
  const { rows } = await db.query<{
    submission_status: SubmissionState;
    checkout_url: string | null;
    payment_status: string | null;
  }>(
    `SELECT s.status       AS submission_status,
            p.checkout_url AS checkout_url,
            p.status       AS payment_status
       FROM submission s
       LEFT JOIN payment p ON p.id = s.payment_id
      WHERE s.id = $1`,
    [id],
  );
  const row = rows[0];
  return {
    submissionStatus: row.submission_status,
    checkoutUrl: row.checkout_url,
    paymentStatus: row.payment_status,
  };
}
