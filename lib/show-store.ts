import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { changeShow, createShow, restoreShow } from './show.mjs';
import type { Action, Show } from './show.mjs';

const directory = join(process.cwd(), '.zongyi');
const filename = join(directory, 'show.json');

function saveShow(show: Show) {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const temporary = filename + '.tmp';
  writeFileSync(temporary, JSON.stringify(show), { mode: 0o600 });
  renameSync(temporary, filename);
}

export function readShow(): Show {
  try {
    return restoreShow(JSON.parse(readFileSync(filename, 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const show = createShow();
    saveShow(show);
    return show;
  }
}

export function updateShow(action: Action) {
  // The local demo runs in one Node process. Keep read, validate and write synchronous.
  const next = changeShow(readShow(), action);
  saveShow(next);
  return next;
}

export function localHost(request: Request) {
  return /^(?:localhost|127\.0\.0\.1)(?::[0-9]+)?$/i.test(request.headers.get('host') ?? '');
}

export function localOrigin(request: Request) {
  return localHost(request) && request.headers.get('origin') === 'http://' + request.headers.get('host');
}

export function localMutation(request: Request) {
  return localOrigin(request) && request.headers.get('content-type')?.split(';')[0] === 'application/json';
}

export function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}
