'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { guestName, guests, teams } from '../../lib/show.mjs';
import type { StageView } from '../../lib/show.mjs';
import { RolePortrait } from '../role-portrait';
import { roleKey } from '../../lib/roles';
import { EnvelopeFire } from './envelope-fire';
import './stage.css';

const titles = {
  draw: '圆桌密议',
  captains: '黑白阵营',
  scores: '现场计分',
  mirror: '魔镜问话',
} satisfies Record<StageView['phase'], string>;

function WaxSealMark() {
  return (
    <>
      <path d="M40 5c8-1 12 5 18 6 9 2 14 8 14 16 6 8 2 15 1 21 0 8-6 14-14 17-6 6-13 9-20 7-7 1-13-2-18-7-8-2-14-7-15-15-5-6-4-13 0-20 0-8 6-15 14-17 5-5 12-8 20-8Z" fill="currentColor"/>
      <circle cx="40" cy="39" r="23" fill="none" stroke="#efd4a0" strokeWidth="1.3" opacity=".65"/>
      <circle cx="40" cy="39" r="18" fill="none" stroke="#efd4a0" opacity=".32"/>
      <path d="m40 24 4 11 11 4-11 4-4 11-4-11-11-4 11-4Z" fill="#efd4a0" opacity=".9"/>
    </>
  );
}

function WaxSeal() {
  return <svg className="letter-wax" viewBox="0 0 80 80" aria-hidden="true"><WaxSealMark/></svg>;
}

function EnvelopePaper({ paper, team }: { paper: RefObject<SVGSVGElement | null>; team: NonNullable<StageView['identity']>['apparentTeam'] }) {
  const gradient = useId();
  return (
    <svg ref={paper} className="oath-envelope" width="560" height="160" viewBox="0 0 560 160"
      preserveAspectRatio="none" role="img" aria-label={'公开身份，' + team + '队成员'} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={gradient} cx=".5" cy="0" r="1">
          <stop stopColor="#e8d6ab"/><stop offset="1" stopColor="#b69a69"/>
        </radialGradient>
      </defs>
      <rect x=".5" y=".5" width="559" height="159" fill={'url(#' + gradient + ')'} stroke="#9d7653"/>
      <path d="M1 159 233 47m326 112L328 47" fill="none" stroke="#775933" strokeOpacity=".25" strokeWidth="2.5"/>
      <g fill="#2a2117" fontFamily="PingFang SC, Microsoft YaHei, sans-serif">
        <text x="32" y="62" fontSize="15" letterSpacing="2.3">公开身份</text>
        <text x="32" y="107" fontSize="37" fontWeight="750">{team}队成员</text>
      </g>
      <g color="#762b37" transform="translate(466 51) scale(.76)"><WaxSealMark/></g>
    </svg>
  );
}

function SilverMirror() {
  return (
    <svg className="silver-mirror" viewBox="0 0 180 210" fill="none" aria-hidden="true">
      <path d="M90 4c-8 12-19 14-28 12 1 8-5 12-13 13C29 46 18 74 18 103c0 34 13 58 34 76 8 2 13 7 10 14 10-2 21 0 28 13 8-13 19-15 28-13-3-7 2-12 10-14 21-18 34-42 34-76 0-29-11-57-31-74-8-1-14-5-13-13-9 2-20 0-28-12Z" fill="#2d3435" stroke="#b8b7a9" strokeWidth="2"/>
      <ellipse cx="90" cy="104" rx="60" ry="80" fill="#13191f" stroke="#8e998f" strokeWidth="3"/>
      <ellipse cx="90" cy="104" rx="53" ry="72" stroke="#c5b998" opacity=".55"/>
      <path d="M53 113c0-30 13-55 37-72m-33 97c6-8 18-17 25-20" stroke="#c9d7ce" strokeWidth="2" opacity=".26" strokeLinecap="round"/>
      <path d="m90 88 4 12 12 4-12 4-4 12-4-12-12-4 12-4Z" fill="#cfb580" opacity=".76"/>
    </svg>
  );
}

type RevealBeat = 'public' | 'burn' | 'intro' | 'role';

const revealTiming = {
  public: { next: 'burn', duration: 1050 },
  burn: { next: 'intro', duration: 2250 },
  intro: { next: 'role', duration: 720 },
} satisfies Record<Exclude<RevealBeat, 'role'>, { next: RevealBeat; duration: number }>;

