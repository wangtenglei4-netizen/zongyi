import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { passwordRequired, safeNext, sessionCookie, sessionMatches } from './lib/session';

const backgroundMusic = new Set(['/shenfen_leader.mp3', '/mojing.mp3', '/banjiang.mp3']);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (backgroundMusic.has(pathname) || !passwordRequired()) return NextResponse.next();
  const signedIn = sessionMatches(request.cookies.get(sessionCookie)?.value);
  if (pathname === '/login') {
    if (!signedIn) return NextResponse.next();
    return NextResponse.redirect(new URL(safeNext(request.nextUrl.searchParams.get('next')), request.url));
  }
  if (signedIn) return NextResponse.next();
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: '请先输入口令' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  const login = new URL('/login', request.url);
  login.searchParams.set('next', pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/login).*)'],
};
