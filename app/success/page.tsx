// Post-payment landing. Does NOT finalize anything — the Stripe webhook is the
// source of truth. This page just reassures the parent while the webhook lands.
export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 560, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>Payment received 🎉</h1>
      <p>Thanks! We're confirming your registration now — you'll get a confirmation email shortly.</p>
      <p>Your spot is secured; finalization happens server-side via Stripe, so you can safely close this page.</p>
      {session_id && <p style={{ color: '#888', fontSize: 12 }}>Ref: {session_id}</p>}
      <p><a href="/my">View my registrations →</a></p>
    </main>
  );
}
