'use client';

import { useState } from 'react';
import { avatarUrl } from '../lib/roles';
import type { RoleKey } from '../lib/roles';
import { Emblem } from './emblem';

export function RolePortrait({ role, spy, version }: { role: RoleKey; spy: boolean; version?: number }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="role-portrait">
      {!loaded && <Emblem kind={spy ? 'spy' : 'civilian'}/>}
      <img src={avatarUrl(role, version)} alt="角色头像" hidden={!loaded}
        onLoad={() => setLoaded(true)} onError={() => setLoaded(false)}/>
    </div>
  );
}
