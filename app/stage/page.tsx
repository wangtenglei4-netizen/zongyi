'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { guestName, guests, teamName, teams } from '../../lib/show.mjs';
import type { StageView } from '../../lib/show.mjs';
import { RolePortrait } from '../role-portrait';
import { roleKey } from '../../lib/roles';
import { EnvelopeFire } from './envelope-fire';
import './stage.css';

const titles = {
  captains: '黑白阵营',
  scores: '现场计分',
} satisfies Record<'captains' | 'scores', string>;

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

function EnvelopePaper({ paper, team }: { paper: RefObject<SVGSVGElement | null>; team: string }) {
  const gradient = useId();
  return (
    <svg ref={paper} className="oath-envelope" width="560" height="160" viewBox="0 0 560 160"
      preserveAspectRatio="none" role="img" aria-label={'公开身份，' + team + '成员'} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={gradient} cx=".5" cy="0" r="1">
          <stop stopColor="#e8d6ab"/><stop offset="1" stopColor="#b69a69"/>
        </radialGradient>
      </defs>
      <rect x=".5" y=".5" width="559" height="159" fill={'url(#' + gradient + ')'} stroke="#9d7653"/>
      <path d="M1 159 233 47m326 112L328 47" fill="none" stroke="#775933" strokeOpacity=".25" strokeWidth="2.5"/>
      <g fill="#2a2117" fontFamily="PingFang SC, Microsoft YaHei, sans-serif">
        <text x="32" y="62" fontSize="15" letterSpacing="2.3">公开身份</text>
        <text x="32" y="107" fontSize={Math.min(37, 395 / (Array.from(team).length + 2))} fontWeight="750">{team}成员</text>
      </g>
      <g color="#762b37" transform="translate(466 51) scale(.76)"><WaxSealMark/></g>
    </svg>
  );
}

function SilverMirror({ result }: { result?: 'spy' | 'clear' }) {
  const glass = useId();
  return (
    <svg className="silver-mirror" viewBox="0 0 180 210" fill="none" aria-hidden="true">
      <path d="M90 4c-8 12-19 14-28 12 1 8-5 12-13 13C29 46 18 74 18 103c0 34 13 58 34 76 8 2 13 7 10 14 10-2 21 0 28 13 8-13 19-15 28-13-3-7 2-12 10-14 21-18 34-42 34-76 0-29-11-57-31-74-8-1-14-5-13-13-9 2-20 0-28-12Z" fill="#2d3435" stroke="#b8b7a9" strokeWidth="2"/>
      <ellipse cx="90" cy="104" rx="60" ry="80" fill="#13191f" stroke="#8e998f" strokeWidth="3"/>
      {result && <>
        <defs>
          <radialGradient id={glass} cx=".45" cy=".43" r=".62">
            <stop stopColor={result === 'spy' ? '#a3242f' : '#fffef8'}/>
            <stop offset=".58" stopColor={result === 'spy' ? '#641221' : '#ebe9e1'}/>
            <stop offset="1" stopColor={result === 'spy' ? '#1e060d' : '#8b979c'}/>
          </radialGradient>
        </defs>
        <ellipse className="mirror-glass" cx="90" cy="104" rx="59" ry="79" fill={'url(#' + glass + ')'}/>
      </>}
      <ellipse cx="90" cy="104" rx="53" ry="72" stroke="#c5b998" opacity=".55"/>
      <path d="M53 113c0-30 13-55 37-72m-33 97c6-8 18-17 25-20" stroke="#c9d7ce" strokeWidth="2" opacity=".26" strokeLinecap="round"/>
      {result === 'spy' && <g className="mirror-grin">
        <path d="M53 86q9-6 25 4-18 4-25-4Zm74-3q-9-4-25 7 18 2 25-7Z" fill="#23070d"/>
        <path d="M50 107c20 18 61 18 80-4-11 39-57 53-80 4Z" fill="#21060c" stroke="#ee7773" strokeOpacity=".56"/>
        <path d="M57 112c18 12 48 14 65-1-17 24-48 28-65 1Z" fill="#edb9a6"/>
        <path d="m70 119 1 8m9-5 1 9m10-8v8m10-9-1 7m10-10-1 6" stroke="#681622" strokeWidth="1.3"/>
      </g>}
      {!result && <path d="m90 88 4 12 12 4-12 4-4 12-4-12-12-4 12-4Z" fill="#cfb580" opacity=".76"/>}
    </svg>
  );
}

type RevealBeat = 'public' | 'burn' | 'intro' | 'role';

const revealTiming = {
  public: { next: 'burn', duration: 1050 },
  burn: { next: 'intro', duration: 2250 },
  intro: { next: 'role', duration: 720 },
} satisfies Record<Exclude<RevealBeat, 'role'>, { next: RevealBeat; duration: number }>;

