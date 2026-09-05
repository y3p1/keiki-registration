import { SiteHeader } from './_components/SiteHeader';

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="kc-wrap" style={{ paddingTop: 40, paddingBottom: 72 }}>
        <div style={{ maxWidth: 640 }}>
          <span className="kc-eyebrow">Hawaii&apos;s #1 kids tech program</span>
          <h1 style={{ fontSize: 'clamp(2.6rem,6vw,4.5rem)', fontWeight: 700, margin: '18px 0' }}>
            Unlock <span className="kc-hl">&quot;a-ha&quot;</span><br />learning moments
          </h1>
          <p className="kc-muted" style={{ fontSize: 20, maxWidth: '40ch' }}>
            After-school coding &amp; sports for curious keiki. Register online, pay once, and you&apos;re set for the semester.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
            <a className="kc-btn" href="/register">Register for classes</a>
            <a className="kc-btn kc-btn--sec" href="/my">My registrations</a>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16, marginTop: 48 }}>
          <a className="kc-card kc-card--interactive" href="/register" style={{ display: 'block' }}>
            <strong className="kc-disp" style={{ fontSize: 18 }}>Register</strong>
            <p className="kc-muted" style={{ margin: '6px 0 0' }}>Sign kids up and pay in one go.</p>
          </a>
          <a className="kc-card kc-card--interactive" href="/my" style={{ display: 'block' }}>
            <strong className="kc-disp" style={{ fontSize: 18 }}>My registrations</strong>
            <p className="kc-muted" style={{ margin: '6px 0 0' }}>Check status, request a cancellation.</p>
          </a>
          <a className="kc-card kc-card--interactive" href="/staff" style={{ display: 'block' }}>
            <strong className="kc-disp" style={{ fontSize: 18 }}>Staff</strong>
            <p className="kc-muted" style={{ margin: '6px 0 0' }}>Approve cancellations, manage sessions.</p>
          </a>
        </div>
      </main>
    </>
  );
}
