import { pool } from '@/db/pool';
import { isStaff } from '@/lib/auth';
import { loginStaff, doApproveCancel, doCancelSession, doRescheduleSession } from '../actions';
import { SiteHeader } from '../_components/SiteHeader';

export const dynamic = 'force-dynamic';

const SESSION_PILL: Record<string, string> = {
  scheduled: 'kc-pill--active',
  canceled: 'kc-pill--canceled',
  rescheduled: 'kc-pill--requested',
};

export default async function StaffPage() {
  if (!(await isStaff())) {
    return (
      <>
        <SiteHeader />
        <main className="kc-main" style={{ maxWidth: 480 }}>
          <span className="kc-eyebrow">🐢 Staff console</span>
          <h1 style={{ fontSize: 'clamp(2rem,4vw,2.6rem)', fontWeight: 700, margin: '14px 0' }}>Staff <span className="kc-hl">sign-in</span></h1>
          <form action={loginStaff} className="kc-card" style={{ maxWidth: 420 }}>
            <input name="secret" type="password" placeholder="Staff secret" required className="kc-input" />
            <button type="submit" className="kc-btn" style={{ marginTop: 8 }}>Enter</button>
          </form>
          <p className="kc-muted" style={{ fontSize: 13, marginTop: 12 }}>Demo gate: shared secret (STAFF_SECRET). Real roles are a v2 item.</p>
        </main>
      </>
    );
  }

  const pending = await pool.query<{ id: string; child: string; class: string }>(
    `SELECT e.id, ch.full_name AS child, c.title AS class
       FROM enrollment e JOIN child ch ON ch.id = e.child_id JOIN class c ON c.id = e.class_id
      WHERE e.status = 'cancel_requested' ORDER BY e.created_at`,
  );
  const sessions = await pool.query<{ id: string; title: string; week_number: number; d: string; status: string }>(
    `SELECT s.id, c.title, s.week_number, s.scheduled_date::text AS d, s.status
       FROM session s JOIN class c ON c.id = s.class_id ORDER BY s.scheduled_date, c.title LIMIT 40`,
  );

  return (
    <>
      <SiteHeader />
      <main className="kc-main" style={{ maxWidth: 900 }}>
        <span className="kc-eyebrow">🐢 Staff console</span>
        <h1 style={{ fontSize: 'clamp(1.8rem,3vw,2.4rem)', fontWeight: 700, margin: '12px 0 24px' }}>Operations</h1>

        <section className="kc-card" style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Pending cancellation requests</h2>
          {pending.rows.length === 0 && <p className="kc-muted">Nothing waiting. 🎉</p>}
          <div style={{ display: 'grid', gap: 8 }}>
            {pending.rows.map((r) => (
              <div key={r.id} className="kc-row kc-card kc-card--tint" style={{ padding: 12 }}>
                <span><strong style={{ fontWeight: 600 }}>{r.child}</strong> — {r.class}</span>
                <form action={doApproveCancel}>
                  <input type="hidden" name="id" value={r.id} />
                  <button type="submit" className="kc-btn kc-btn--sm">Approve &amp; release seat</button>
                </form>
              </div>
            ))}
          </div>
        </section>

        <section className="kc-card">
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>Sessions</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="kc-table">
              <thead><tr><th>Class</th><th>Week</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {sessions.rows.map((s) => (
                  <tr key={s.id}>
                    <td>{s.title}</td>
                    <td>{s.week_number}</td>
                    <td>{s.d}</td>
                    <td><span className={`kc-pill ${SESSION_PILL[s.status] ?? 'kc-pill--pending'}`}>{s.status}</span></td>
                    <td>
                      {s.status === 'scheduled' && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <form action={doCancelSession}>
                            <input type="hidden" name="id" value={s.id} />
                            <button type="submit" className="kc-btn kc-btn--sec kc-btn--sm">Cancel</button>
                          </form>
                          <form action={doRescheduleSession} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <input type="hidden" name="id" value={s.id} />
                            <input name="scheduledDate" type="date" required className="kc-input" style={{ margin: 0, padding: '6px 8px', width: 150 }} />
                            <button type="submit" className="kc-btn kc-btn--sm">Reschedule</button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
