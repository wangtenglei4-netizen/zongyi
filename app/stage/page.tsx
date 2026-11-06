'use client';

import { useEffect, useState } from 'react';
import { guestName, guests, teams } from '../../lib/show.mjs';
import type { StageView } from '../../lib/show.mjs';
import { Emblem } from '../emblem';
import { RolePortrait } from '../role-portrait';
import { roleKey } from '../../lib/roles';

const titles = {
  draw: '身份抽签',
  captains: '黑白阵营',
  scores: '现场计分',
  mirror: '魔镜问话',
} satisfies Record<StageView['phase'], string>;

export default function Stage() {
  const [view, setView] = useState<StageView | null>(null);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let stopped = false;
    let poll: ReturnType<typeof setTimeout>;
    let expire: ReturnType<typeof setTimeout>;
    const abort = new AbortController();
    async function refresh() {
      const sentAt = Date.now();
      try {
        const response = await fetch('/api/stage', { cache: 'no-store', signal: abort.signal });
        if (!response.ok) throw new Error('连接失败');
        const data: StageView = await response.json();
        if (stopped) return;
        clearTimeout(expire);
        if (data.identity) {
          const remaining = data.identity.remaining - (Date.now() - sentAt);
          if (remaining <= 0) data.identity = null;
          else expire = setTimeout(() => setView(previous => previous ? { ...previous, identity: null } : previous), remaining);
        }
        setOnline(true);
        setView(data);
      } catch {
        if (!stopped) {
          setOnline(false);
          setView(previous => previous ? { ...previous, identity: null } : previous);
        }
      } finally {
        if (!stopped) poll = setTimeout(refresh, 300);
      }
    }
    void refresh();
    return () => {
      stopped = true;
      abort.abort();
      clearTimeout(poll);
      clearTimeout(expire);
    };
  }, []);

  useEffect(() => {
    if (!online || view?.hideRevision == null || view.identity) return;
    // Acknowledge only after React has removed the identity card from the stage DOM.
    void fetch('/api/stage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hiddenRevision: view.hideRevision }),
    }).catch(() => { /* The next stage refresh can retry. */ });
  }, [online, view]);

  async function choose(guest: number, slot: number) {
    setError('');
    setBusy(true);
    try {
      const response = await fetch('/api/stage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest, slot }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '选格失败，请交给导播处理。');
    } finally {
      setBusy(false);
    }
  }

  if (!view) return <main className="loading">舞台画面正在准备…</main>;
  const identity = online ? view.identity : null;
  const hasDrawn = view.draws.some(draw => draw.guest === view.guest);

  return (
    <main className="shell stage-shell">
      <section className="hero">
        <div className="eyebrow"><span/> 镜中局 · THE MIRROR GAME <span/></div>
        <h1>{titles[view.phase]}</h1>
        {view.phase === 'draw' && <p>{view.draws.length === 8 ? '八位嘉宾已选格' : guestName(view.guest) + (hasDrawn ? ' · 等待导播' : ' · 请任选一格')}</p>}
      </section>
      {!online && <p className="notice" role="status">正在重新连接，请稍候。</p>}
      {online && error && !hasDrawn && <p className="notice" role="alert">{error}</p>}
      {view.phase === 'draw' && (
        identity ? <section className={'reveal stage-identity ' + (identity.team === '白' ? 'ivory' : '')} aria-live="polite">
          <RolePortrait key={view.guest} role={roleKey(identity.team, identity.spy)} spy={identity.spy}/>
          <div><span className="kicker">{guestName(view.guest)} · 请单独查看</span><h2>{identity.title}</h2><p>{identity.text}</p></div>
        </section> : <section className="board" aria-label="八格身份墙">
          <div className="board-top"><h2>身份选择墙</h2><div className="progress"><b>{view.draws.length}</b><span> / 8 已抽取</span></div></div>
          <div className="grid">
            {guests.map((number, slot) => {
              const taken = view.draws.find(draw => draw.slot === slot);
              const label = String(number).padStart(2, '0');
              return <button key={number} className={'tile' + (taken ? ' taken' : '')}
                disabled={Boolean(taken || hasDrawn || busy || !online)}
                aria-label={taken ? label + ' 号格 · ' + guestName(taken.guest) : '选择格子 ' + label}
                onClick={() => void choose(view.guest, slot)}>
                <span className="tile-num">{label}</span><Emblem/><span className="tile-label">{taken ? guestName(taken.guest) : '待选择'}</span>
              </button>;
            })}
          </div>
        </section>
      )}
      {view.phase === 'captains' && <div className="stage-teams">
        {teams.map(team => <section className={'board stage-team ' + (team === '白' ? 'stage-white' : '')} key={team}>
          <h2>{team}队</h2>
          <ul className="stage-roster">{view.rosters?.[team].map(guest =>
            <li key={guest}>{guestName(guest)} {view.captains[team] === guest && <strong className="badge">◆ 队长</strong>}</li>
          )}</ul>
        </section>)}
      </div>}
      {view.phase === 'scores' && <section className="board stage-results">
        <span className="kicker">SCOREBOARD</span>
        {view.score ? <>
          <h2>第 {view.screenRound} 轮 · {view.screenRound === 2 ? '获胜队' : '落败队'}分数</h2>
          <div className="stage-total"><span>{view.score.team}队</span><strong>{view.score.score}</strong></div>
        </> : <p className="hint">等待导播发布队伍分数</p>}
      </section>}
      {view.phase === 'mirror' && <section className="board mirror-board">
        <div className="mirror-visual" key={view.mirror?.team ?? 'waiting'}>
          <Emblem kind="mirror"/><span className="kicker">THE MIRROR</span>
          <h2>{view.mirror ? '魔镜已回答' : '魔镜，回答我'}</h2>
          <p>{view.mirror ? view.mirror.team + '队提问 · ' + guestName(view.mirror.guest) : '等待队长提问'}</p>
        </div>
      </section>}
    </main>
  );
}
