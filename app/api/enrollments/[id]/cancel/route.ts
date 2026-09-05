import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { requestCancellation } from '@/lib/registration/cancellation';

// Parent requests cancellation of an active enrollment. (Auth added in TASK-06.)
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const outcome = await requestCancellation(pool, id);
  if (outcome === 'not_active') {
    return NextResponse.json({ error: 'enrollment is not active' }, { status: 409 });
  }
  return NextResponse.json({ status: 'cancel_requested' });
}
