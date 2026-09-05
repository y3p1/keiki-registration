'use client';

import { useEffect, useState } from 'react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface ClassRow {
  id: string;
  title: string;
  school: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  weeks: number;
  price_cents: number;
  currency: string;
  seats_left: number;
}

interface ChildForm {
  fullName: string;
  dateOfBirth: string;
  classIds: string[];
}

const box: React.CSSProperties = { border: '1px solid #ccc', borderRadius: 8, padding: 16, marginBottom: 16 };

export default function RegisterPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [parent, setParent] = useState({ email: '', fullName: '', phone: '' });
  const [children, setChildren] = useState<ChildForm[]>([{ fullName: '', dateOfBirth: '', classIds: [] }]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/classes')
      .then((r) => r.json())
      .then((d) => setClasses(d.classes ?? []))
      .catch(() => setError('Could not load classes'));
  }, []);

  function setChild(i: number, patch: Partial<ChildForm>) {
    setChildren((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function toggleClass(i: number, classId: string) {
    setChildren((cs) =>
      cs.map((c, idx) => {
        if (idx !== i) return c;
        const has = c.classIds.includes(classId);
        return { ...c, classIds: has ? c.classIds.filter((x) => x !== classId) : [...c.classIds, classId] };
      }),
    );
  }

  const money = (cents: number, cur: string) => `${(cents / 100).toFixed(2)} ${cur.toUpperCase()}`;
  const total = children.reduce(
    (sum, ch) => sum + ch.classIds.reduce((s, id) => s + (classes.find((c) => c.id === id)?.price_cents ?? 0), 0),
    0,
  );

  async function submit() {
    setError(null);
    if (!parent.email || !parent.fullName) return setError('Parent name and email are required.');
    if (children.every((c) => c.classIds.length === 0)) return setError('Select at least one class for a child.');
    if (children.some((c) => c.classIds.length > 0 && !c.fullName)) return setError('Each enrolled child needs a name.');

    setSubmitting(true);
    try {
      const payload = {
        submissionId: crypto.randomUUID(), // idempotency key — generated once per form
        parent: { email: parent.email, fullName: parent.fullName, phone: parent.phone || null },
        children: children.filter((c) => c.classIds.length > 0),
      };
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl; // to Stripe Checkout
        return;
      }
      if (res.status === 409 && data.classTitle) setError(`Sorry — "${data.classTitle}" is full.`);
      else setError(data.error ? `${data.error}` : 'Registration failed.');
    } catch {
      setError('Network error.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 720, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>Register for Classes</h1>
      <p><a href="/">← Home</a> · <a href="/my">My registrations</a></p>

      <section style={box}>
        <h2>Parent</h2>
        <input placeholder="Full name" value={parent.fullName} onChange={(e) => setParent({ ...parent, fullName: e.target.value })} style={{ display: 'block', width: '100%', margin: '6px 0', padding: 8 }} />
        <input placeholder="Email" type="email" value={parent.email} onChange={(e) => setParent({ ...parent, email: e.target.value })} style={{ display: 'block', width: '100%', margin: '6px 0', padding: 8 }} />
        <input placeholder="Phone (optional)" value={parent.phone} onChange={(e) => setParent({ ...parent, phone: e.target.value })} style={{ display: 'block', width: '100%', margin: '6px 0', padding: 8 }} />
      </section>

      {children.map((child, i) => (
        <section key={i} style={box}>
          <h2>Child {i + 1}</h2>
          <input placeholder="Child full name" value={child.fullName} onChange={(e) => setChild(i, { fullName: e.target.value })} style={{ display: 'block', width: '100%', margin: '6px 0', padding: 8 }} />
          <input type="date" value={child.dateOfBirth} onChange={(e) => setChild(i, { dateOfBirth: e.target.value })} style={{ display: 'block', margin: '6px 0', padding: 8 }} />
          <p style={{ marginBottom: 4, fontWeight: 600 }}>Classes</p>
          {classes.map((c) => (
            <label key={c.id} style={{ display: 'block', margin: '4px 0', opacity: c.seats_left > 0 ? 1 : 0.5 }}>
              <input type="checkbox" disabled={c.seats_left <= 0} checked={child.classIds.includes(c.id)} onChange={() => toggleClass(i, c.id)} />{' '}
              {c.title} — {c.school} · {DAYS[c.day_of_week]} {c.start_time}–{c.end_time} · {c.weeks} wks · {money(c.price_cents, c.currency)}{' '}
              <em>({c.seats_left > 0 ? `${c.seats_left} seats left` : 'FULL'})</em>
            </label>
          ))}
        </section>
      ))}

      <button onClick={() => setChildren((cs) => [...cs, { fullName: '', dateOfBirth: '', classIds: [] }])} style={{ padding: '6px 12px', marginBottom: 16 }}>
        + Add another child
      </button>

      <div style={{ ...box, background: '#f6f6f6' }}>
        <strong>Total: {money(total, classes[0]?.currency ?? 'usd')}</strong>
        <button onClick={submit} disabled={submitting} style={{ display: 'block', marginTop: 12, padding: '10px 16px', fontSize: 16, cursor: 'pointer' }}>
          {submitting ? 'Redirecting to payment…' : 'Register & Pay'}
        </button>
        {error && <p style={{ color: 'crimson', marginTop: 8 }}>{error}</p>}
      </div>
    </main>
  );
}
