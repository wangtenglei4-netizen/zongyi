import { createGame, drawCard, identityText, inspectGuest, isValidGame } from './game.mjs';

export const teams = ['黑', '白'];
export const teamName = (team, names) => names?.[team] || team + '队';
export const scoreRounds = [2, 4];
export const guests = Array.from({ length: 8 }, (_, index) => index + 1);
export const guestName = (guest, names) => names?.[guest] || '嘉宾 ' + String(guest).padStart(2, '0');
export const identityDuration = 25_000;

export function createShow(game = createGame()) {
  return {
    game, phase: 'draw', guest: guests.find(guest => !game.draws.some(draw => draw.guest === guest)) ?? 8,
    identityUntil: 0, identityPending: false, captains: { 黑: null, 白: null }, roundScores: { 2: null, 4: null },
    screenRound: null, mirrorTeam: '黑', revision: 0,
  };
}

export function members(show, team) {
  return show.game.draws
    .filter(draw => show.game.cards[draw.slot].team === team)
    .map(draw => draw.guest)
    .sort((a, b) => a - b);
}

function requireRule(condition, message) {
  if (!condition) throw new Error(message);
}

function validScore(score) {
  return typeof score === 'number' && Number.isFinite(score) && Math.abs(score) <= 1_000_000;
}

export function restoreShow(saved) {
  if (saved.roundScores) return saved;
  const { rounds: _rounds, screenRound: _screenRound, screenReveal: _screenReveal, ...show } = saved;
  // Old cumulative totals cannot be assumed to use the new display's score definition.
  return {
    ...show,
    phase: show.phase === 'mirror' ? 'scores' : show.phase,
    roundScores: { 2: null, 4: null },
    screenRound: null,
  };
}

export function changeShow(show, action, now = Date.now()) {
  requireRule(action && typeof action.type === 'string', '无效的操作');
  const activeIdentity = show.identityUntil > now;
  const draw = show.game.draws.find(draw => draw.guest === show.guest);
  let next;
  switch (action.type) {
    case 'import-v1':
      requireRule(show.revision === 0 && isValidGame(action.game), '已有场次或旧存档无效');
      next = createShow(action.game);
      break;
    case 'reset':
      requireRule(!show.identityPending, '请等大屏确认收牌后再重置');
      next = { ...createShow(), guestNames: show.guestNames, teamNames: show.teamNames };
      break;
    case 'draw':
      requireRule(show.phase === 'draw' && !activeIdentity && action.guest === show.guest, '当前嘉宾已变更，请重新选格');
      next = { ...show, game: drawCard(show.game, show.guest, action.slot) };
      break;
    case 'show-identity':
      requireRule(show.phase === 'draw' && draw && action.guest === show.guest && !show.identityPending, '当前无法亮牌');
      next = { ...show, identityUntil: now + identityDuration, identityPending: true };
      break;
    case 'hide-identity':
      next = { ...show, identityUntil: 0 };
      break;
    case 'stage-hidden':
      requireRule(show.identityPending && action.revision === show.revision, '收牌确认已过期');
      requireRule(!activeIdentity, '身份仍在展示，请稍后确认收牌');
      next = { ...show, identityUntil: 0, identityPending: false };
      break;
    case 'next-guest': {
      requireRule(show.phase === 'draw' && draw && !show.identityPending, '请先完成当前抽签并等大屏确认收牌');
      const guest = guests.find(guest => !show.game.draws.some(draw => draw.guest === guest));
      requireRule(guest, '八位嘉宾已全部抽签');
      next = { ...show, guest, identityUntil: 0 };
      break;
    }
    case 'phase': {
      const phase = action.phase;
      requireRule(['draw', 'captains', 'scores', 'mirror'].includes(phase), '请选择有效的环节');
      requireRule(!show.identityPending, '请先等大屏确认收牌');
      if (phase !== 'draw') requireRule(show.game.draws.length === 8, '请先完成八位嘉宾的抽签');
      if (phase === 'scores' || phase === 'mirror') {
        requireRule(teams.every(team => show.captains[team] !== null), '请先标记两位队长');
      }
      if (phase === 'mirror') requireRule(scoreRounds.every(round => show.roundScores[round]), '请先发布第 2、4 轮队伍分数');
      next = { ...show, phase, identityUntil: 0 };
      break;
    }
    case 'captain':
      requireRule(show.phase === 'captains' && teams.includes(action.team) && members(show, action.team).includes(action.guest), '请选择该队的嘉宾');
      next = { ...show, captains: { ...show.captains, [action.team]: action.guest } };
      break;
    case 'names': {
      const clean = (keys, names) => Object.fromEntries(keys.map(key => {
        const value = names?.[key] ?? '';
        requireRule(typeof value === 'string' && value.trim().length <= 24, '名字最多 24 个字符');
        return [key, value.trim()];
      }));
      next = { ...show, guestNames: clean(guests, action.guestNames), teamNames: clean(teams, action.teamNames) };
      break;
    }
    case 'publish-score': {
      const { round, team, score, actualScore } = action;
      requireRule(show.phase === 'scores' && scoreRounds.includes(round), '仅可发布第 2、4 轮队伍分数');
      requireRule(teams.includes(team) && validScore(score) && validScore(actualScore), '请选择队伍并填写有效分数');
      next = { ...show, roundScores: { ...show.roundScores, [round]: { team, score, actualScore } }, screenRound: round };
      break;
    }
    case 'mirror':
      requireRule(show.phase === 'mirror' && teams.includes(action.team) && show.captains[action.team], '请先进入魔镜环节并选择队伍');
      next = { ...show, game: inspectGuest(show.game, action.team, action.guest), mirrorTeam: action.team };
      break;
    default:
      throw new Error('无效的操作');
  }
  return { ...next, revision: show.revision + 1 };
}

export function stageView(show, now = Date.now()) {
  const { game, phase, guest, captains, screenRound, mirrorTeam } = show;
  const current = game.draws.find(draw => draw.guest === guest);
  const card = phase === 'draw' && show.identityUntil > now && current ? game.cards[current.slot] : null;
  return {
    phase, guest, draws: game.draws, captains, screenRound, guestNames: show.guestNames, teamNames: show.teamNames,
    hideRevision: show.identityPending && !card ? show.revision : null,
    rosters: phase === 'draw' ? null : { 黑: members(show, '黑'), 白: members(show, '白') },
    identity: card ? { title: teamName(card.scoringTeam, show.teamNames) + ' · ' + (card.spy ? '卧底' : '平民'), text: identityText(card).replace(/([黑白])队/g, (_, team) => teamName(team, show.teamNames)), team: card.scoringTeam, apparentTeam: card.team, spy: card.spy, remaining: show.identityUntil - now } : null,
    score: phase === 'scores' ? show.roundScores[screenRound] ?? null : null,
    mirror: phase === 'mirror' && game.mirror[mirrorTeam]
      ? { team: mirrorTeam, guest: game.mirror[mirrorTeam].guest, spy: game.mirror[mirrorTeam].spy }
      : null,
  };
}
