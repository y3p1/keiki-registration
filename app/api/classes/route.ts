import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';

// Open classes with seats remaining — feeds the registration form.
export async function GET() {
  const { rows } = await pool.query(
    `SELECT c.id, c.title, c.day_of_week, c.start_time, c.end_time, c.start_date,
            c.weeks, c.price_cents, c.currency, c.capacity, c.seats_taken,
            (c.capacity - c.seats_taken) AS seats_left, s.name AS school
       FROM class c
       JOIN school s ON s.id = c.school_id
      WHERE c.status = 'open'
      ORDER BY c.start_date, c.title`,
  );
  return NextResponse.json({ classes: rows });
}
