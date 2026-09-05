'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { pool } from '@/db/pool';
import { signValue, staffSecret, isStaff, getParentEmail, PARENT_COOKIE, STAFF_COOKIE } from '@/lib/auth';
import { requestCancellation, approveCancellation } from '@/lib/registration/cancellation';
import { cancelSession, rescheduleSession } from '@/lib/registration/session';

const cookieOpts = { httpOnly: true, sameSite: 'lax' as const, path: '/' };

export async function loginParent(formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  if (email) (await cookies()).set(PARENT_COOKIE, signValue(email), cookieOpts);
  redirect('/my');
}

export async function logoutParent() {
  (await cookies()).delete(PARENT_COOKIE);
  redirect('/my');
}

export async function loginStaff(formData: FormData) {
  const secret = String(formData.get('secret') || '');
  if (secret && secret === staffSecret()) {
    (await cookies()).set(STAFF_COOKIE, signValue('staff'), cookieOpts);
  }
  redirect('/staff');
}

// Parent requests cancellation of one of their own enrollments (ownership checked).
export async function doRequestCancel(formData: FormData) {
  const parentEmail = await getParentEmail();
  const id = String(formData.get('id'));
  if (parentEmail) {
    const owns = await pool.query(
      `SELECT 1 FROM enrollment e
         JOIN child ch ON ch.id = e.child_id
         JOIN parent p ON p.id = ch.parent_id
        WHERE e.id = $1 AND p.email = $2`,
      [id, parentEmail],
    );
    if (owns.rowCount) await requestCancellation(pool, id);
  }
  redirect('/my');
}

async function requireStaffOrRedirect() {
  if (!(await isStaff())) redirect('/staff');
}

export async function doApproveCancel(formData: FormData) {
  await requireStaffOrRedirect();
  await approveCancellation(pool, String(formData.get('id')));
  redirect('/staff');
}

export async function doCancelSession(formData: FormData) {
  await requireStaffOrRedirect();
  await cancelSession(pool, String(formData.get('id')), 'Canceled by staff');
  redirect('/staff');
}

export async function doRescheduleSession(formData: FormData) {
  await requireStaffOrRedirect();
  const id = String(formData.get('id'));
  const scheduledDate = String(formData.get('scheduledDate') || '');
  if (scheduledDate) await rescheduleSession(pool, id, { scheduledDate });
  redirect('/staff');
}
