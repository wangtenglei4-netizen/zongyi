import { json, localHost, localMutation, readShow, updateShow } from '../../../lib/show-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  if (!localHost(request)) return json({ error: '请从本机访问' }, 403);
  return json(readShow());
}

export async function POST(request: Request) {
  if (!localMutation(request)) return json({ error: '请在本机导播台操作' }, 403);
  try {
    return json(updateShow(await request.json()));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : '操作失败' }, 400);
  }
}
