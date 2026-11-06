import { authorizeMutation, authorizeRead, json, readShow, updateShow } from '../../../lib/show-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = authorizeRead(request);
  if (denied) return denied;
  return json(await readShow());
}

export async function POST(request: Request) {
  const denied = authorizeMutation(request);
  if (denied) return denied;
  try {
    return json(await updateShow(await request.json()));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : '操作失败' }, 400);
  }
}
