'use client';

import { useEffect, useRef, useState } from 'react';
import { createGame, drawCard, identityText, inspectGuest, isValidGame } from '../lib/game.mjs';
import type { Game, Team } from '../lib/game.mjs';

const key = 'zongyi.game.v1';
const guests = Array.from({ length: 8 }, (_, i) => i + 1);
const num = (n: number) => String(n).padStart(2, '0');

function Emblem({ kind = 'card' }: { kind?: 'card' | 'mirror' | 'spy' | 'civilian' }) {
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

export default function Home() {
  const [game, setGame] = useState<Game | null>(null);
  const latest = useRef<Game | null>(null);
  const [mode, setMode] = useState<'stage' | 'private'>('stage');
  const [phase, setPhase] = useState<'draw' | 'mirror'>('draw');
  const [guest, setGuest] = useState(1);
  const [pending, setPending] = useState<number | null>(null);
  const [identity, setIdentity] = useState<number | null>(null);
  const [team, setTeam] = useState<Team>('黑');
  const [target, setTarget] = useState(0);
  const [mirrorOpen, setMirrorOpen] = useState(false);
  const [error, setError] = useState('');
  const [storageNotice, setStorageNotice] = useState('');
  const resetDialog = useRef<HTMLDialogElement>(null);

  function save(next: Game) {
    latest.current = next;
    setGame(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
      setStorageNotice('');
    } catch {
      setStorageNotice('当前浏览器无法保存进度，刷新后将开启新局。');
    }
  }

  useEffect(() => {
    if (latest.current) return;
    let restored: unknown;
    try { restored = JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { /* Start a fresh session. */ }
    const next = isValidGame(restored) ? restored : createGame();
    save(next);
    setGuest(guests.find(n => !next.draws.some(d => d.guest === n)) ?? 1);
  }, []);

  function changeMode(next: 'stage' | 'private') {
    setMode(next); setIdentity(null); setMirrorOpen(false); setError('');
  }

  function confirmDraw() {
    if (!latest.current || pending === null) return;
    try {
      save(drawCard(latest.current, guest, pending));
      setIdentity(mode === 'private' ? pending : null);
      setPending(null);
      setError('');
    } catch (err) { setError((err as Error).message); }
  }

  function reset() {
    save(createGame());
    setMode('stage'); setPhase('draw'); setGuest(1); setPending(null);
    setIdentity(null); setTeam('黑'); setTarget(0); setMirrorOpen(false); setError('');
    resetDialog.current?.close();
  }

  if (!game) return <main className="loading">镜中局正在准备…</main>;
  const draw = game.draws.find(d => d.guest === guest);
  const card = mode === 'private' && identity !== null ? game.cards[identity] : null;
  const count = game.draws.length;
  const result = game.mirror[team];

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">◇</span><div>镜中局<small>THE MIRROR GAME</small></div></div>
        <div className="header-actions">
          <div className="toggle" aria-label="显示模式">
            <button aria-pressed={mode === 'stage'} onClick={() => changeMode('stage')}>大屏展示</button>
            <button aria-pressed={mode === 'private'} onClick={() => changeMode('private')}>私密展示</button>
          </div>
          <button className="quiet" onClick={() => resetDialog.current?.showModal()}>重置本局</button>
        </div>
      </header>
      <main>
        <section className="hero" aria-labelledby="title">
          <div className="eyebrow"><span/> 综艺互动原型 <span/></div>
          <h1 id="title">{phase === 'draw' ? '身份抽签' : '魔镜查验'}</h1>
          <p>{phase === 'draw' ? '八位嘉宾，八张身份。选一格，看看你的阵营。' : '队长各有一次提问机会。魔镜只回答选中的嘉宾是否为卧底。'}</p>
        </section>
        <div className="chapters">
          <button aria-pressed={phase === 'draw'} onClick={() => { setPhase('draw'); setMirrorOpen(false); setError(''); }}><b>01</b> 身份抽签</button>
          <button aria-pressed={phase === 'mirror'} disabled={count !== 8} title={count !== 8 ? '八位嘉宾抽完后开放' : undefined} onClick={() => { setPhase('mirror'); setIdentity(null); setError(''); }}><b>02</b> 魔镜查验 {count !== 8 && <small>待开启</small>}</button>
        </div>
        {storageNotice && <p className="notice" role="status">{storageNotice}</p>}
        {error && <p className="notice" role="alert">{error}</p>}
        {phase === 'draw' ? (
          <>
            <section className="board" aria-label="八格身份墙">
              <div className="board-top"><div><span className="kicker">THE DRAFT</span><h2>身份选择墙</h2></div><div className="progress"><b>{num(count)}</b><span> / 08 已抽取</span></div></div>
              <div className="grid">
                {guests.map((n, index) => {
                  const taken = game.draws.find(d => d.slot === index);
                  return <button key={n} className={'tile' + (taken ? ' taken' : '') + (pending === index ? ' chosen' : '')} disabled={!!taken || !!draw} aria-pressed={pending === index} aria-label={taken ? `格子 ${num(n)}，嘉宾 ${num(taken.guest)} 已选择` : `选择格子 ${num(n)}`} onClick={() => { setPending(index); setIdentity(null); setError(''); }}>
                    <span className="tile-num">{num(n)}</span>
                    <Emblem/>
                    <span className="tile-label">{taken ? `嘉宾 ${num(taken.guest)}` : pending === index ? '已选中' : '待选择'}</span>
                  </button>;
                })}
              </div>
              <div className="controls">
                <label>当前嘉宾 <select value={guest} onChange={e => { setGuest(Number(e.target.value)); setIdentity(null); setPending(null); setError(''); }}>{guests.map(n => <option key={n} value={n}>嘉宾 {num(n)}{game.draws.some(d => d.guest === n) ? ' · 已抽' : ''}</option>)}</select></label>
                <div className="control-actions">
                  {draw ? <><span className="hint">已选 {num(draw.slot + 1)} 号格</span>
                    <button className="primary" onClick={() => { setMode('private'); setIdentity(draw.slot); }}>私密查看身份</button>
                    {count < 8 && <button className="secondary" onClick={() => { setGuest(guests.find(n => !game.draws.some(d => d.guest === n))!); setIdentity(null); setMode('stage'); setError(''); }}>下一位</button>}
                  </> : <><span className="hint">{pending === null ? '先选一格，再确认' : `已选 ${num(pending + 1)} 号格`}</span><button className="primary" disabled={pending === null} onClick={confirmDraw}>确认抽签</button></>}
                </div>
              </div>
            </section>
            {card && <section key={identity} className={'reveal ' + (card.team === '白' ? 'ivory' : '')} aria-live="polite">
              <Emblem kind={card.spy ? 'spy' : 'civilian'}/>
              <div><span className="kicker">私密身份 · 嘉宾 {num(guest)}</span><h2>{card.team}队 · {card.spy ? '卧底' : '平民'}</h2><p>{identityText(card)}</p></div>
              <button className="secondary" onClick={() => changeMode('stage')}>收起身份</button>
            </section>}
          </>
        ) : (
          <section className="board mirror-board" aria-label="魔镜查验区">
            <div className="mirror-visual"><Emblem kind="mirror"/><span className="kicker">THE MIRROR</span>
              <h2 aria-live="polite">{result ? (mode === 'private' && mirrorOpen ? (result.spy ? '是卧底' : '不是卧底') : '查验已完成') : '魔镜，回答我'}</h2>
              <p>{result ? `查验对象：嘉宾 ${num(result.guest)}` : '选择提问队伍和要查验的嘉宾。'}</p>
            </div>
            <div className="controls">
              <label>提问队伍 <select value={team} onChange={e => { setTeam(e.target.value as Team); setTarget(0); setMirrorOpen(false); setError(''); }}><option value="黑">黑队 · 剩余 {game.mirror.黑 ? 0 : 1} 次</option><option value="白">白队 · 剩余 {game.mirror.白 ? 0 : 1} 次</option></select></label>
              {result ? <button className="primary" onClick={() => { if (mirrorOpen) changeMode('stage'); else { setMode('private'); setMirrorOpen(true); } }}>{mirrorOpen ? '收起结果' : '私密查看结果'}</button>
                : <div className="control-actions"><label>查验对象 <select value={target} onChange={e => setTarget(Number(e.target.value))}><option value={0}>选择嘉宾</option>{guests.map(n => <option key={n} value={n}>嘉宾 {num(n)}</option>)}</select></label>
                <button className="primary" disabled={!target} onClick={() => { try { if (latest.current) save(inspectGuest(latest.current, team, target)); setMirrorOpen(mode === 'private'); setError(''); } catch (err) { setError((err as Error).message); } }}>确认查验</button></div>}
            </div>
          </section>
        )}
      </main>
      <footer><span>镜中局 / LOCAL PROTOTYPE</span><span>{mode === 'stage' ? '大屏展示 · 隐藏身份与结果' : '私密展示 · 请勿投屏'} <i/></span></footer>
      <dialog ref={resetDialog}>
        <h2>重新开始本局？</h2><p>已抽身份和魔镜记录将清除，并重新洗牌。</p>
        <div className="control-actions"><button className="secondary" onClick={() => resetDialog.current?.close()} autoFocus>取消</button><button className="primary" onClick={reset}>确认重置</button></div>
      </dialog>
    </div>
  );
}
