import { SiteHeader } from '../_components/SiteHeader';

// Post-payment landing. Does NOT finalize anything — the Stripe webhook is the
// source of truth. This page just reassures the parent while the webhook lands.
export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="kc-main" style={{ maxWidth: 620 }}>
        <div className="kc-card" style={{ textAlign: 'center', padding: 40 }}>
          <span className="kc-eyebrow">Payment received</span>
          <h1 style={{ fontSize: 'clamp(2rem,4vw,2.8rem)', fontWeight: 700, margin: '16px 0' }}>
            You&apos;re <span className="kc-hl">in!</span>
          </h1>
          <p className="kc-muted">We&apos;re confirming your registration now. A confirmation email is on its way.</p>
          <p className="kc-muted">Your spot is secured. Finalization happens server-side, so you can safely close this page.</p>
          {session_id && <p style={{ color: 'var(--kc-muted)', fontSize: 12, marginTop: 8 }}>Ref: {session_id}</p>}
          <p style={{ marginTop: 20 }}><a className="kc-btn" href="/my">View my registrations</a></p>
        </div>
      </main>
    </>
  );
}
