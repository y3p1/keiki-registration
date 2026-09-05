import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { pool } from '@/db/pool';
import { finalizeCheckout, expireCheckout } from '@/lib/registration/finalize';
import { notifyConfirmation } from '@/lib/notify';

export const runtime = 'nodejs'; // pg + raw body require the Node runtime

// Stripe webhook — the source of truth for finalizing registrations.
// The raw request body is required for signature verification, so we read
// req.text() (route handlers don't pre-parse the body).
export async function POST(req: Request) {
  const signature = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return NextResponse.json({ error: 'missing signature or secret' }, { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    console.warn('[webhook] signature verification failed:', err);
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const result = await finalizeCheckout(
          pool,
          session.id,
          typeof session.payment_intent === 'string' ? session.payment_intent : null,
        );
        console.log(`[webhook] completed ${session.id} -> ${result.outcome}`);
        // Send confirmation only on a fresh finalize (not on webhook replays).
        if (result.outcome === 'finalized') {
          await notifyConfirmation(pool, session.id);
        }
        break;
      }
      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        const result = await expireCheckout(pool, session.id);
        console.log(`[webhook] expired ${session.id} -> ${result.outcome}`);
        break;
      }
      default:
        // Acknowledge unhandled event types so Stripe stops retrying them.
        break;
    }
  } catch (err) {
    console.error('[webhook] handler error:', err);
    // 500 tells Stripe to retry — finalization is idempotent, so retries are safe.
    return NextResponse.json({ error: 'handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
