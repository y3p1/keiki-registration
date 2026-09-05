import { pool } from '@/db/pool';
import { isStaff } from '@/lib/auth';
import { loginStaff, doApproveCancel, doCancelSession, doRescheduleSession } from '../actions';

export const dynamic = 'force-dynamic';

export default async function StaffPage() {
  if (!(await isStaff())) {
    return (
      <main style={{ fontFamily: 'system-ui', maxWidth: 480, margin: '3rem auto', padding: '0 1rem' }}>
        <h1>Staff</h1>
        <p><a href="/">← Home</a></p>
        <form action={loginStaff}>
          <input name="secret" type="password" placeholder="Staff secret" required style={{ padding: 8, width: '100%', margin: '8px 0' }} />
          <button type="submit" style={{ padding: '8px 14px' }}>Enter</button>
        </form>
        <p style={{ color: '#888', fontSize: 13 }}>Demo gate: shared secret (STAFF_SECRET). Real roles are a v2 item.</p>
      </main>
    );
  }

  const pending = await pool.query<{ id: string; child: string; class: string }>(
    `SELECT e.id, ch.full_name AS child, c.title AS class
       FROM enrollment e
       JOIN child ch ON ch.id = e.child_id
       JOIN class c  ON c.id = e.class_id
      WHERE e.status = 'cancel_requested'
      ORDER BY e.created_at`,
  );

  const sessions = await pool.query<{ id: string; title: string; week_number: number; d: string; status: string }>(
    `SELECT s.id, c.title, s.week_number, s.scheduled_date::text AS d, s.status
       FROM session s JOIN class c ON c.id = s.class_id
      ORDER BY s.scheduled_date, c.title
      LIMIT 40`,
  );

  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 820, margin: '3rem auto', padding: '0 1rem' }}>
      <h1>Staff</h1>
      <p><a href="/">← Home</a></p>

      <h2>Pending cancellation requests</h2>
      {pending.rows.length === 0 && <p>None.</p>}
      {pending.rows.map((r) => (
        <div key={r.id} style={{ border: '1px solid #ccc', borderRadius: 8, padding: 10, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
          <span>{r.child} — {r.class}</span>
          <form action={doApproveCancel}>
            <input type="hidden" name="id" value={r.id} />
            <button type="submit" style={{ padding: '4px 10px' }}>Approve (release seat)</button>
          </form>
        </div>
      ))}

      <h2 style={{ marginTop: 24 }}>Sessions</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}><th>Class</th><th>Week</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          {sessions.rows.map((s) => (
            <tr key={s.id} style={{ borderBottom: '1px solid #eee' }}>
              <td>{s.title}</td>
              <td>{s.week_number}</td>
              <td>{s.d}</td>
              <td>{s.status}</td>
              <td style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 0' }}>
                {s.status === 'scheduled' && (
                  <>
                    <form action={doCancelSession}>
                      <input type="hidden" name="id" value={s.id} />
                      <button type="submit" style={{ padding: '2px 8px' }}>Cancel</button>
                    </form>
                    <form action={doRescheduleSession} style={{ display: 'flex', gap: 4 }}>
                      <input type="hidden" name="id" value={s.id} />
                      <input name="scheduledDate" type="date" required style={{ padding: 2 }} />
                      <button type="submit" style={{ padding: '2px 8px' }}>Reschedule</button>
                    </form>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
