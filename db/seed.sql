-- Idempotent seed: one school, two classes (one capacity 12 for the oversell demo),
-- plus materialized weekly sessions for each class. Fixed UUIDs so re-seeding is a no-op.

INSERT INTO school (id, name, address) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Kaimuki Elementary', '3240 Waialae Ave, Honolulu, HI')
ON CONFLICT (id) DO NOTHING;

INSERT INTO class
  (id, school_id, title, day_of_week, start_time, end_time, start_date, weeks, capacity, price_cents) VALUES
  ('22222222-2222-2222-2222-222222222222',
   '11111111-1111-1111-1111-111111111111',
   'Intro to Coding — Tuesdays', 2, '15:00', '16:00', '2026-09-08', 10, 12, 12000),
  ('33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111',
   'Flag Football — Thursdays', 4, '15:30', '16:30', '2026-09-10', 10, 20, 9000)
ON CONFLICT (id) DO NOTHING;

-- Materialize weeks worth of sessions per class (Week N = start_date + (N-1) weeks).
INSERT INTO session (class_id, week_number, scheduled_date)
SELECT c.id,
       gs AS week_number,
       (c.start_date + ((gs - 1) * 7))::date AS scheduled_date
FROM class c
CROSS JOIN generate_series(1, c.weeks) AS gs
WHERE c.id IN (
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333'
)
ON CONFLICT (class_id, week_number) DO NOTHING;
