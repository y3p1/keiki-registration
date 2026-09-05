# Keiki Coders — Parent Registration System

Parents register their kids for after-school classes and pay at registration via
Stripe. Built to demonstrate **data-modeling, concurrency safety, idempotency,
and partial-failure handling** — not feature breadth.

- **Design docs:** [`keiki-ERD.md`](./keiki-ERD.md) (data model + rationale). Planning docs (PRD, tasks, timeline) live in `workflow/` (local only).
- **Stack:** Next.js 15 (App Router) · TypeScript · Supabase Postgres 16 (raw SQL, no ORM) · Stripe Checkout · n8n (confirmation email, later task).

---

## How the pieces fit

```
Parent form ─▶ POST /api/register ─┐
                                   │  (1) upsert parent   (2) submission idempotency gate
                                   │  (3) TXN: lazy-expire holds ▸ atomic seat claim ▸
                                   │       pending payment + enrollments  (all-or-nothing)
                                   │  (4) create Stripe Checkout ▸ store url  ▸ mark checkout_created
                                   ▼
                         Stripe Checkout ─▶ (webhook, TASK-04) ─▶ finalize ─▶ n8n email
```

The transactional core lives in plain SQL so the two graded queries — the atomic
seat claim and the guarded seat release — stay visible.

---

## Directory map

| Path | What it is |
|---|---|
| `db/migrations/0001_init.sql` | The schema — 9 tables, CHECK/FK constraints, partial unique index, hot-path indexes. Source of truth, mirrors `keiki-ERD.md §4`. |
| `db/migrate.ts` | Idempotent migration runner (tracks applied files in `_migrations`, one transaction per file). |
| `db/seed.sql` / `db/seed.ts` | Seed: 1 school, 2 classes (coding cap **12**, football cap **20**), 20 materialized sessions. Fixed UUIDs, re-runnable. |
| `db/pool.ts` | Shared `pg` Pool. Auto-enables SSL for hosted hosts. `max` capped at 12 (Supabase session-pooler limit is 15). |
| `db/tx.ts` | `withTransaction()` helper + `Queryable` type (Pool or client). |
| `lib/registration/claimSeat.ts` | **Atomic seat claim** — `UPDATE class SET seats_taken+1 WHERE seats_taken < capacity RETURNING`. Returns `null` when full (fail-closed). |
| `lib/registration/releaseSeats.ts` | **Guarded release** — `releaseExpiredHolds` (lazy expiry) + `releaseEnrollments` (cancel/drop). Transition-then-decrement, double-release-proof. |
| `lib/registration/submission.ts` | Idempotency gate on the client-generated submission UUID + retry-info fetch. |
| `lib/registration/parent.ts` | `upsertParent` (race-safe dedupe on email) + `findOrCreateChildren`. |
| `lib/registration/register.ts` | **The service** — orchestrates the whole ordered flow (see below). Stripe is dependency-injected so the DB logic is testable without a key. |
| `lib/stripe.ts` | Real Stripe Checkout Session creator (`expires_at` = 31 min, under the 35-min hold). |
| `app/api/register/route.ts` | Thin HTTP wrapper: zod-validate → `registerSubmission` → map result to status codes. |
| `app/layout.tsx`, `app/page.tsx` | Minimal Next scaffold (real parent UI is TASK-06). |
| `tests/*.test.ts` | Standalone `tsx` scripts (no framework) — see below. |

---

## The registration flow (`registerSubmission`)

Ordered exactly as the PRD's "hard question" answers require:

1. **Upsert parent** — `INSERT ... ON CONFLICT (email) DO UPDATE RETURNING id`. Race-safe: two concurrent first-time submissions from the same email resolve to one row. Runs *outside* the seat transaction.
2. **Idempotency gate** — insert the submission row `ON CONFLICT (id) DO NOTHING`. If it already exists, branch instead of proceeding:
   - `checkout_created` → return the **stored** checkout URL (no second charge).
   - `received` with a pending payment → resume (create checkout for it); with none → redo the flow.
   - `finalized` → already registered.
3. **Reserve transaction** (all-or-nothing):
   - create/find children,
   - lazily release expired holds on each class,
   - **atomic seat claim per child+class line** — any failure throws and rolls back the *entire* submission (returns `full`),
   - insert one pending `payment` + N pending `enrollment` rows (`reserved_until = now()+35min`, `payment_id` linked at creation so the webhook can find them),
   - link `submission.payment_id`.
4. **After commit** — create the Stripe Checkout Session, store its id + url on the payment, mark the submission `checkout_created`. If this step dies, the holds simply expire and the parent can retry (idempotent).

Why seats are reserved **before** Stripe, why the webhook (not the redirect) is the source of truth, and how oversell is prevented — all documented in `workflow/PRD.md §5` and `keiki-ERD.md §3`.

---

## Setup

```bash
npm install
cp .env.example .env          # fill in DATABASE_URL + Stripe keys
npm run migrate               # apply schema
npm run seed                  # load demo data
npm run dev                   # Next dev server
```

### Environment (`.env`)

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Supabase **session pooler** string (port 5432, IPv4). |
| `STRIPE_SECRET_KEY` | Stripe **test** secret (`sk_test_...`). |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (`whsec_...`) — needed in TASK-04. |
| `APP_BASE_URL` | Base URL for Stripe success/cancel redirects (default `http://localhost:3000`). |

`.env` is gitignored — secrets never committed.

---

## Tests

Each is a self-contained script that resets its own data and asserts, then exits non-zero on failure.

```bash
npm test                 # runs all four
npm run test:concurrency # 50 concurrent claims on a 12-seat class -> exactly 12 win (no oversell)
npm run test:idempotency # same submission UUID twice -> one row
npm run test:release     # expired hold released exactly once (no double-decrement)
npm run test:register    # happy multi-child · full-class rollback · duplicate submission
```

---

## Build progress

- ✅ **TASK-01** — schema, migrations, seed (verified on Supabase).
- ✅ **TASK-02** — model layer: atomic claim, idempotency, guarded release + tests.
- ✅ **TASK-03** — registration service, `/api/register`, Stripe checkout (live checkout verified end-to-end).
- ⬚ **TASK-04** — Stripe webhook finalize + n8n confirmation email.
- ⬚ **TASK-05** — session cancel/reschedule + cancellation-request flow.
- ⬚ **TASK-06** — parent/staff UI + minimal auth.
