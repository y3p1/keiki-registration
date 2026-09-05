import { pool } from '@/db/pool';
import { getParentEmail } from '@/lib/auth';
import { loginParent, logoutParent, doRequestCancel } from '../actions';
import { SiteHeader } from '../_components/SiteHeader';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pending payment', cls: 'kc-pill--pending' },
  active: { label: 'Active', cls: 'kc-pill--active' },
  cancel_requested: { label: 'Cancellation requested', cls: 'kc-pill--requested' },
  canceled: { label: 'Canceled', cls: 'kc-pill--canceled' },
  dropped: { label: 'Dropped', cls: 'kc-pill--dropped' },
  expired: { label: 'Expired (unpaid)', cls: 'kc-pill--expired' },
};

export default async function MyPage() {
  const email = await getParentEmail();

  if (!email) {
    return (
      <>
        <SiteHeader />
        <main className="kc-main" style={{ maxWidth: 560 }}>
          <span className="kc-eyebrow">🐢 My registrations</span>
          <h1 style={{ fontSize: 'clamp(2rem,4vw,2.8rem)', fontWeight: 700, margin: '14px 0' }}>
            See your <span className="kc-hl">keiki</span>
          </h1>
          <p className="kc-muted" style={{ marginBottom: 16 }}>Enter the email you registered with.</p>
          <form action={loginParent} className="kc-card" style={{ maxWidth: 440 }}>
            <input name="email" type="email" placeholder="you@example.com" required className="kc-input" />
            <button type="submit" className="kc-btn" style={{ marginTop: 8 }}>View my registrations</button>
          </form>
          <p className="kc-muted" style={{ fontSize: 13, marginTop: 12 }}>Demo auth: email-only lookup (no password). Real accounts are a v2 item.</p>
        </main>
      </>
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
    <>
      <SiteHeader />
      <main className="kc-main" style={{ maxWidth: 760 }}>
        <div className="kc-row" style={{ flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 'clamp(1.8rem,3vw,2.4rem)', fontWeight: 700 }}>My Registrations</h1>
          <span className="kc-muted" style={{ fontSize: 14 }}>
            {email}{' '}
            <form action={logoutParent} style={{ display: 'inline' }}><button className="kc-btn kc-btn--sec kc-btn--sm">sign out</button></form>
          </span>
        </div>
        <p style={{ margin: '6px 0 20px' }}><a className="kc-link" href="/register">+ Register another child</a></p>

        {rows.length === 0 && <p className="kc-muted">No registrations yet. <a href="/register">Register now.</a></p>}

        <div style={{ display: 'grid', gap: 12 }}>
          {rows.map((r) => {
            const s = STATUS[r.status] ?? { label: r.status, cls: 'kc-pill--pending' };
            return (
              <div key={r.id} className="kc-card kc-row" style={{ padding: 18 }}>
                <div>
                  <strong className="kc-disp" style={{ fontSize: 18 }}>{r.child}</strong> — {r.class}<br />
                  <small className="kc-muted">Starts {r.start_date}</small>{' '}
                  <span className={`kc-pill ${s.cls}`}>{s.label}</span>
                </div>
                {r.status === 'active' && (
                  <form action={doRequestCancel}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="kc-btn kc-btn--sec kc-btn--sm">Request cancellation</button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </>
  );
}
