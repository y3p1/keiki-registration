import type { Pool } from 'pg';
import { withTransaction } from '../../db/tx';
import { claimSeat } from './claimSeat';
import { releaseEnrollments } from './releaseSeats';

// Finalize a paid checkout. The webhook — NOT the browser redirect — is the
// source of truth, so a parent who closes the tab after paying still gets
// registered when this fires.
//
// Idempotent: the payment row is locked FOR UPDATE and a already-'paid' payment
// short-circuits, so a retried or duplicated webhook can't double-activate.
export type FinalizeOutcome =
  | { outcome: 'finalized'; activated: number; refundNeeded: string[] }
  | { outcome: 'already_finalized' }
  | { outcome: 'unknown' };

export async function finalizeCheckout(
  pool: Pool,
  checkoutSessionId: string,
  paymentIntentId?: string | null,
): Promise<FinalizeOutcome> {
  return withTransaction(pool, async (client) => {
    const { rows: [payment] } = await client.query<{ id: string; status: string }>(
      'SELECT id, status FROM payment WHERE stripe_checkout_session_id = $1 FOR UPDATE',
      [checkoutSessionId],
    );
    if (!payment) return { outcome: 'unknown' };
    if (payment.status === 'paid') return { outcome: 'already_finalized' };

    // Late-payer safety net: if any hold already expired (paid after release),
    // try to re-claim the seat. Success -> back to pending for activation below.
    // Failure (class refilled) -> leave expired and flag for refund.
    const { rows: expired } = await client.query<{ id: string; class_id: string }>(
      "SELECT id, class_id FROM enrollment WHERE payment_id = $1 AND status = 'expired'",
      [payment.id],
    );
    const refundNeeded: string[] = [];
    for (const e of expired) {
      const seat = await claimSeat(client, e.class_id);
      if (seat === null) {
        refundNeeded.push(e.class_id);
      } else {
        await client.query("UPDATE enrollment SET status = 'pending' WHERE id = $1", [e.id]);
      }
    }

    // Activate every held (pending) enrollment for this payment; clear the hold.
    const activated = await client.query(
      "UPDATE enrollment SET status = 'active', reserved_until = NULL WHERE payment_id = $1 AND status = 'pending'",
      [payment.id],
    );

    await client.query(
      `UPDATE payment
          SET status = 'paid', paid_at = now(),
              stripe_payment_intent_id = COALESCE($2, stripe_payment_intent_id)
        WHERE id = $1`,
      [payment.id, paymentIntentId ?? null],
    );
    await client.query("UPDATE submission SET status = 'finalized' WHERE payment_id = $1", [payment.id]);

    return { outcome: 'finalized', activated: activated.rowCount ?? 0, refundNeeded };
  });
}

// Release the seat holds of an abandoned checkout (Stripe fired
// checkout.session.expired). Never touches a payment that already succeeded.
export type ExpireOutcome =
  | { outcome: 'expired'; released: number }
  | { outcome: 'already_paid' }
  | { outcome: 'unknown' };

export async function expireCheckout(pool: Pool, checkoutSessionId: string): Promise<ExpireOutcome> {
  return withTransaction(pool, async (client) => {
    const { rows: [payment] } = await client.query<{ id: string; status: string }>(
      'SELECT id, status FROM payment WHERE stripe_checkout_session_id = $1 FOR UPDATE',
      [checkoutSessionId],
    );
    if (!payment) return { outcome: 'unknown' };
    if (payment.status === 'paid') return { outcome: 'already_paid' };

    const { rows: ids } = await client.query<{ id: string }>(
      "SELECT id FROM enrollment WHERE payment_id = $1 AND status = 'pending'",
      [payment.id],
    );
    const released = await releaseEnrollments(client, ids.map((r) => r.id), 'expired');
    await client.query("UPDATE payment SET status = 'expired' WHERE id = $1 AND status = 'pending'", [payment.id]);
    return { outcome: 'expired', released };
  });
}
