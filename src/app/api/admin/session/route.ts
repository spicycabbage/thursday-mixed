import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, adminSecret, hasAdminCookie } from '@/lib/adminAuth';

export async function GET(req: NextRequest) {
  const secret = adminSecret();
  const admin = !!secret && hasAdminCookie(req.cookies.get(ADMIN_COOKIE)?.value, secret);
  return NextResponse.json({ admin });
}
