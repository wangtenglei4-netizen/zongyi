export function Emblem({ kind = 'card' }: { kind?: 'card' | 'mirror' | 'spy' | 'civilian' }) {
  return (
    <svg className={'emblem ' + kind} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M32 4 60 32 32 60 4 32 32 4Z" stroke="currentColor" opacity=".28"/>
      <path d="M32 10 54 32 32 54 10 32 32 10Z" stroke="currentColor" opacity=".55"/>
      {kind === 'mirror' ? <><ellipse cx="32" cy="31" rx="11" ry="15" stroke="currentColor" strokeWidth="1.4"/><path d="m28 33 8-8m-4 12 5-5" stroke="currentColor"/></>
      : kind === 'spy' ? <><path d="M17 32q15-16 30 0-15 16-30 0Z" stroke="currentColor" strokeWidth="1.5"/><circle cx="32" cy="32" r="4" fill="currentColor"/></>
      : kind === 'civilian' ? <path d="m32 18 11 5v8c0 7-5 11-11 15-6-4-11-8-11-15v-8l11-5Z" stroke="currentColor" strokeWidth="1.5"/>
      : <path d="m32 19 4 9 9 4-9 4-4 9-4-9-9-4 9-4 4-9Z" fill="currentColor" opacity=".85"/>}
    </svg>
  );
}

