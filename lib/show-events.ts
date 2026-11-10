import { authorizeRead, readLiveShow, watchShow } from './show-store';
import type { Show } from './show.mjs';

const streamLifetime = 285_000;
const keepalive = 15_000;
const encoder = new TextEncoder();

export function showEvents(request: Request, project: (show: Show) => unknown, sendExpiry = false) {
  const denied = authorizeRead(request);
  if (denied) return denied;

  const upstream = new AbortController();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      let current: Show | undefined;
      const lastId = request.headers.get('last-event-id') ?? '';
      let target = /^\d{1,15}$/.test(lastId) ? Number(lastId) : -1;
      let reading = false;
      let expiry: ReturnType<typeof setTimeout> | undefined;
      const startup = setTimeout(close, 10_000);

      const write = (frame: string) => controller.enqueue(encoder.encode(frame));
      const emit = (show: Show) => write('id: ' + show.revision + '\ndata: ' + JSON.stringify(project(show)) + '\n\n');

      function close() {
        if (upstream.signal.aborted) return;
        upstream.abort();
        controller.close();
      }

      const heartbeat = setInterval(() => write(': keepalive\n\n'), keepalive);
      const lifetime = setTimeout(close, streamLifetime);
      upstream.signal.addEventListener('abort', () => {
        request.signal.removeEventListener('abort', close);
        clearInterval(heartbeat);
        clearTimeout(lifetime);
        clearTimeout(expiry);
        clearTimeout(startup);
      }, { once: true });

      async function refresh(revision = -1) {
        target = Math.max(target, revision);
        if (upstream.signal.aborted || reading || (current && current.revision >= target)) return;
        reading = true;
        let requested = target;
        try {
          let next = await readLiveShow();
          while (!upstream.signal.aborted && next.revision < target) {
            // An update may arrive while an earlier snapshot is in flight.
            if (next.revision < requested) {
              close();
              return;
            }
            requested = target;
            next = await readLiveShow();
          }
          if (upstream.signal.aborted) return;
          clearTimeout(startup);
          current = next;
          clearTimeout(expiry);
          const now = Date.now();
          emit(next);
          if (sendExpiry && next.identityUntil > now) {
            // Expiry changes the stage projection without changing the stored revision.
            expiry = setTimeout(() => emit(next), next.identityUntil - now + 1);
          }
        } catch {
          close();
        } finally {
          reading = false;
        }
      }

      if (request.signal.aborted) {
        close();
        return;
      }
      request.signal.addEventListener('abort', close, { once: true });
      write('retry: 1200\n\n');
      void watchShow(upstream.signal, revision => void refresh(revision)).catch(close);
    },
    cancel() {
      upstream.abort();
    },
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
