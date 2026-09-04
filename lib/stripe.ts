import Stripe from 'stripe';
import type { CheckoutParams } from './registration/register';

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  // Not thrown at import so tests that inject a fake checkout creator don't need the key.
  console.warn('STRIPE_SECRET_KEY not set — real checkout creation will fail until configured.');
}

export const stripe = new Stripe(key ?? 'sk_test_missing');

// Real Stripe Checkout Session creator. One session funds the whole submission
// (multiple child+class line items). expires_at is 31 min — under the 35-min
// seat hold, so a slow payer can never pay into a released seat.
export async function createStripeCheckout(
  params: CheckoutParams,
): Promise<{ id: string; url: string }> {
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: params.lineItems.map((li) => ({
      quantity: li.quantity,
      price_data: {
        currency: params.currency,
        unit_amount: li.amountCents,
        product_data: { name: li.name },
      },
    })),
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
    metadata: {
      submission_id: params.submissionId,
      payment_id: params.paymentId,
    },
    payment_intent_data: {
      metadata: {
        submission_id: params.submissionId,
        payment_id: params.paymentId,
      },
    },
  });
  if (!session.url) throw new Error('Stripe did not return a checkout URL');
  return { id: session.id, url: session.url };
}