function IdentityReveal({ identity, guest, team }: { identity: NonNullable<StageView['identity']>; guest: string; team: string }) {
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
        <span className="kicker">{guest} · 仅本人查阅</span>
        {showEnvelope && (
          <div className="oath-envelope-area">
            <EnvelopePaper paper={paper} team={team}/>
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

  useEffect(() => {
    const stream = new EventSource('/api/stage/events');
    let expire: ReturnType<typeof setTimeout> | undefined;
    stream.onmessage = event => {
      const data: StageView = JSON.parse(event.data);
      clearTimeout(expire);
      if (data.identity) {
        // Also cover a stalled connection while a private identity is visible.
        expire = setTimeout(() => {
          setView(previous => previous === data ? { ...data, identity: null } : previous);
        }, data.identity.remaining);
      }
      setView(data);
      setOnline(true);
    };
    stream.onerror = () => {
      clearTimeout(expire);
      setOnline(false);
      setView(previous => previous?.identity ? { ...previous, identity: null } : previous);
    };
    return () => {
      stream.close();
      clearTimeout(expire);
    };
  }, []);

  const hiddenRevision = view?.hideRevision;
  useEffect(() => {
    if (!online || hiddenRevision == null) return;
    const abort = new AbortController();
    let retry: ReturnType<typeof setTimeout>;
    let delay = 500;

    // Acknowledge only after React has removed the identity card from the stage DOM.
    async function acknowledge() {
      try {
        const response = await fetch('/api/stage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hiddenRevision }),
          signal: abort.signal,
        });
        if (response.ok || response.status === 409) return;
      } catch { /* Retry a failed delivery while this revision is current. */ }
      if (abort.signal.aborted) return;
      retry = setTimeout(acknowledge, delay);
      delay = Math.min(delay * 2, 4000);
    }

    void acknowledge();
    return () => {
      abort.abort();
      clearTimeout(retry);
    };
  }, [online, hiddenRevision]);

  if (!view) return <main className="loading">舞台画面正在准备…</main>;
  const identity = online ? view.identity : null;
  const mirror = online ? view.mirror : null;
  const mirrorResult = mirror ? (mirror.spy ? 'spy' : 'clear') : undefined;


  return (
    <main className="investigation">
      <div className="investigation-frame">
      {(view.phase === 'captains' || view.phase === 'scores') && <section className="case-heading"><h1>{titles[view.phase]}</h1></section>}
      {!online && <p className="notice" role="status">正在重新连接，请稍候。</p>}
      {view.phase === 'draw' && (
        identity ? <IdentityReveal key={view.guest} identity={identity} guest={guestName(view.guest, view.guestNames)} team={teamName(identity.apparentTeam, view.teamNames)}/> : <section className="stage-envelopes" aria-label="八封身份密函">
          <div className="dossier-grid">
            {guests.map((number, slot) => {
              const taken = view.draws.find(draw => draw.slot === slot);
              const label = String(number).padStart(2, '0');
              return <div key={number} className={'dossier' + (taken ? ' sealed' : '')}>
                <span className="dossier-number">{label}</span><WaxSeal/>
              </div>;
            })}
          </div>
        </section>
      )}
      {view.phase === 'captains' && <div className="stage-teams">
        {teams.map(team => <section className={'board stage-team ' + (team === '白' ? 'stage-white' : '')} key={team}>
          <h2>{teamName(team, view.teamNames)}</h2>
          <ul className="stage-roster">{view.rosters?.[team].map(guest =>
            <li key={guest}>{guestName(guest, view.guestNames)} {view.captains[team] === guest && <strong className="badge">⬟ 队长</strong>}</li>
          )}</ul>
        </section>)}
      </div>}
      {view.phase === 'scores' && <section className="board stage-results">
        {view.score ? <>
          <h2>{teamName(view.score.team, view.teamNames)} · 第 {view.screenRound} 轮</h2>
          <div className="stage-teams">
            <div className="stage-total"><span>分数</span><strong>{view.score.score}</strong></div>
            <div className="stage-total"><span>实际分数</span><strong>{view.score.actualScore ?? '—'}</strong></div>
          </div>
        </> : <p className="hint">等待导播发布分数</p>}
      </section>}
      {view.phase === 'mirror' && <section className="stage-mirror" aria-label="魔镜">
        <div className={mirrorResult ? 'mirror-reveal mirror-' + mirrorResult : 'mirror-reveal'}
          key={mirror ? mirror.team + ':' + mirror.guest : 'waiting'}>
          <SilverMirror result={mirrorResult}/>
          {mirror && <div className="mirror-answer" aria-live="polite">
            <span>{guestName(mirror.guest, view.guestNames)}</span>
            <strong>{mirror.spy ? '是卧底' : '不是卧底'}</strong>
          </div>}
        </div>
      </section>}
      </div>
    </main>
  );
}
