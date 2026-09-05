import type { Pool } from 'pg';

// Best-effort confirmation notification. Gathers the finalized registration and
// POSTs it to the n8n webhook, which sends the parent's confirmation email.
//
// Deliberately fire-and-forget and fail-soft: n8n is a side effect, not part of
// the transactional guarantee. If N8N_WEBHOOK_URL is unset (n8n not wired yet)
// or the POST fails, finalization still stands — we just log it.
export async function notifyConfirmation(pool: Pool, checkoutSessionId: string): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) {
    console.log('[notify] N8N_WEBHOOK_URL unset — skipping confirmation email');
    return;
  }

  const { rows } = await pool.query<{
    parent_name: string;
    parent_email: string;
    amount_cents: number;
    currency: string;
    items: { child: string; class: string }[];
  }>(
    `SELECT p.full_name AS parent_name,
            p.email     AS parent_email,
            pay.amount_cents,
            pay.currency,
            json_agg(json_build_object('child', ch.full_name, 'class', c.title)) AS items
       FROM payment pay
       JOIN parent p       ON p.id = pay.parent_id
       JOIN enrollment e   ON e.payment_id = pay.id AND e.status = 'active'
       JOIN child ch       ON ch.id = e.child_id
       JOIN class c        ON c.id = e.class_id
      WHERE pay.stripe_checkout_session_id = $1
      GROUP BY p.full_name, p.email, pay.amount_cents, pay.currency`,
    [checkoutSessionId],
  );

  const payload = rows[0];
  if (!payload) {
    console.log('[notify] no active registration for session — skipping');
    return;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.warn(`[notify] n8n returned ${res.status}`);
  } catch (err) {
    console.warn('[notify] n8n POST failed:', err);
  }
}
