// Registration service test — the graded core, exercised end-to-end at the DB
// layer with a fake checkout creator (no Stripe key needed):
//   A. happy path: multi-child, multi-class -> one payment, N pending enrollments
//   B. rollback:   one full class in the submission -> nothing persisted
//   C. duplicate:  same submissionId twice -> one payment, same checkout URL
import { randomUUID } from 'node:crypto';
import { pool } from '../db/pool';
import { registerSubmission, type CheckoutCreator } from '../lib/registration/register';

const CODING = '22222222-2222-2222-2222-222222222222'; // cap 12, $120
const FOOTBALL = '33333333-3333-3333-3333-333333333333'; // cap 20, $90

const fakeCheckout: CheckoutCreator = async ({ paymentId }) => ({
  id: `cs_test_${paymentId}`,
  url: `https://fake.stripe/checkout/${paymentId}`,
});

async function cleanup(emails: string[]) {
  await pool.query(
    `DELETE FROM enrollment WHERE child_id IN
       (SELECT id FROM child WHERE parent_id IN (SELECT id FROM parent WHERE email = ANY($1)))`,
    [emails],
  );
  await pool.query(
    `DELETE FROM submission WHERE parent_id IN (SELECT id FROM parent WHERE email = ANY($1))`,
    [emails],
  );
  await pool.query(
    `DELETE FROM payment WHERE parent_id IN (SELECT id FROM parent WHERE email = ANY($1))`,
    [emails],
  );
  await pool.query('DELETE FROM parent WHERE email = ANY($1)', [emails]);
  await pool.query('UPDATE class SET seats_taken = 0 WHERE id = ANY($1)', [[CODING, FOOTBALL]]);
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
}

async function scenarioHappy() {
  const email = 'happy-reg@example.com';
  await cleanup([email]);
  const res = await registerSubmission(
    pool,
    {
      submissionId: randomUUID(),
      parent: { email, fullName: 'Happy Parent' },
      children: [
        { fullName: 'Kid One', classIds: [CODING, FOOTBALL] },
        { fullName: 'Kid Two', classIds: [FOOTBALL] },
      ],
    },
    { createCheckout: fakeCheckout },
  );
  assert(res.status === 'created', `expected created, got ${res.status}`);
  const { rows: [pay] } = await pool.query<{ amount_cents: number; checkout_url: string }>(
    `SELECT amount_cents, checkout_url FROM payment
      WHERE parent_id = (SELECT id FROM parent WHERE email = $1)`, [email]);
  const { rows: [{ n: enrollN }] } = await pool.query<{ n: number }>(
    `SELECT count(*)::int n FROM enrollment WHERE payment_id =
       (SELECT id FROM payment WHERE parent_id = (SELECT id FROM parent WHERE email = $1))`, [email]);
  const { rows: [seats] } = await pool.query<{ coding: number; football: number }>(
    `SELECT (SELECT seats_taken FROM class WHERE id=$1) coding,
            (SELECT seats_taken FROM class WHERE id=$2) football`, [CODING, FOOTBALL]);
  assert(pay.amount_cents === 12000 + 9000 + 9000, `amount ${pay.amount_cents}`);
  assert(enrollN === 3, `enrollments ${enrollN}`);
  assert(seats.coding === 1 && seats.football === 2, `seats c=${seats.coding} f=${seats.football}`);
  await cleanup([email]);
  console.log('PASS A — happy path: 1 payment $300, 3 pending enrollments, seats 1/2');
}

async function scenarioRollback() {
  const email = 'rollback-reg@example.com';
  await cleanup([email]);
  await pool.query('UPDATE class SET seats_taken = capacity WHERE id = $1', [FOOTBALL]); // full
  const res = await registerSubmission(
    pool,
    {
      submissionId: randomUUID(),
      parent: { email, fullName: 'Rollback Parent' },
      children: [{ fullName: 'Kid', classIds: [CODING, FOOTBALL] }],
    },
    { createCheckout: fakeCheckout },
  );
  assert(res.status === 'full', `expected full, got ${res.status}`);
  const { rows: [{ n: payN }] } = await pool.query<{ n: number }>(
    `SELECT count(*)::int n FROM payment WHERE parent_id =
       (SELECT id FROM parent WHERE email = $1)`, [email]);
  const { rows: [coding] } = await pool.query<{ seats_taken: number }>(
    'SELECT seats_taken FROM class WHERE id = $1', [CODING]);
  assert(payN === 0, `expected no payment, got ${payN}`);
  assert(coding.seats_taken === 0, `coding seat leaked: ${coding.seats_taken}`);
  await cleanup([email]);
  console.log('PASS B — rollback: full class aborts whole submission, nothing persisted, no seat leak');
}

async function scenarioDuplicate() {
  const email = 'dup-reg@example.com';
  await cleanup([email]);
  const submissionId = randomUUID();
  const input = {
    submissionId,
    parent: { email, fullName: 'Dup Parent' },
    children: [{ fullName: 'Kid', classIds: [FOOTBALL] }],
  };
  const first = await registerSubmission(pool, input, { createCheckout: fakeCheckout });
  const second = await registerSubmission(pool, input, { createCheckout: fakeCheckout });
  assert(first.status === 'created', `first ${first.status}`);
  assert(second.status === 'duplicate', `second ${second.status}`);
  assert(
    'checkoutUrl' in first && 'checkoutUrl' in second && first.checkoutUrl === second.checkoutUrl,
    'checkout URLs differ',
  );
  const { rows: [{ n: payN }] } = await pool.query<{ n: number }>(
    `SELECT count(*)::int n FROM payment WHERE parent_id =
       (SELECT id FROM parent WHERE email = $1)`, [email]);
  const { rows: [{ n: enrollN }] } = await pool.query<{ n: number }>(
    `SELECT count(*)::int n FROM enrollment WHERE child_id IN
       (SELECT id FROM child WHERE parent_id = (SELECT id FROM parent WHERE email = $1))`, [email]);
  assert(payN === 1, `expected 1 payment, got ${payN}`);
  assert(enrollN === 1, `expected 1 enrollment, got ${enrollN}`);
  await cleanup([email]);
  console.log('PASS C — duplicate submissionId: one payment, one enrollment, same checkout URL, no double charge');
}

async function main() {
  try {
    await scenarioHappy();
    await scenarioRollback();
    await scenarioDuplicate();
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
