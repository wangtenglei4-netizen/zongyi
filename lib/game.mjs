export function createGame(random = Math.random) {
  const cards = ['黑', '白'].flatMap(team => [false, false, false, true].map(spy => ({ team, spy, scoringTeam: spy ? (team === '黑' ? '白' : '黑') : team })));
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return { version: 1, cards, draws: [], mirror: { 黑: null, 白: null } };
}
export function drawCard(game, guest, slot) {
  if (!Number.isInteger(guest) || guest < 1 || guest > 8 || !Number.isInteger(slot) || slot < 0 || slot > 7) throw new Error('请选择有效的嘉宾和格子');
  if (game.draws.some(d => d.guest === guest)) throw new Error('这位嘉宾已经抽过身份了');
  if (game.draws.some(d => d.slot === slot)) throw new Error('这个格子已经被选择了');
  return { ...game, draws: [...game.draws, { guest, slot }] };
}
export function inspectGuest(game, team, guest) {
  if (!['黑', '白'].includes(team)) throw new Error('请选择查验队伍');
  if (game.draws.length !== 8) throw new Error('请先完成八位嘉宾的抽签');
  if (game.mirror[team] !== null) throw new Error('这支队伍已经使用过魔镜');
  const draw = game.draws.find(d => d.guest === guest);
  if (!draw) throw new Error('该嘉宾尚未抽签');
  return { ...game, mirror: { ...game.mirror, [team]: { guest, spy: game.cards[draw.slot].spy } } };
}
export function identityText(card) {
  return card.spy
    ? `你是${card.team}队的成员，但是你是${card.scoringTeam}队的卧底。你的任务是隐藏到最后。记住！你所赢得的积分将计入${card.scoringTeam}队。`
    : `你是${card.team}队的平民，你的任务是尽可能为自己的队伍争取更多积分，赢得最后的胜利！`;
}
export function isValidGame(g) {
  if (!g || g.version !== 1 || !Array.isArray(g.cards) || g.cards.length !== 8 || !Array.isArray(g.draws) || g.draws.length > 8 || !g.mirror) return false;
  if (!g.draws.every(d => d && Number.isInteger(d.guest) && d.guest >= 1 && d.guest <= 8 && Number.isInteger(d.slot) && d.slot >= 0 && d.slot < 8)) return false;
  if (new Set(g.draws.map(d => d.guest)).size !== g.draws.length || new Set(g.draws.map(d => d.slot)).size !== g.draws.length) return false;
  for (const team of ['黑', '白']) {
    const cards = g.cards.filter(c => c?.team === team);
    if (cards.length !== 4 || cards.filter(c => c.spy === true).length !== 1) return false;
    if (cards.some(c => typeof c.spy !== 'boolean' || c.scoringTeam !== (c.spy ? (team === '黑' ? '白' : '黑') : team))) return false;
    const m = g.mirror[team];
    if (m !== null && (!m || g.draws.length !== 8 || !Number.isInteger(m.guest) || typeof m.spy !== 'boolean' || !g.draws.some(d => d.guest === m.guest && g.cards[d.slot]?.spy === m.spy))) return false;
  }
  return true;
}
