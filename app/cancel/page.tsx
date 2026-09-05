// Stripe "cancel" redirect — the parent backed out of payment. Their seat hold
// simply expires (lazy release); nothing to clean up here.
export default function CancelPage() {
  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 560, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>Checkout canceled</h1>
      <p>No payment was taken. Your seats weren't confirmed — the temporary hold will expire on its own.</p>
      <p><a href="/register">← Back to registration</a></p>
    </main>
  );
}
