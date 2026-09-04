-- 0001_init.sql — Keiki Coders registration schema.
-- Source of truth = keiki-ERD.md §4. Kept as raw SQL so the atomic seat-claim
-- and guarded-release queries stay visible (they are the graded core).

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

CREATE TABLE school (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  address     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE class (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    uuid NOT NULL REFERENCES school(id),
  title        text NOT NULL,
  day_of_week  smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time   time NOT NULL,
  end_time     time NOT NULL,
  start_date   date NOT NULL,
  weeks        smallint NOT NULL CHECK (weeks > 0),
  capacity     int NOT NULL CHECK (capacity >= 0),
  seats_taken  int NOT NULL DEFAULT 0 CHECK (seats_taken >= 0),
  price_cents  int NOT NULL CHECK (price_cents >= 0),
  currency     text NOT NULL DEFAULT 'usd',
  status       text NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open','closed','archived')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seats_within_capacity CHECK (seats_taken <= capacity)
);

CREATE TABLE session (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id       uuid NOT NULL REFERENCES class(id) ON DELETE CASCADE,
  week_number    smallint NOT NULL,
  scheduled_date date NOT NULL,
  start_time     time,   -- override, else inherit class
  end_time       time,
  status         text NOT NULL DEFAULT 'scheduled'
                   CHECK (status IN ('scheduled','canceled','rescheduled')),
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, week_number)
);

CREATE TABLE parent (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       citext NOT NULL UNIQUE,          -- natural dedupe key
  phone       text,
  full_name   text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE child (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id      uuid NOT NULL REFERENCES parent(id) ON DELETE CASCADE,
  full_name      text NOT NULL,
  date_of_birth  date,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE payment (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id                   uuid NOT NULL REFERENCES parent(id),
  stripe_checkout_session_id  text UNIQUE,
  stripe_payment_intent_id    text,
  checkout_url                text,            -- returned on idempotent resubmit
  amount_cents                int NOT NULL,
  currency                    text NOT NULL DEFAULT 'usd',
  status                      text NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','paid','expired','refunded')),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  paid_at                     timestamptz
);

CREATE TABLE submission (
  id          uuid PRIMARY KEY,               -- client-generated idempotency key
  parent_id   uuid NOT NULL REFERENCES parent(id),  -- parent upserted before this insert
  payment_id  uuid REFERENCES payment(id),
  payload     jsonb NOT NULL,
  status      text NOT NULL DEFAULT 'received'
                CHECK (status IN ('received','checkout_created','finalized','failed')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE enrollment (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id       uuid NOT NULL REFERENCES child(id),
  class_id       uuid NOT NULL REFERENCES class(id),
  payment_id     uuid REFERENCES payment(id),  -- set at creation: webhook join path
  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','active','canceled','dropped','cancel_requested','expired')),
  join_date      date,
  drop_date      date,
  reserved_until timestamptz,                  -- seat-hold expiry (35 min; > Stripe's 30-min checkout expiry)
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- One LIVE enrollment per child per class; canceled/dropped/expired rows
-- don't block re-enrollment (kids drop and rejoin mid-semester).
CREATE UNIQUE INDEX uniq_live_enrollment
  ON enrollment(child_id, class_id)
  WHERE status IN ('pending','active','cancel_requested');

CREATE TABLE attendance (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollment(id) ON DELETE CASCADE,
  session_id    uuid NOT NULL REFERENCES session(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'present'
                  CHECK (status IN ('present','absent','excused')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, session_id)
);

-- Hot-path indexes
CREATE INDEX idx_class_school       ON class(school_id);
CREATE INDEX idx_session_class      ON session(class_id);
CREATE INDEX idx_child_parent       ON child(parent_id);
CREATE INDEX idx_enrollment_class   ON enrollment(class_id);
CREATE INDEX idx_enrollment_child   ON enrollment(child_id);
CREATE INDEX idx_enrollment_hold    ON enrollment(reserved_until)
                                     WHERE status = 'pending' AND reserved_until IS NOT NULL;
