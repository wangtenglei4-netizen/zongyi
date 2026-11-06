'use client';

import { useEffect, useRef, useState } from 'react';
import { isValidGame } from '../lib/game.mjs';
import type { Team } from '../lib/game.mjs';
import { guestName, guests, members, scoreRounds, teams } from '../lib/show.mjs';
import type { Action, ScoreRound, Show } from '../lib/show.mjs';
import { AvatarSettings } from './avatar-settings';

const phases = {
  draw: '身份抽签',
  captains: '选队长',
  scores: '队伍分数',
  mirror: '魔镜问话',
} satisfies Record<Show['phase'], string>;

type Send = (action: Action) => Promise<boolean>;

async function fetchShow(action?: Action): Promise<Show> {
  const response = await fetch('/api/show', action ? {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(action),
  } : { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? '无法读取场次');
  return data;
}

export default function Console() {
  const [show, setShow] = useState<Show | null>(null);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const reset = useRef<HTMLDialogElement>(null);

  function apply(next: Show) {
    setShow(previous => !previous || next.revision >= previous.revision ? next : previous);
  }

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh(first = false) {
      try {
        let next = await fetchShow();
        if (first && next.revision === 0) {
          let old: unknown;
          try { old = JSON.parse(localStorage.getItem('zongyi.game.v1') ?? 'null'); } catch { /* Keep the new scene. */ }
          if (isValidGame(old)) {
            try { next = await fetchShow({ type: 'import-v1', game: old }); }
            catch { next = await fetchShow(); }
          }
        }
        if (!stopped) {
          apply(next);
          setOffline(false);
        }
      } catch {
        if (!stopped) setOffline(true);
      } finally {
        if (!stopped) timer = setTimeout(refresh, 500);
      }
    }
    void refresh(true);
    return () => { stopped = true; clearTimeout(timer); };
  }, []);

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
  const identityVisible = show.identityUntil > Date.now();
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
            <div className="board-top"><div><span className="kicker">DRAFT CONTROL</span><h2>{ready ? '八位嘉宾已抽签' : guestName(show.guest)}</h2></div><div className="progress"><b>{show.game.draws.length}</b><span> / 8 已抽取</span></div></div>
            <p className="hint">{draw ? '已选 ' + String(draw.slot + 1).padStart(2, '0') + ' 号格。请确认只有当前嘉宾看向大屏。' : '嘉宾可在大屏选格，导播也可以代为点击。'}</p>
            <div className="operator-slots">
              {guests.map((number, slot) => {
                const taken = show.game.draws.find(draw => draw.slot === slot);
                return <button className="secondary" key={number} disabled={Boolean(draw || taken)}
                  onClick={() => void send({ type: 'draw', guest: show.guest, slot })}>
                  {String(number).padStart(2, '0')} · {taken ? guestName(taken.guest) : '选格'}
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
              <label key={team}>{team}队队长
                <select value={show.captains[team] ?? ''} onChange={event => void send({ type: 'captain', team, guest: Number(event.target.value) })}>
                  <option value="" disabled>选择队长</option>
                  {members(show, team).map(guest => <option key={guest} value={guest}>{guestName(guest)}</option>)}
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
            第 {number} 轮 · {number === 2 ? '获胜队' : '落败队'}{show.roundScores[number] ? ' · 已发布' : ''}
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
  const teamLabel = round === 2 ? '获胜队' : '落败队';
  return (
    <form className="score-form" onSubmit={event => {
      event.preventDefault();
      if (team && score !== '') void send({ type: 'publish-score', round, team, score: Number(score) });
    }}>
      <h3>第 {round} 轮 · {teamLabel}分数</h3>
      <p className="hint">选择队伍并填写工作人员算好的分数，确认后上大屏。</p>
      <div className="team-fields">
        <label>{teamLabel}
          <select value={team} required onChange={event => {
            const next = event.target.value as Team | '';
            setTeam(next);
            setScore(next === record?.team ? String(record.score) : '');
          }}>
            <option value="">选择队伍</option>
            {teams.map(team => <option key={team} value={team}>{team}队</option>)}
          </select>
        </label>
        <label>队伍分数
          <input type="number" step="any" min="-1000000" max="1000000" required value={score} onChange={event => setScore(event.target.value)}/>
        </label>
      </div>
      <button className="primary" type="submit" disabled={!team || score === ''}>{record ? '重新发布分数' : '发布分数'}</button>
    </form>
  );
}

function Mirror({ show, send }: { show: Show; send: Send }) {
  const [team, setTeam] = useState<Team>(show.mirrorTeam);
  const [target, setTarget] = useState(0);
  const [visible, setVisible] = useState(false);
  const result = show.game.mirror[team];
  return (
    <section className="board">
      <h2>队长问魔镜</h2>
      <p className="hint">确认后消耗该队唯一一次机会。请由导播把答案私下递给队长。</p>
      <div className="team-fields">
        <label>提问队伍<select value={team} onChange={event => { setTeam(event.target.value as Team); setTarget(0); setVisible(false); }}>
          {teams.map(team => <option key={team} value={team}>{team}队 · 剩余 {show.game.mirror[team] ? 0 : 1} 次</option>)}
        </select></label>
        <p className="captain-label">{team}队队长 · {guestName(show.captains[team]!)}</p>
      </div>
      {result ? (
        <div className="controls">
          <span>已查验 {guestName(result.guest)} {visible && <strong className="private-answer">· {result.spy ? '是卧底' : '不是卧底'}</strong>}</span>
          <button className="secondary" onClick={() => setVisible(!visible)}>{visible ? '收起答案' : '私下查看答案'}</button>
        </div>
      ) : (
        <div className="controls">
          <label>查验对象<select value={target} onChange={event => setTarget(Number(event.target.value))}>
            <option value={0}>选择嘉宾</option>
            {guests.map(guest => <option key={guest} value={guest}>{guestName(guest)}</option>)}
          </select></label>
          <button className="primary" disabled={!target} onClick={() => void send({ type: 'mirror', team, guest: target })}>确认查验</button>
        </div>
      )}
    </section>
  );
}
