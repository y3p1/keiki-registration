import type { Pool } from 'pg';
import { withTransaction } from '../../db/tx';
import { claimSeat } from './claimSeat';
import { releaseExpiredHolds } from './releaseSeats';
import { insertSubmission, getSubmissionRetry } from './submission';
import { upsertParent, findOrCreateChildren, type ParentInput, type ChildInput } from './parent';

const HOLD_MINUTES = 35; // must exceed the Stripe checkout expires_at (31 min)

export interface RegisterInput {
  submissionId: string; // client-generated UUID (idempotency key)
  parent: ParentInput;
  children: ChildInput[];
}

export interface CheckoutParams {
  submissionId: string;
  paymentId: string;
  currency: string;
  lineItems: { name: string; amountCents: number; quantity: number }[];
  successUrl: string;
  cancelUrl: string;
}
export type CheckoutCreator = (p: CheckoutParams) => Promise<{ id: string; url: string }>;

export type RegisterResult =
  | { status: 'created'; checkoutUrl: string }
  | { status: 'duplicate'; checkoutUrl: string }
  | { status: 'already_registered' }
  | { status: 'processing' }
  | { status: 'full'; classId: string; classTitle: string };

export class RegisterError extends Error {
  constructor(public code: 'CLASS_NOT_FOUND' | 'CLASS_CLOSED' | 'EMPTY_SUBMISSION', message: string) {
    super(message);
  }
}

class SeatUnavailable extends Error {
  constructor(public classId: string, public classTitle: string) {
    super(`class full: ${classTitle}`);
  }
}

interface ClassRow {
  id: string;
  title: string;
  price_cents: number;
  currency: string;
  status: string;
}

const baseUrl = () => process.env.APP_BASE_URL ?? 'http://localhost:3000';

// Entry point. Ordered, idempotent, all-or-nothing. See PRD 5.1.
export async function registerSubmission(
  pool: Pool,
  input: RegisterInput,
  deps: { createCheckout: CheckoutCreator },
): Promise<RegisterResult> {
  if (input.children.length === 0 || input.children.every((c) => c.classIds.length === 0)) {
    throw new RegisterError('EMPTY_SUBMISSION', 'submission has no child+class selections');
  }

  // 1. Race-safe parent dedupe (outside the seat transaction).
  const parentId = await upsertParent(pool, input.parent);

  // 2. Idempotency gate.
  const gate = await insertSubmission(pool, input.submissionId, parentId, input);
  if (!gate.created) {
    return resumeExisting(pool, input, parentId, deps);
  }

  // 3. Fresh submission → reserve + checkout.
  return reserveAndCheckout(pool, input, parentId, deps);
}

// Handle a duplicate submission id: return the stored checkout, resume a crashed
// attempt, or report terminal state. Never charges twice.
async function resumeExisting(
  pool: Pool,
  input: RegisterInput,
  parentId: string,
  deps: { createCheckout: CheckoutCreator },
): Promise<RegisterResult> {
  const existing = await getSubmissionRetry(pool, input.submissionId);

  if (existing.submissionStatus === 'checkout_created' && existing.checkoutUrl) {
    return { status: 'duplicate', checkoutUrl: existing.checkoutUrl };
  }
  if (existing.submissionStatus === 'finalized') {
    return { status: 'already_registered' };
  }
  if (existing.submissionStatus === 'received') {
    // A prior attempt inserted the submission but didn't reach checkout_created.
    // If it got as far as a pending payment, just create the checkout for it;
    // otherwise its reservation transaction rolled back, so redo the whole flow.
    const { rows } = await pool.query<{ id: string; currency: string; checkout_url: string | null }>(
      `SELECT p.id, p.currency, p.checkout_url
         FROM submission s JOIN payment p ON p.id = s.payment_id
        WHERE s.id = $1`,
      [input.submissionId],
    );
    const payment = rows[0];
    if (payment && payment.checkout_url) {
      return { status: 'duplicate', checkoutUrl: payment.checkout_url };
    }
    if (payment) {
      const items = await stripeLineItemsForPayment(pool, payment.id);
      const checkout = await createAndLink(pool, input.submissionId, payment.id, payment.currency, items, deps);
      return { status: 'created', checkoutUrl: checkout.url };
    }
    return reserveAndCheckout(pool, input, parentId, deps);
  }
  return { status: 'processing' };
}

