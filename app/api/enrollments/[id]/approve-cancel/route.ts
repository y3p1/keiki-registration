import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { approveCancellation } from '@/lib/registration/cancellation';

// Staff approves a cancellation request → seat released. (Staff auth added in TASK-06.)
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const outcome = await approveCancellation(pool, id);
  if (outcome === 'not_requested') {
    return NextResponse.json({ error: 'no pending cancellation request' }, { status: 409 });
  }
  return NextResponse.json({ status: 'canceled' });
}
