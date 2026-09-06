'use client';

import { useEffect, useState } from 'react';
import { SiteHeader } from '../_components/SiteHeader';

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
  function removeChild(i: number) {
    setChildren((cs) => cs.filter((_, idx) => idx !== i));
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
      if (res.status === 409 && data.classTitle) setError(`Sorry, "${data.classTitle}" is full.`);
      else setError(data.error ? `${data.error}` : 'Registration failed.');
    } catch {
      setError('Network error.');
    } finally {
      setSubmitting(false);
    }
  }

  const currency = classes[0]?.currency ?? 'usd';

  return (
    <>
      <SiteHeader />
      <main className="kc-wrap" style={{ paddingTop: 24, paddingBottom: 72 }}>
        <div className="kc-split" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'start' }}>
          {/* Hero */}
          <div style={{ paddingTop: 12 }}>
            <span className="kc-eyebrow">Hawaii&apos;s #1 kids tech program</span>
            <h1 style={{ fontSize: 'clamp(2.4rem,4vw,3.4rem)', fontWeight: 700, margin: '18px 0' }}>
              Unlock <span className="kc-hl">&quot;a-ha&quot;</span><br />learning moments
            </h1>
            <p className="kc-muted" style={{ fontSize: 19, maxWidth: '32ch' }}>
              Sign your keiki up for after-school coding &amp; sports. Pick classes, pay once, and you&apos;re set for the semester.
            </p>
            <div style={{ display: 'flex', gap: 14, marginTop: 24, flexWrap: 'wrap' }}>
              <div className="kc-card" style={{ padding: '16px 20px' }}><strong className="kc-disp">10 weeks</strong><br /><small className="kc-muted">per class</small></div>
              <div className="kc-card" style={{ padding: '16px 20px', background: 'var(--kc-aquatint)', boxShadow: 'none' }}><strong className="kc-disp">Pay once</strong><br /><small className="kc-muted">secure with Stripe</small></div>
            </div>
          </div>

          {/* Form */}
          <div className="kc-card" style={{ padding: 30 }}>
            <p className="kc-label" id="parent-label">Parent</p>
            <input className="kc-input" placeholder="Full name" aria-label="Parent full name" value={parent.fullName} onChange={(e) => setParent({ ...parent, fullName: e.target.value })} />
            <input className="kc-input" placeholder="Email" aria-label="Parent email" type="email" value={parent.email} onChange={(e) => setParent({ ...parent, email: e.target.value })} />
            <input className="kc-input" placeholder="Phone (optional)" aria-label="Parent phone, optional" value={parent.phone} onChange={(e) => setParent({ ...parent, phone: e.target.value })} />

            {children.map((child, i) => (
              <div key={i} style={{ marginTop: 18 }}>
                <div className="kc-row" style={{ marginBottom: 2 }}>
                  <p className="kc-label" style={{ margin: 0 }}>Child {i + 1}</p>
                  {children.length > 1 && (
                    <button type="button" className="kc-btn kc-btn--sec kc-btn--sm" onClick={() => removeChild(i)} aria-label={`Remove child ${i + 1}`}>
                      Remove
                    </button>
                  )}
                </div>
                <input className="kc-input" placeholder="Child full name" aria-label={`Child ${i + 1} full name`} value={child.fullName} onChange={(e) => setChild(i, { fullName: e.target.value })} />
                <input className="kc-input" type="date" aria-label={`Child ${i + 1} date of birth`} value={child.dateOfBirth} onChange={(e) => setChild(i, { dateOfBirth: e.target.value })} style={{ maxWidth: 220 }} />
                <p style={{ margin: '10px 0 2px', fontWeight: 600 }}>Classes</p>
                {classes.map((c) => {
                  const on = child.classIds.includes(c.id);
                  const full = c.seats_left <= 0;
                  return (
                    <label key={c.id} className={`kc-classrow ${on ? 'kc-classrow--on' : ''}`} style={{ opacity: full ? 0.55 : 1 }}>
                      <input type="checkbox" disabled={full} checked={on} onChange={() => toggleClass(i, c.id)} />
                      <span>
                        <strong style={{ fontWeight: 600 }}>{c.title}</strong><br />
                        <small className="kc-muted">{c.school} · {DAYS[c.day_of_week]} {c.start_time.slice(0, 5)}-{c.end_time.slice(0, 5)} · {c.weeks} wks · {money(c.price_cents, c.currency)}</small><br />
                        <span className={full ? 'kc-seats kc-seats--full' : 'kc-seats'}>{full ? 'FULL' : `${c.seats_left} seats left`}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ))}

            <button type="button" className="kc-btn kc-btn--sec kc-btn--sm" style={{ marginTop: 12 }} onClick={() => setChildren((cs) => [...cs, { fullName: '', dateOfBirth: '', classIds: [] }])}>
              + Add another child
            </button>

            <div className="kc-total" style={{ marginTop: 18 }}>
              <strong>Total: {money(total, currency)}</strong>
              <button type="button" className="kc-btn" onClick={submit} disabled={submitting}>
                {submitting ? 'Redirecting…' : 'Register & Pay'}
              </button>
            </div>
            {error && <p style={{ color: 'var(--kc-danger)', marginTop: 10 }}>{error}</p>}
          </div>
        </div>
      </main>
    </>
  );
}
