import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  adminCookieOptions,
  adminCookieValue,
  adminSecret,
  secretsMatch,
} from '@/lib/adminAuth';

export async function POST(req: NextRequest) {
  const secret = adminSecret();
  const body = await req.json().catch(() => null);
  const code = typeof body?.code === 'string' ? body.code.trim() : '';

  if (!secret || !code || !secretsMatch(code, secret)) {
    return NextResponse.json({ error: 'Wrong code' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, adminCookieValue(secret), adminCookieOptions());
  return res;
}
