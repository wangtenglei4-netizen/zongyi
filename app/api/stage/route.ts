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
    const { guest, slot, hiddenRevision } = await request.json();
    const action = Number.isInteger(hiddenRevision)
      ? { type: 'stage-hidden' as const, revision: hiddenRevision }
      : { type: 'draw' as const, guest, slot };
    return json(stageView(await updateShow(action)));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : '抽签失败' }, 400);
  }
}