async function reserveAndCheckout(
  pool: Pool,
  input: RegisterInput,
  parentId: string,
  deps: { createCheckout: CheckoutCreator },
): Promise<RegisterResult> {
  let reservation: { paymentId: string; currency: string; lineItems: CheckoutParams['lineItems'] };
  try {
    reservation = await withTransaction(pool, async (client) => {
      const childIds = await findOrCreateChildren(client, parentId, input.children);

      // Flatten to (childId, classId) line items — one seat each.
      const lines: { childId: string; classId: string }[] = [];
      input.children.forEach((child, i) => {
        for (const classId of child.classIds) lines.push({ childId: childIds[i], classId });
      });

      const classIds = [...new Set(lines.map((l) => l.classId))];
      const classes = await loadClasses(client, classIds);

      // Lazy expiry then atomic claim per line item; any failure rolls back all.
      for (const classId of classIds) await releaseExpiredHolds(client, classId);
      for (const line of lines) {
        const seat = await claimSeat(client, line.classId);
        if (seat === null) {
          const c = classes.get(line.classId)!;
          throw new SeatUnavailable(c.id, c.title);
        }
      }

      const currency = classes.get(classIds[0])!.currency;
      const amount = lines.reduce((sum, l) => sum + classes.get(l.classId)!.price_cents, 0);

      const { rows: [pay] } = await client.query<{ id: string }>(
        `INSERT INTO payment (parent_id, amount_cents, currency, status)
         VALUES ($1, $2, $3, 'pending') RETURNING id`,
        [parentId, amount, currency],
      );

      const reservedUntil = new Date(Date.now() + HOLD_MINUTES * 60_000);
      for (const line of lines) {
        await client.query(
          `INSERT INTO enrollment (child_id, class_id, payment_id, status, join_date, reserved_until)
           VALUES ($1, $2, $3, 'pending', CURRENT_DATE, $4)`,
          [line.childId, line.classId, pay.id, reservedUntil],
        );
      }

      await client.query('UPDATE submission SET payment_id = $1 WHERE id = $2', [pay.id, input.submissionId]);

      // Group line items by class for the Stripe checkout (title × quantity).
      const qty = new Map<string, number>();
      for (const line of lines) qty.set(line.classId, (qty.get(line.classId) ?? 0) + 1);
      const lineItems = [...qty].map(([classId, quantity]) => {
        const c = classes.get(classId)!;
        return { name: c.title, amountCents: c.price_cents, quantity };
      });

      return { paymentId: pay.id, currency, lineItems };
    });
  } catch (err) {
    if (err instanceof SeatUnavailable) {
      return { status: 'full', classId: err.classId, classTitle: err.classTitle };
    }
    throw err;
  }

  // After commit — create the Stripe checkout and link it. If this fails, the
  // pending holds simply expire (lazy release) and the parent can retry.
  const checkout = await createAndLink(
    pool, input.submissionId, reservation.paymentId, reservation.currency, reservation.lineItems, deps,
  );
  return { status: 'created', checkoutUrl: checkout.url };
}

async function createAndLink(
  pool: Pool,
  submissionId: string,
  paymentId: string,
  currency: string,
  lineItems: CheckoutParams['lineItems'],
  deps: { createCheckout: CheckoutCreator },
): Promise<{ id: string; url: string }> {
  const checkout = await deps.createCheckout({
    submissionId,
    paymentId,
    currency,
    lineItems,
    successUrl: `${baseUrl()}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${baseUrl()}/cancel`,
  });
  await pool.query(
    'UPDATE payment SET stripe_checkout_session_id = $1, checkout_url = $2 WHERE id = $3',
    [checkout.id, checkout.url, paymentId],
  );
  await pool.query("UPDATE submission SET status = 'checkout_created' WHERE id = $1", [submissionId]);
  return checkout;
}

async function loadClasses(
  client: Parameters<Parameters<typeof withTransaction>[1]>[0],
  classIds: string[],
): Promise<Map<string, ClassRow>> {
  const { rows } = await client.query<ClassRow>(
    'SELECT id, title, price_cents, currency, status FROM class WHERE id = ANY($1)',
    [classIds],
  );
  const map = new Map(rows.map((r) => [r.id, r]));
  for (const id of classIds) {
    const c = map.get(id);
    if (!c) throw new RegisterError('CLASS_NOT_FOUND', `class ${id} does not exist`);
    if (c.status !== 'open') throw new RegisterError('CLASS_CLOSED', `class ${c.title} is not open`);
  }
  return map;
}

async function stripeLineItemsForPayment(pool: Pool, paymentId: string): Promise<CheckoutParams['lineItems']> {
  const { rows } = await pool.query<{ title: string; price_cents: number; quantity: number }>(
    `SELECT c.title, c.price_cents, count(*)::int AS quantity
       FROM enrollment e JOIN class c ON c.id = e.class_id
      WHERE e.payment_id = $1
      GROUP BY c.title, c.price_cents`,
    [paymentId],
  );
  return rows.map((r) => ({ name: r.title, amountCents: r.price_cents, quantity: r.quantity }));
}
