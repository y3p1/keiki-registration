import { NextResponse } from 'next/server';
import { z } from 'zod';
import { pool } from '@/db/pool';
import { cancelSession, rescheduleSession } from '@/lib/registration/session';

// Staff cancels or reschedules a single session. (Staff auth added in TASK-06.)
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('cancel'), note: z.string().nullish() }),
  z.object({
    action: z.literal('reschedule'),
    scheduledDate: z.string(),
    startTime: z.string().nullish(),
    endTime: z.string().nullish(),
    note: z.string().nullish(),
  }),
]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const outcome =
    parsed.data.action === 'cancel'
      ? await cancelSession(pool, id, parsed.data.note ?? undefined)
      : await rescheduleSession(pool, id, {
          scheduledDate: parsed.data.scheduledDate,
          startTime: parsed.data.startTime,
          endTime: parsed.data.endTime,
          note: parsed.data.note,
        });

  if (outcome === 'not_found') {
    return NextResponse.json({ error: 'session not found' }, { status: 404 });
  }
  return NextResponse.json({ status: parsed.data.action === 'cancel' ? 'canceled' : 'rescheduled' });
}
