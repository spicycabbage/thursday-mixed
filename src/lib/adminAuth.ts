import { createHash, createHmac, timingSafeEqual } from 'crypto';

export const ADMIN_COOKIE = 'tm_admin';

export function adminSecret() {
  const secret = process.env.TOURNAMENT_ADMIN_SECRET?.trim();
  return secret || null;
}

function digest(value: string) {
  return createHash('sha256').update(value).digest();
}

export function secretsMatch(input: string, secret: string) {
  return timingSafeEqual(digest(input), digest(secret));
}

export function adminCookieValue(secret: string) {
  return createHmac('sha256', secret).update('tm-admin-v1').digest('base64url');
}

export function hasAdminCookie(cookieValue: string | undefined, secret: string) {
  if (!cookieValue) return false;
  return timingSafeEqual(digest(cookieValue), digest(adminCookieValue(secret)));
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 400,
  };
}
