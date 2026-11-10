import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { join } from 'node:path';
import { Redis } from '@upstash/redis';
import { changeShow, createShow, restoreShow } from './show.mjs';
import type { Action, Show } from './show.mjs';
import { passwordRequired, readCookie, sessionCookie, sessionMatches } from './session';

const directory = join(process.cwd(), '.zongyi');
const filename = join(directory, 'show.json');
const showKey = 'show';
const channel = 'zongyi:show:updated';
const local = globalThis as typeof globalThis & { zongyiShowEvents?: EventEmitter };
const localEvents = local.zongyiShowEvents ??= new EventEmitter();

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
redis.call('PUBLISH', ARGV[3], ARGV[4])
return 1
`;

function redisConfig() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url && !token) return null;
  if (!url || !token) throw new Error('Redis 配置不完整');
  return { url, token };
}

function database() {
  const config = redisConfig();
  return config ? new Redis(config) : null;
}

export async function watchShow(signal: AbortSignal, refresh: (revision?: number) => void) {
  const config = redisConfig();
  if (signal.aborted) return;
  if (!config) {
    localEvents.on('update', refresh);
    signal.addEventListener('abort', () => localEvents.off('update', refresh), { once: true });
    refresh();
    return;
  }

  // Read the subscription directly so an upstream EOF closes the browser stream too.
  const response = await fetch(new URL('/subscribe/' + encodeURIComponent(channel), config.url), {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + config.token, Accept: 'text/event-stream' },
    cache: 'no-store',
    signal,
  });
  if (!response.ok || !response.body) throw new Error('无法订阅场次更新');
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let subscribed = false;
  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = (buffer + value).split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const [kind, topic, value] = line.slice(5).trim().split(',');
        if (topic !== channel) continue;
        if (kind === 'subscribe' && !subscribed) {
          subscribed = true;
          refresh();
        }
        if (kind === 'message' && subscribed && /^\d+$/.test(value)) refresh(Number(value));
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  if (!signal.aborted) throw new Error('场次订阅已断开');
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

async function readRemote(redis: Redis, primary = false): Promise<Show> {
  // Upstash routes EVAL to the primary. A replica can miss a write made while SSE was disconnected.
  const read = () => primary
    ? redis.eval<never[], Show | string | null>("return redis.call('GET', KEYS[1])", [showKey], [])
    : redis.get<Show>(showKey);
  const saved = await read();
  if (saved) return asShow(saved);
  const created = createShow();
  if (await redis.setnx(showKey, created) === 1) return created;
  return asShow(await read());
}

export async function readShow(): Promise<Show> {
  const redis = database();
  return redis ? readRemote(redis) : readShowFile();
}

export async function readLiveShow(): Promise<Show> {
  const redis = database();
  return redis ? readRemote(redis, true) : readShowFile();
}

export async function updateShow(action: Action): Promise<Show> {
  const redis = database();
  if (!redis) {
    const next = changeShow(readShowFile(), action);
    saveShowFile(next);
    localEvents.emit('update', next.revision);
    return next;
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = await readRemote(redis, true);
    const next = changeShow(current, action);
    const written = await redis.eval<string[], number>(
      compareAndSet, [showKey], [String(current.revision), JSON.stringify(next), channel, String(next.revision)],
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
