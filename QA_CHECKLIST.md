# E2E QA Checklist

Run through this to exercise the whole app before recording. Automated tests
(`npm test`) already cover the concurrency/idempotency/finalize/cancel logic —
this is the **human, click-through** pass.

## 0. Start everything

```bash
npm run dev                                                             # terminal 1  (http://localhost:3000)
C:/Users/Asi/stripe-cli/stripe.exe listen --forward-to localhost:3000/api/webhook   # terminal 2 (keep running)
```
- [ ] Confirm the listener's signing secret == `STRIPE_WEBHOOK_SECRET` in `.env`.
- [ ] n8n Cloud workflow is **Published** (for the confirmation email).

Reset demo data anytime: `npm run seed` (idempotent). To wipe seats/enrollments, re-run migrations on a fresh DB or clear rows manually.

## 1. Happy path — register + pay + confirm

- [ ] `/register` → fill parent, add **2 children**, tick classes for each (mix classes).
- [ ] Total updates as you tick. Click **Register & Pay** → redirected to Stripe.
- [ ] Pay with test card `4242 4242 4242 4242`, any future expiry / any CVC / any ZIP.
- [ ] Redirects to `/success`.
- [ ] Terminal 2 shows `checkout.session.completed` forwarded; terminal 1 logs `[webhook] completed … -> finalized`.
- [ ] Confirmation **email arrives** (check the parent email you used — NOT the account email).
- [ ] `/my` (log in with that email) → enrollments show **Active**.

## 2. Oversell / capacity

- [ ] On `/register`, a class showing **FULL** has its checkbox disabled.
- [ ] (Automated proof already: `npm run test:concurrency` → 50 attempts, exactly 12 win.)

## 3. Idempotency / partial failure

- [ ] Double-click **Register & Pay** (or refresh mid-submit) → still **one** Stripe checkout, no double charge (submission UUID dedupes).
- [ ] Abandon a checkout (hit back / `/cancel`) → seat is NOT permanently taken; the hold expires. (`npm run test:release` proves the release.)

## 4. Cancellation flow (request → approve)

- [ ] `/my` → an **Active** registration shows **Request cancellation** → click it → status becomes **Cancellation requested**.
- [ ] `/staff` (enter `STAFF_SECRET`, default `staff-demo`) → the request appears under **Pending cancellation requests**.
- [ ] Click **Approve** → row clears; back on `/register` that class shows one more seat left (seat released).

## 5. Session exceptions

- [ ] `/staff` → **Sessions** table → **Cancel** a scheduled session → status flips to `canceled`, other weeks unchanged.
- [ ] **Reschedule** one (pick a date) → status `rescheduled`, new date shown, class + other sessions untouched.

## 6. Auth / access

- [ ] `/my` without logging in → shows the email form, no data.
- [ ] `/staff` without the secret → shows the secret form, no data.
- [ ] Parent can only cancel **their own** enrollments (ownership checked server-side).

## What to narrate in the Loom (Part 2)

- The creation order (parent → children → reserve txn → Stripe → webhook finalize).
- Oversell: the atomic `UPDATE … WHERE seats_taken < capacity` (cite DermaRoute prior art).
- Idempotency: submission UUID + webhook-as-source-of-truth.
- What's deliberately out of v1 (see `workflow/PRD.md`).
- What you'd ask about their real Airtable/n8n system before building for real.
