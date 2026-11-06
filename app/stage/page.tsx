'use client';

import { useEffect, useState } from 'react';
import { guestName, guests, teams } from '../../lib/show.mjs';
import type { StageView } from '../../lib/show.mjs';
import { Emblem } from '../emblem';
import { RolePortrait } from '../role-portrait';
import { roleKey } from '../../lib/roles';
import './stage.css';

const titles = {
  draw: '身份档案',
  captains: '黑白阵营',
  scores: '现场计分',
  mirror: '魔镜问话',
} satisfies Record<StageView['phase'], string>;

function Fingerprint() {
  return (
    <svg className="dossier-print" viewBox="0 0 108 114" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
      <path d="M12 71C6 53 13 29 28 18c20-16 49-12 64 9 8 10 11 23 10 35"/>
      <path d="M17 78c-7-20-5-39 10-53 17-17 42-16 58-1 12 12 15 27 13 43"/>
      <path d="M21 83c-6-14-9-32 0-45 8-13 22-21 36-20 24 1 40 21 36 51l-3 11"/>
      <path d="M27 88c-9-19-11-36 0-50 9-13 29-20 44-10 16 9 23 29 15 51l-3 10"/>
      <path d="M33 93c-11-19-13-37-5-50 8-13 24-18 38-11 19 9 23 31 11 61"/>
      <path d="M37 98c-6-11-12-25-10-38 2-13 12-24 26-24 15 0 26 13 26 27 0 13-6 27-9 35"/>
      <path d="M43 101c-6-10-13-26-12-38 0-13 10-23 22-23 12 0 21 10 21 22 0 13-6 27-11 39"/>
      <path d="M48 105c-6-14-13-28-13-40 0-11 7-20 18-20 10 0 17 8 17 18 0 12-7 28-12 41"/>
      <path d="M53 104c-4-10-14-26-14-39 0-8 6-15 14-15 8 0 13 6 13 14 0 12-8 28-11 35"/>
      <path d="M52 91c-3-7-9-17-9-26 0-6 4-11 10-11s9 5 9 10c0 8-4 18-7 23"/>
      <path d="M53 81c-2-5-5-11-5-16 0-3 2-6 5-6s5 3 5 6c0 4-2 9-3 12"/>
      <path d="M9 50c1-19 12-34 27-41M64 7c18 4 31 16 37 33M21 90l6 9m47 3 4-9m9-2 2-7M15 82l-3-7"/>
    </svg>
  );
}

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
    <main className="investigation">
      <div className="investigation-frame">
      <header className="case-header">
        <div className="case-wordmark"><i aria-hidden="true"/> 镜中局 <span>／ MIRROR FILES</span></div>
        <div className="case-classification"><span aria-hidden="true"/> 现场调查档案</div>
      </header>
      <section className="case-heading">
        <div>
          <div className="case-index"><b>卷宗 0{['draw', 'captains', 'scores', 'mirror'].indexOf(view.phase) + 1}</b><span/> 反情报行动</div>
          <h1>{titles[view.phase]}</h1>
          {view.phase === 'draw' && <p>八份档案里，藏着两名卧底。</p>}
        </div>
        <div className="case-stamp" aria-hidden="true"><span>机密</span><small>RESTRICTED</small></div>
      </section>
      {!online && <p className="notice" role="status">正在重新连接，请稍候。</p>}
      {online && error && !hasDrawn && <p className="notice" role="alert">{error}</p>}
      {view.phase === 'draw' && (
        identity ? <section className={'reveal stage-identity case-reveal ' + (identity.team === '白' ? 'ivory' : '')} aria-live="polite">
          <RolePortrait key={view.guest} role={roleKey(identity.team, identity.spy)} spy={identity.spy}/>
          <div><span className="kicker">{guestName(view.guest)} · 仅本人查阅</span><h2>{identity.title}</h2><p>{identity.text}</p></div>
        </section> : <section aria-label="八格身份墙">
          <div className="dossier-bar">
            <p>{view.draws.length === 8 ? '八份档案已封存' : guestName(view.guest) + (hasDrawn ? ' · 档案已锁定，等待导播' : ' · 请选择一份档案')}</p>
            <span><b>{String(view.draws.length).padStart(2, '0')}</b> / 08 已封存</span>
          </div>
          <div className="dossier-grid">
            {guests.map((number, slot) => {
              const taken = view.draws.find(draw => draw.slot === slot);
              const label = String(number).padStart(2, '0');
              return <button key={number} className={'dossier' + (taken ? ' sealed' : '')}
                disabled={Boolean(taken || hasDrawn || busy || !online)}
                aria-label={taken ? label + ' 号格 · ' + guestName(taken.guest) : '选择格子 ' + label}
                onClick={() => void choose(view.guest, slot)}>
                <span className="dossier-meta"><span>身份记录</span><span aria-hidden="true">M / {label}</span></span>
                <span className="dossier-number" aria-hidden="true">{label}</span>
                <Fingerprint/>
                <span className="dossier-label"><span>{taken ? guestName(taken.guest) : '档案待开启'}</span>
                  {taken ? <span className="dossier-seal">已封存</span> : <span className="dossier-redact" aria-hidden="true"/>}</span>
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
      <footer className="case-footer"><span>镜中局 / 舞台大屏</span><span>{online ? '● 现场连线' : '○ 正在重连'}</span></footer>
      </div>
    </main>
  );
}
