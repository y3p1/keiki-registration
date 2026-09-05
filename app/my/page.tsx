import { pool } from '@/db/pool';
import { getParentEmail } from '@/lib/auth';
import { loginParent, logoutParent, doRequestCancel } from '../actions';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending payment',
  active: 'Active',
  cancel_requested: 'Cancellation requested',
  canceled: 'Canceled',
  dropped: 'Dropped',
  expired: 'Expired (unpaid)',
};

export default async function MyPage() {
  const email = await getParentEmail();

  if (!email) {
    return (
      <main style={{ fontFamily: 'system-ui', maxWidth: 560, margin: '3rem auto', padding: '0 1rem' }}>
        <h1>My Registrations</h1>
        <p><a href="/">← Home</a></p>
        <p>Enter the email you registered with:</p>
        <form action={loginParent}>
          <input name="email" type="email" placeholder="you@example.com" required style={{ padding: 8, width: '100%', margin: '8px 0' }} />
          <button type="submit" style={{ padding: '8px 14px' }}>View my registrations</button>
        </form>
        <p style={{ color: '#888', fontSize: 13 }}>Demo auth: email-only lookup (no password). Real accounts are a v2 item.</p>
      </main>
    );
  }

  const { rows } = await pool.query<{ id: string; status: string; child: string; class: string; start_date: string }>(
    `SELECT e.id, e.status, ch.full_name AS child, c.title AS class, c.start_date::text AS start_date
       FROM enrollment e
       JOIN child ch ON ch.id = e.child_id
       JOIN class c  ON c.id = e.class_id
       JOIN parent p ON p.id = ch.parent_id
      WHERE p.email = $1
      ORDER BY e.created_at DESC`,
    [email],
  );

  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 720, margin: '3rem auto', padding: '0 1rem' }}>
      <h1>My Registrations</h1>
      <p><a href="/">← Home</a> · <a href="/register">Register another</a> · signed in as <strong>{email}</strong>{' '}
        <form action={logoutParent} style={{ display: 'inline' }}><button style={{ padding: '2px 8px' }}>sign out</button></form>
      </p>

      {rows.length === 0 && <p>No registrations yet. <a href="/register">Register now.</a></p>}

      {rows.map((r) => (
        <div key={r.id} style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>{r.child}</strong> — {r.class}<br />
            <small>Starts {r.start_date} · <em>{STATUS_LABEL[r.status] ?? r.status}</em></small>
          </div>
          {r.status === 'active' && (
            <form action={doRequestCancel}>
              <input type="hidden" name="id" value={r.id} />
              <button type="submit" style={{ padding: '6px 10px' }}>Request cancellation</button>
            </form>
          )}
        </div>
      ))}
    </main>
  );
}
