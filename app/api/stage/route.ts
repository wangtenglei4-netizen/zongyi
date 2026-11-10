import { authorizeMutation, authorizeRead, json, readShow, updateShow } from '../../../lib/show-store';
import { stageView } from '../../../lib/show.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = authorizeRead(request);
  if (denied) return denied;
  return json(stageView(await readShow()));
}

export async function POST(request: Request) {
  const denied = authorizeMutation(request);
  if (denied) return denied;
  try {
    const { hiddenRevision } = await request.json();
    if (!Number.isInteger(hiddenRevision)) return json({ error: '请在导播台操作' }, 403);
    return json(stageView(await updateShow({ type: 'stage-hidden', revision: hiddenRevision })));
  } catch (error) {
    const message = error instanceof Error ? error.message : '收牌确认失败';
    return json({ error: message }, message === '收牌确认已过期' ? 409 : 503);
  }
}
