import { NextResponse } from 'next/server';
import { z } from 'zod';
import { pool } from '@/db/pool';
import { registerSubmission, RegisterError } from '@/lib/registration/register';
import { createStripeCheckout } from '@/lib/stripe';

const schema = z.object({
  submissionId: z.uuid(),
  parent: z.object({
    email: z.email(),
    fullName: z.string().min(1),
    phone: z.string().nullish(),
  }),
  children: z
    .array(
      z.object({
        fullName: z.string().min(1),
        dateOfBirth: z.string().nullish(),
        classIds: z.array(z.uuid()).min(1),
      }),
    )
    .min(1),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'validation failed', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await registerSubmission(pool, parsed.data, { createCheckout: createStripeCheckout });
    switch (result.status) {
      case 'created':
      case 'duplicate':
        return NextResponse.json({ status: result.status, checkoutUrl: result.checkoutUrl }, { status: 200 });
      case 'already_registered':
        return NextResponse.json({ status: result.status }, { status: 200 });
      case 'processing':
        return NextResponse.json({ status: result.status }, { status: 202 });
      case 'full':
        return NextResponse.json(
          { error: 'class full', classId: result.classId, classTitle: result.classTitle },
          { status: 409 },
        );
    }
  } catch (err) {
    if (err instanceof RegisterError) {
      const status = err.code === 'CLASS_NOT_FOUND' ? 404 : err.code === 'CLASS_CLOSED' ? 409 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    console.error('register failed', err);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
