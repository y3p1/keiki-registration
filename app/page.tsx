export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 640, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>Keiki Coders Registration</h1>
      <p>After-school class registration with payment at signup.</p>
      <ul style={{ lineHeight: 2 }}>
        <li><a href="/register">Register for classes</a> — parents sign kids up and pay</li>
        <li><a href="/my">My registrations</a> — view status, request a cancellation</li>
        <li><a href="/staff">Staff</a> — approve cancellations, manage sessions</li>
      </ul>
    </main>
  );
}
