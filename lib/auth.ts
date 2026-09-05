import crypto from 'node:crypto';
import { cookies } from 'next/headers';

// Minimal v1 auth (documented as a demo-grade shortcut; real accounts are v2).
// Parent identity = a signed cookie holding their email (no password flow).
// Staff = a signed cookie set after entering the shared STAFF_SECRET.
// Cookies are HMAC-signed so they can't be forged client-side.

const secret = process.env.SESSION_SECRET || 'dev-insecure-secret-change-me';

export function signValue(value: string): string {
  const sig = crypto.createHmac('sha256', secret).update(value).digest('base64url');
  return `${Buffer.from(value).toString('base64url')}.${sig}`;
}

export function unsign(token: string | undefined): string | null {
  if (!token) return null;
  const [b64, sig] = token.split('.');
  if (!b64 || !sig) return null;
  const value = Buffer.from(b64, 'base64url').toString();
  const expected = crypto.createHmac('sha256', secret).update(value).digest('base64url');
  try {
    if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return value;
  } catch {
    /* length mismatch -> invalid */
  }
  return null;
}

export const PARENT_COOKIE = 'kc_parent';
export const STAFF_COOKIE = 'kc_staff';

export async function getParentEmail(): Promise<string | null> {
  const token = (await cookies()).get(PARENT_COOKIE)?.value;
  return unsign(token);
}

export async function isStaff(): Promise<boolean> {
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  return unsign(token) === 'staff';
}

export function staffSecret(): string {
  return process.env.STAFF_SECRET || 'staff-demo';
}
