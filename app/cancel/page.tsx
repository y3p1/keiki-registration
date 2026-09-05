import { SiteHeader } from '../_components/SiteHeader';

// Stripe "cancel" redirect — the parent backed out of payment. Their seat hold
// simply expires (lazy release); nothing to clean up here.
export default function CancelPage() {
  return (
    <>
      <SiteHeader />
      <main className="kc-main" style={{ maxWidth: 620 }}>
        <div className="kc-card" style={{ textAlign: 'center', padding: 40 }}>
          <span className="kc-eyebrow">Checkout canceled</span>
          <h1 style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)', fontWeight: 700, margin: '16px 0' }}>No worries</h1>
          <p className="kc-muted">No payment was taken. Your seats weren&apos;t confirmed — the temporary hold will expire on its own.</p>
          <p style={{ marginTop: 20 }}><a className="kc-btn" href="/register">← Back to registration</a></p>
        </div>
      </main>
    </>
  );
}
