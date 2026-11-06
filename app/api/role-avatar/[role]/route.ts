import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { json, localHost, localOrigin } from '../../../../lib/show-store';
import { avatarMaxBytes, roleOptions } from '../../../../lib/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ role: string }> };
const directory = join(process.cwd(), '.zongyi', 'avatars');

async function avatarPath(context: Context) {
  const { role } = await context.params;
  return roleOptions.some(option => option.key === role) ? join(directory, role) : null;
}

function imageType(data: Buffer) {
  if (data.length >= 24 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    data.toString('ascii', 12, 16) === 'IHDR') return 'image/png';
  if (data.length >= 4 && data[0] === 255 && data[1] === 216 && data[2] === 255 &&
    data[data.length - 2] === 255 && data[data.length - 1] === 217) return 'image/jpeg';
  if (data.length >= 16 && data.toString('ascii', 0, 4) === 'RIFF' &&
    data.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export async function GET(request: Request, context: Context) {
  if (!localHost(request)) return json({ error: '请从本机访问' }, 403);
  const path = await avatarPath(context);
  if (!path) return json({ error: '未找到角色' }, 404);
  try {
    const data = readFileSync(path);
    const type = imageType(data);
    if (!type) return json({ error: '头像格式无效' }, 404);
    return new Response(new Uint8Array(data), {
      headers: { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return json({ error: '使用默认头像' }, 404);
    return json({ error: '无法读取头像' }, 500);
  }
}

export async function PUT(request: Request, context: Context) {
  if (!localOrigin(request)) return json({ error: '请在本机导播台操作' }, 403);
  const path = await avatarPath(context);
  if (!path) return json({ error: '未找到角色' }, 404);
  const reader = request.body?.getReader();
  if (!reader) return json({ error: '请选择图片' }, 400);

  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > avatarMaxBytes) {
        await reader.cancel();
        return json({ error: '头像不能超过 4 MB' }, 413);
      }
      chunks.push(value);
    }
    const data = Buffer.concat(chunks, size);
    if (!imageType(data)) return json({ error: '请选择 PNG、JPG 或 WebP 图片' }, 400);

    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const temporary = path + '.tmp';
    writeFileSync(temporary, data, { mode: 0o600 });
    renameSync(temporary, path);
    return json({ ok: true });
  } catch {
    return json({ error: '无法保存头像，请重试' }, 500);
  } finally {
    reader.releaseLock();
  }
}

export async function DELETE(request: Request, context: Context) {
  if (!localOrigin(request)) return json({ error: '请在本机导播台操作' }, 403);
  const path = await avatarPath(context);
  if (!path) return json({ error: '未找到角色' }, 404);
  try {
    rmSync(path, { force: true });
    return json({ ok: true });
  } catch {
    return json({ error: '无法恢复默认头像，请重试' }, 500);
  }
}
