'use client';

import { useEffect, useRef, useState } from 'react';
import { isValidGame } from '../lib/game.mjs';
import type { Team } from '../lib/game.mjs';
import { guestName, guests, members, scoreRounds, teamName, teams } from '../lib/show.mjs';
import type { Action, ScoreRound, Show } from '../lib/show.mjs';
import { AvatarSettings } from './avatar-settings';

const phases = {
  draw: '身份抽签',
  captains: '选队长',
  scores: '队伍分数',
  mirror: '魔镜问话',
} satisfies Record<Show['phase'], string>;

type Send = (action: Action) => Promise<boolean>;

async function fetchShow(action: Action): Promise<Show> {
  const response = await fetch('/api/show', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? '无法读取场次');
  return data;
}

export default function Console() {
  const [show, setShow] = useState<Show | null>(null);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [expiredAt, setExpiredAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const reset = useRef<HTMLDialogElement>(null);

  function apply(next: Show) {
    setShow(previous => !previous || next.revision > previous.revision ? next : previous);
  }

  useEffect(() => {
    const stream = new EventSource('/api/show/events');
    let first = true;
    let stopped = false;
    stream.onmessage = event => {
      const next: Show = JSON.parse(event.data);
      apply(next);
      setOffline(false);
      if (!first) return;
      first = false;
      if (next.revision !== 0) return;
      let old: unknown;
      try { old = JSON.parse(localStorage.getItem('zongyi.game.v1') ?? 'null'); } catch { /* Keep the new scene. */ }
      if (isValidGame(old)) {
        void fetchShow({ type: 'import-v1', game: old }).then(imported => {
          if (!stopped) apply(imported);
        }).catch(() => { /* Another console may already have imported the game. */ });
      }
    };
    stream.onerror = () => setOffline(true);
    return () => {
      stopped = true;
      stream.close();
    };
  }, []);

  const identityUntil = show?.identityUntil ?? 0;
  useEffect(() => {
    if (!identityUntil) return;
    const timer = setTimeout(() => setExpiredAt(identityUntil), Math.max(0, identityUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [identityUntil]);

  const send: Send = async action => {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      apply(await fetchShow(action));
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : '操作失败');
      return false;
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  if (!show) return <main className="loading">{offline ? '等待连接本地服务…' : '正在加载场次…'}</main>;
  const identityVisible = identityUntil > Date.now() && expiredAt !== identityUntil;
  const draw = show.game.draws.find(draw => draw.guest === show.guest);
  const ready = show.game.draws.length === 8;
  const captainsReady = teams.every(team => show.captains[team] !== null);
  const phaseReady = {
    draw: true, captains: ready, scores: captainsReady,
    mirror: captainsReady && scoreRounds.every(round => show.roundScores[round]),
  };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">◇</span>镜中局 · 导播台</div>
        <div className="header-actions">
          <a className="secondary stage-link" href="/stage" target="_blank" rel="noreferrer">打开舞台大屏 ↗</a>
          <NameSettings show={show} send={send}/>
          <AvatarSettings disabled={offline || show.identityPending}/>
          <button className="quiet" disabled={show.identityPending} onClick={() => reset.current?.showModal()}>重置本局</button>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="eyebrow"><span/> 现场控制 <span/></div>
          <h1>{phases[show.phase]}</h1>
          <p>把舞台大屏窗口移到投屏，导播台留在操作电脑上。</p>
        </section>
        <nav className="chapters" aria-label="节目环节">
          {(Object.keys(phases) as Show['phase'][]).map((phase, index) =>
            <button key={phase} aria-pressed={show.phase === phase} disabled={busy || offline || show.identityPending || !phaseReady[phase]}
              onClick={() => void send({ type: 'phase', phase })}><b>0{index + 1}</b> {phases[phase]}</button>
          )}
        </nav>
        {offline && <p className="notice" role="status">与本地服务断开，正在重连。</p>}
        {error && <p className="notice" role="alert">{error}</p>}
        <fieldset className="operation" disabled={busy || offline}>
          {show.phase === 'draw' && <section className="board">
            <div className="board-top"><div><span className="kicker">DRAFT CONTROL</span><h2>{ready ? '八位嘉宾已抽签' : guestName(show.guest, show.guestNames)}</h2></div><div className="progress"><b>{show.game.draws.length}</b><span> / 8 已抽取</span></div></div>
            <p className="hint">{draw ? '已选 ' + String(draw.slot + 1).padStart(2, '0') + ' 号格。请确认只有当前嘉宾看向大屏。' : '请在导播台选格。'}</p>
            <div className="operator-slots">
              {guests.map((number, slot) => {
                const taken = show.game.draws.find(draw => draw.slot === slot);
                return <button className="secondary" key={number} disabled={Boolean(draw || taken)}
                  onClick={() => void send({ type: 'draw', guest: show.guest, slot })}>
                  {String(number).padStart(2, '0')} · {taken ? guestName(taken.guest, show.guestNames) : '选格'}
                </button>;
              })}
            </div>
            <div className="controls">
              <span className="hint">{identityVisible ? '已发送亮牌指令，25 秒后自动收起。' : show.identityPending ? '等待大屏确认收牌，请保持大屏窗口连接。' : '可以继续现场流程。'}</span>
              <div className="control-actions">
                {identityVisible
                  ? <button className="primary" onClick={() => void send({ type: 'hide-identity' })}>收起身份</button>
                  : <button className="primary" disabled={!draw || show.identityPending} onClick={() => void send({ type: 'show-identity', guest: show.guest })}>亮身份</button>}
                {!ready && <button className="secondary" disabled={!draw || show.identityPending} onClick={() => void send({ type: 'next-guest' })}>下一位</button>}
              </div>
            </div>
          </section>}
          {show.phase === 'captains' && <section className="board">
            <h2>录入现场投票结果</h2>
            <p className="hint">选择后，大屏立即显示队长标志。</p>
            <div className="team-fields">{teams.map(team => (
              <label key={team}>{teamName(team, show.teamNames)}队长
                <select value={show.captains[team] ?? ''} onChange={event => void send({ type: 'captain', team, guest: Number(event.target.value) })}>
                  <option value="" disabled>选择队长</option>
                  {members(show, team).map(guest => <option key={guest} value={guest}>{guestName(guest, show.guestNames)}</option>)}
                </select>
              </label>
            ))}</div>
          </section>}
          {show.phase === 'scores' && <Scores show={show} send={send}/>}
          {show.phase === 'mirror' && <Mirror show={show} send={send}/>}
        </fieldset>
      </main>
      <footer><span>镜中局 / 导播台</span><span>本机运行 · 请仅投屏舞台窗口 <i/></span></footer>
      <dialog ref={reset}>
        <h2>重新开始本局？</h2><p>身份、队长、分数和魔镜记录都将清空。</p>
        <div className="control-actions">
          <button className="secondary" onClick={() => reset.current?.close()} autoFocus>取消</button>
          <button className="primary" disabled={busy || offline || show.identityPending} onClick={async () => { if (await send({ type: 'reset' })) reset.current?.close(); }}>确认重置</button>
        </div>
      </dialog>
    </div>
  );
}

function Scores({ show, send }: { show: Show; send: Send }) {
  const [round, setRound] = useState<ScoreRound>(() => scoreRounds.find(round => !show.roundScores[round]) ?? show.screenRound ?? 2);
  return (
    <section className="board">
      <div className="board-top">
        <div><span className="kicker">SCOREBOARD CONTROL</span><h2>展示队伍分数</h2></div>
        <span className="hint">{show.screenRound ? '大屏正在显示第 ' + show.screenRound + ' 轮' : '大屏等待发布'}</span>
      </div>
      <div className="round-tabs" aria-label="选择展示轮次">
        {scoreRounds.map(number =>
          <button key={number} className="secondary" aria-pressed={round === number} onClick={() => setRound(number)}>
            第 {number} 轮{show.roundScores[number] ? ' · 已发布' : ''}
          </button>
        )}
      </div>
      <ScoreForm key={round} round={round} show={show} send={send}/>
    </section>
  );
}

function ScoreForm({ round, show, send }: { round: ScoreRound; show: Show; send: Send }) {
  const record = show.roundScores[round];
  const [team, setTeam] = useState<Team | ''>(record?.team ?? '');
  const [score, setScore] = useState(String(record?.score ?? ''));
  const [actual, setActual] = useState(String(record?.actualScore ?? ''));
  return (
    <form className="score-form" onSubmit={event => {
      event.preventDefault();
      if (team && score !== '' && actual !== '') void send({ type: 'publish-score', round, team, score: Number(score), actualScore: Number(actual) });
    }}>
      <h3>第 {round} 轮 · 分数</h3>
      <p className="hint">选择队伍并填写工作人员算好的分数，确认后上大屏。</p>
      <div className="team-fields">
        <label>队伍
          <select value={team} required onChange={event => {
            const next = event.target.value as Team | '';
            setTeam(next);
            setScore(next === record?.team ? String(record.score) : '');
            setActual(next === record?.team ? String(record.actualScore ?? '') : '');
          }}>
            <option value="">选择队伍</option>
            {teams.map(team => <option key={team} value={team}>{teamName(team, show.teamNames)}</option>)}
          </select>
        </label>
        <label>分数
          <input type="number" step="any" min="-1000000" max="1000000" required value={score} onChange={event => setScore(event.target.value)}/>
        </label>
        <label>实际分数 <input type="number" step="any" min="-1000000" max="1000000" required value={actual} onChange={event => setActual(event.target.value)}/></label>
      </div>
      <button className="primary" type="submit" disabled={!team || score === '' || actual === ''}>{record ? '重新发布分数' : '发布分数'}</button>
    </form>
  );
}

function Mirror({ show, send }: { show: Show; send: Send }) {
  const [team, setTeam] = useState<Team>(show.mirrorTeam);
  const [target, setTarget] = useState(0);
  const result = show.game.mirror[team];
  return (
    <section className="board">
      <h2>队长问魔镜</h2>
      <p className="hint">确认后，嘉宾姓名和身份会显示在大屏魔镜内。</p>
      <div className="team-fields">
        <label>提问队伍<select value={team} onChange={event => { setTeam(event.target.value as Team); setTarget(0); }}>
          {teams.map(team => <option key={team} value={team}>{teamName(team, show.teamNames)} · 剩余 {show.game.mirror[team] ? 0 : 1} 次</option>)}
        </select></label>
        <p className="captain-label">{teamName(team, show.teamNames)}队长 · {guestName(show.captains[team]!, show.guestNames)}</p>
      </div>
      {result ? (
        <div className="controls">
          <span>已查验 {guestName(result.guest, show.guestNames)} · {result.spy ? '卧底' : '平民'}</span>
        </div>
      ) : (
        <div className="controls">
          <label>查验对象<select value={target} onChange={event => setTarget(Number(event.target.value))}>
            <option value={0}>选择嘉宾</option>
            {guests.map(guest => <option key={guest} value={guest}>{guestName(guest, show.guestNames)}</option>)}
          </select></label>
          <button className="primary" disabled={!target} onClick={() => void send({ type: 'mirror', team, guest: target })}>确认查验</button>
        </div>
      )}
    </section>
  );
}

function NameSettings({ show, send }: { show: Show; send: Send }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button className="secondary" onClick={() => { dialog.current?.querySelector('form')?.reset(); dialog.current?.showModal(); }}>队名与嘉宾姓名</button>
    <dialog ref={dialog}>
      <form onSubmit={async event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const teamNames = { 黑: String(data.get('team-黑') ?? ''), 白: String(data.get('team-白') ?? '') };
        const guestNames = Object.fromEntries(guests.map(guest => [guest, String(data.get('guest-' + guest) ?? '')]));
        if (await send({ type: 'names', guestNames, teamNames })) dialog.current?.close();
      }}>
        <div className="team-fields" key={JSON.stringify([show.teamNames, show.guestNames])}>
          {teams.map(team => <label key={team}>{team}队队名<input name={'team-' + team} maxLength={24} defaultValue={show.teamNames?.[team]} placeholder={team + '队'}/></label>)}
          {guests.map(guest => <label key={guest}>{guestName(guest)}<input name={'guest-' + guest} maxLength={24} defaultValue={show.guestNames?.[guest]}/></label>)}
        </div>
        <button type="button" className="secondary" onClick={() => dialog.current?.close()}>取消</button>
        <button className="primary">保存</button>
      </form>
    </dialog>
  </>;
}
