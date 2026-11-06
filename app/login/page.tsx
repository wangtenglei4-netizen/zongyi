'use client';

import { useState, type FormEvent } from 'react';

function safeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
  return value;
}

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? '口令不正确');
      const next = new URLSearchParams(location.search).get('next');
      location.assign(safeNext(next));
    } catch (error) {
      setError(error instanceof Error ? error.message : '口令不正确');
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <div className="eyebrow"><span/> 镜中局 <span/></div>
        <h1>现场口令</h1>
        <p>导播台和舞台大屏都使用这一串口令。</p>
      </section>
      <form className="board login-form" onSubmit={event => void submit(event)}>
        <label>口令
          <input type="password" autoFocus required value={password} onChange={event => setPassword(event.target.value)}/>
        </label>
        {error && <p className="notice" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={busy || !password}>进入</button>
      </form>
    </main>
  );
}
