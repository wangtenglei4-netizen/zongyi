import { createHash, timingSafeEqual } from 'node:crypto';

export const sessionCookie = 'zongyi_session';

export function passwordRequired() {
  return Boolean(process.env.SITE_PASSWORD);
}

export function sessionToken() {
  return createHash('sha256').update(`zongyi-session:${process.env.SITE_PASSWORD}`).digest('hex');
}

export function passwordMatches(input: unknown) {
  if (typeof input !== 'string' || !process.env.SITE_PASSWORD) return false;
  const expected = Buffer.from(process.env.SITE_PASSWORD);
  const actual = Buffer.from(input);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function sessionMatches(value: string | undefined | null) {
  if (!passwordRequired() || !value) return false;
  const expected = Buffer.from(sessionToken());
  const actual = Buffer.from(value);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function readCookie(header: string | null, name: string) {
  for (const part of (header ?? '').split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return '';
}

export function safeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
  return value;
}
