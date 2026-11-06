import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Redis } from '@upstash/redis';
import { changeShow, createShow, restoreShow } from './show.mjs';
import type { Action, Show } from './show.mjs';
import { passwordRequired, readCookie, sessionCookie, sessionMatches } from './session';

const directory = join(process.cwd(), '.zongyi');
const filename = join(directory, 'show.json');
const showKey = 'show';

const compareAndSet = `
local raw = redis.call('GET', KEYS[1])
if not raw then
  return 0
end
local ok, data = pcall(cjson.decode, raw)
if not ok or tostring(data['revision']) ~= ARGV[1] then
  return 0
end
redis.call('SET', KEYS[1], ARGV[2])
return 1
`;

function database() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url && !token) return null;
  if (!url || !token) throw new Error('Redis 配置不完整');
  return new Redis({ url, token });
}

function saveShowFile(show: Show) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporary = filename + '.tmp';
  writeFileSync(temporary, JSON.stringify(show), { mode: 0o600 });
  renameSync(temporary, filename);
}

function readShowFile(): Show {
  try {
    return restoreShow(JSON.parse(readFileSync(filename, 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const show = createShow();
    saveShowFile(show);
    return show;
  }
}

function asShow(value: unknown): Show {
  return restoreShow(typeof value === 'string' ? JSON.parse(value) : value);
}

async function readRemote(redis: Redis): Promise<Show> {
  const saved = await redis.get<Show>(showKey);
  if (saved) return asShow(saved);
  const created = createShow();
  if (await redis.setnx(showKey, created) === 1) return created;
  return asShow(await redis.get<Show>(showKey));
}

export async function readShow(): Promise<Show> {
  const redis = database();
  return redis ? readRemote(redis) : readShowFile();
}

export async function updateShow(action: Action): Promise<Show> {
  const redis = database();
  if (!redis) {
    const next = changeShow(readShowFile(), action);
    saveShowFile(next);
    return next;
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await readRemote(redis);
    const next = changeShow(current, action);
    const written = await redis.eval<string[], number>(
      compareAndSet, [showKey], [String(current.revision), JSON.stringify(next)],
    );
    if (Number(written) === 1) return next;
  }
  throw new Error('场次正在更新，请重试');
}

export function localHost(request: Request) {
  return /^(?:localhost|127\.0\.0\.1)(?::[0-9]+)?$/i.test(request.headers.get('host') ?? '');
}

function sameSite(request: Request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function jsonContent(request: Request) {
  return request.headers.get('content-type')?.split(';')[0] === 'application/json';
}

export function localOrigin(request: Request) {
  return localHost(request) && request.headers.get('origin') === 'http://' + request.headers.get('host');
}

export function localMutation(request: Request) {
  return localOrigin(request) && jsonContent(request);
}

function signedIn(request: Request) {
  return sessionMatches(readCookie(request.headers.get('cookie'), sessionCookie));
}

export function authorizeRead(request: Request) {
  if (passwordRequired()) return signedIn(request) ? null : json({ error: '请先输入口令' }, 401);
  return localHost(request) ? null : json({ error: '请从本机访问' }, 403);
}

export function authorizeMutation(request: Request) {
  const denied = authorizeRead(request);
  if (denied) return denied;
  if (passwordRequired()) return sameSite(request) && jsonContent(request) ? null : json({ error: '请从本站操作' }, 403);
  return localMutation(request) ? null : json({ error: '请在本机导播台操作' }, 403);
}

export function authorizeWrite(request: Request) {
  const denied = authorizeRead(request);
  if (denied) return denied;
  if (passwordRequired()) return sameSite(request) ? null : json({ error: '请从本站操作' }, 403);
  return localOrigin(request) ? null : json({ error: '请在本机导播台操作' }, 403);
}

export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}
