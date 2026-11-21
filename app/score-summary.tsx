import { guestName, teams, teamName } from '../lib/show.mjs';
import type { StageView } from '../lib/show.mjs';

export function ScoreSummary({ summary, teamNames, guestNames }: {
  summary: StageView['scoreSummary'];
  teamNames: StageView['teamNames'];
  guestNames: StageView['guestNames'];
}) {
  return (
    <div className="score-overview">
      {teams.map(team => {
        const spy = summary?.infiltrators[team];
        return <section className={'parchment-panel' + (team === '白' ? ' parchment-light' : '')} key={team}>
          <header className="parchment-heading"><h3>{teamName(team, teamNames)}</h3></header>
          <dl className="score-values">
            <div><dt>分数</dt><dd>{summary?.scores[team] ?? '—'}</dd></div>
            <div><dt>实际分数</dt><dd>{summary?.actualScores?.[team] ?? '—'}</dd></div>
          </dl>
          {summary && <p className="final-infiltrator">
            <span>隐藏在{teamName(team, teamNames)}的是</span>
            <strong>{spy == null ? '—' : guestName(spy, guestNames)}</strong>
          </p>}
        </section>;
      })}
    </div>
  );
}
