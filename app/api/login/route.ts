import { NextResponse } from 'next/server';
import { passwordMatches, passwordRequired, sessionCookie, sessionToken } from '../../../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!passwordRequired()) return NextResponse.json({ error: '未设置口令' }, { status: 404 });
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  let sameSite = false;
  try {
    sameSite = Boolean(origin && host && new URL(origin).host === host);
  } catch { /* Reject a malformed origin. */ }
  if (!sameSite) return NextResponse.json({ error: '请从本站操作' }, { status: 403 });

  let password: unknown;
  try {
    password = (await request.json()).password;
  } catch {
    password = null;
  }
  if (!passwordMatches(password)) {
    return NextResponse.json({ error: '口令不正确' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set(sessionCookie, sessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: (request.headers.get('x-forwarded-proto') ?? new URL(request.url).protocol.replace(':', '')) === 'https',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
