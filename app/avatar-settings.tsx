'use client';

import { useRef, useState } from 'react';
import { avatarFormats, avatarMaxBytes, avatarUrl, roleOptions } from '../lib/roles';
import { RolePortrait } from './role-portrait';

export function AvatarSettings({ disabled }: { disabled: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button className="secondary" disabled={disabled} onClick={() => dialog.current?.showModal()}>角色头像</button>
      <dialog ref={dialog} className="avatar-dialog" aria-labelledby="avatar-heading">
        <h2 id="avatar-heading">角色头像</h2>
        <p>每种身份一张图，亮身份时在大屏显示。卧底按实际效力的队伍配置。支持 PNG、JPG、WebP，每张不超过 4 MB。</p>
        <div className="avatar-grid">{roleOptions.map(role => <AvatarEditor key={role.key} role={role}/>)}</div>
        <div className="control-actions"><button className="primary" onClick={() => dialog.current?.close()}>完成</button></div>
      </dialog>
    </>
  );
}

function AvatarEditor({ role }: { role: (typeof roleOptions)[number] }) {
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [failed, setFailed] = useState(false);

  async function update(file?: File) {
    if (file && file.size > avatarMaxBytes) {
      setStatus('头像不能超过 4 MB。');
      setFailed(true);
      return;
    }

    setBusy(true);
    setStatus('');
    setFailed(false);
    try {
      if (file) {
        try {
          const image = await createImageBitmap(file);
          image.close();
        } catch {
          throw new Error('图片无法打开，请换一张。');
        }
      }
      const response = await fetch(avatarUrl(role.key), file ? { method: 'PUT', body: file } : { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? '头像保存失败。');
      }
      setVersion(version => version + 1);
      setStatus(file ? '已保存' : '已恢复默认图标');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '头像保存失败。');
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="avatar-editor">
      <RolePortrait key={version} role={role.key} spy={role.spy} version={version}/>
      <div>
        <h3>{role.label}</h3>
        <div className="avatar-actions">
          <label className="secondary avatar-picker">上传图片
            <input type="file" accept={avatarFormats} aria-label={'上传' + role.label + '头像'} disabled={busy}
              onChange={event => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (file) void update(file);
              }}/>
          </label>
          <button className="quiet" disabled={busy} aria-label={'恢复' + role.label + '默认图标'} onClick={() => void update()}>恢复默认</button>
        </div>
        <span className="hint" role={failed ? 'alert' : 'status'}>{busy ? '正在保存…' : status}</span>
      </div>
    </section>
  );
}
