import { scoreRounds, teamName } from '../lib/show.mjs';
import type { Show } from '../lib/show.mjs';

export function ScoreSummary({ scores, teamNames }: { scores: Show['roundScores'] | null; teamNames: Show['teamNames'] }) {
  return (
    <div className="score-overview">
      {scoreRounds.map(round => {
        const record = scores?.[round];
        return <section className={'parchment-panel' + (record?.team === '白' ? ' parchment-light' : '')} key={round}>
          <header className="parchment-heading">
            <span>第 {round} 轮</span>
            <h3>{record ? teamName(record.team, teamNames) : '—'}</h3>
          </header>
          <dl className="score-values">
            <div><dt>分数</dt><dd>{record?.score ?? '—'}</dd></div>
            <div><dt>实际分数</dt><dd>{record?.actualScore ?? '—'}</dd></div>
          </dl>
        </section>;
      })}
    </div>
  );
}