function IdentityReveal({ identity, guest }: { identity: NonNullable<StageView['identity']>; guest: number }) {
  const [beat, setBeat] = useState<RevealBeat>(() => identity.spy ? 'public' : 'role');
  const paper = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (beat === 'role') return;
    const { next, duration } = revealTiming[beat];
    const timer = setTimeout(() => setBeat(next), duration);
    return () => clearTimeout(timer);
  }, [beat]);

  const showRole = beat === 'role';
  const showEnvelope = beat === 'public' || beat === 'burn';

  return (
    <section className={'reveal stage-identity case-reveal' + (showRole && identity.team === '白' ? ' ivory' : '')} aria-live="polite">
      <div className="oath-body">
        <span className="kicker">{guestName(guest)} · 仅本人查阅</span>
        {showEnvelope && (
          <div className="oath-envelope-area">
            <EnvelopePaper paper={paper} team={identity.apparentTeam}/>
            {beat === 'burn' && <EnvelopeFire paper={paper} duration={revealTiming.burn.duration}/>}
          </div>
        )}
        {identity.spy && !showEnvelope && (
          <p className={'oath-intro' + (beat === 'intro' ? ' oath-intro-alone' : '')}>你的真正的身份是</p>
        )}
        {showRole && (
          <div className={identity.spy ? 'oath-role oath-unsealed' : 'oath-role'}>
            <RolePortrait role={roleKey(identity.team, identity.spy)} spy={identity.spy}/>
            <div>
              <h2>{identity.title}</h2>
              <p>{identity.text}</p>
            </div>
          </div>
        )}
      </div>
    </section>
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
      <section className="case-heading">
        <div>
          <h1>{titles[view.phase]}</h1>
          {view.phase === 'draw' && <p>八封密函里，藏着两名卧底。</p>}
        </div>
      </section>
      {!online && <p className="notice" role="status">正在重新连接，请稍候。</p>}
      {online && error && !hasDrawn && <p className="notice" role="alert">{error}</p>}
      {view.phase === 'draw' && (
        identity ? <IdentityReveal key={view.guest} identity={identity} guest={view.guest}/> : <section aria-label="八封身份密函">
          <div className="dossier-bar">
            <p>{view.draws.length === 8 ? '八封密函已领取' : guestName(view.guest) + (hasDrawn ? ' · 密函已锁定，等待亮牌' : ' · 请选择一封密函')}</p>
            <span><b>{String(view.draws.length).padStart(2, '0')}</b> / 08 已领取</span>
          </div>
          <div className="dossier-grid">
            {guests.map((number, slot) => {
              const taken = view.draws.find(draw => draw.slot === slot);
              const label = String(number).padStart(2, '0');
              return <button key={number} className={'dossier' + (taken ? ' sealed' : '')}
                disabled={Boolean(taken || hasDrawn || busy || !online)}
                aria-label={taken ? label + ' 号格 · ' + guestName(taken.guest) : '选择格子 ' + label}
                onClick={() => void choose(view.guest, slot)}>
                <span className="dossier-number" aria-hidden="true">{label}</span>
                <WaxSeal/>
                {taken && <span className="dossier-label">
                  <span>{guestName(taken.guest)}</span><span className="dossier-seal">已领取</span>
                </span>}
              </button>;
            })}
          </div>
        </section>
      )}
      {view.phase === 'captains' && <div className="stage-teams">
        {teams.map(team => <section className={'board stage-team ' + (team === '白' ? 'stage-white' : '')} key={team}>
          <h2>{team}队</h2>
          <ul className="stage-roster">{view.rosters?.[team].map(guest =>
            <li key={guest}>{guestName(guest)} {view.captains[team] === guest && <strong className="badge">⬟ 队长</strong>}</li>
          )}</ul>
        </section>)}
      </div>}
      {view.phase === 'scores' && <section className="board stage-results">
        {view.score ? <>
          <h2>第 {view.screenRound} 轮 · {view.screenRound === 2 ? '获胜队' : '落败队'}分数</h2>
          <div className="stage-total"><span>{view.score.team}队</span><strong>{view.score.score}</strong></div>
        </> : <p className="hint">等待导播发布队伍分数</p>}
      </section>}
      {view.phase === 'mirror' && <section className="board mirror-board">
        <div className="mirror-visual" key={view.mirror?.team ?? 'waiting'}>
          <SilverMirror/>
          <h2>{view.mirror ? '魔镜已作答' : '魔镜，回答我'}</h2>
          <p>{view.mirror ? view.mirror.team + '队提问 · ' + guestName(view.mirror.guest) : '等待队长提问'}</p>
        </div>
      </section>}
      </div>
    </main>
  );
}
