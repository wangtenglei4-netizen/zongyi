import { json, localHost, localMutation, readShow, updateShow } from '../../../lib/show-store';
import { stageView } from '../../../lib/show.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  if (!localHost(request)) return json({ error: '请从本机访问' }, 403);
  return json(stageView(readShow()));
}

export async function POST(request: Request) {
  if (!localMutation(request)) return json({ error: '请在本机大屏操作' }, 403);
  try {
    const { guest, slot, hiddenRevision } = await request.json();
    const action = Number.isInteger(hiddenRevision)
      ? { type: 'stage-hidden' as const, revision: hiddenRevision }
      : { type: 'draw' as const, guest, slot };
    return json(stageView(updateShow(action)));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : '抽签失败' }, 400);
  }
}
