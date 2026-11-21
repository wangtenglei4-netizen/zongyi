import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, drawCard, inspectGuest } from '../lib/game.mjs';
import { changeShow, createShow, identityDuration, mirrorDuration, members, restoreShow, stageView } from '../lib/show.mjs';

function setup() {
  let game = createGame();
  for (let slot = 0; slot < 8; slot++) game = drawCard(game, slot + 1, slot);
  let show = changeShow(createShow(game), { type: 'phase', phase: 'captains' });
  for (const team of ['黑', '白']) {
    show = changeShow(show, { type: 'captain', team, guest: members(show, team)[0] });
  }
  return changeShow(show, { type: 'phase', phase: 'scores' });
}

test('亮牌只投当前嘉宾，手动收牌后不再返回身份', () => {
  let show = changeShow(createShow(), { type: 'draw', guest: 1, slot: 0 }, 1000);
  assert.equal(stageView(show, 1000).identity, null);
  show = changeShow(show, { type: 'show-identity', guest: 1 }, 1000);
  assert.throws(() => changeShow(show, { type: 'stage-hidden', revision: show.revision }, 1001), /仍在展示/);
  assert.ok(stageView(show, 1001).identity?.title);
  assert.throws(() => changeShow(show, { type: 'next-guest' }, 1001), /大屏确认/);
  assert.equal(stageView(show, 1000 + identityDuration).identity, null);
  const legacy = { ...show, identityUntil: 1000 + identityDuration };
  assert.equal(stageView(legacy, 1000 + identityDuration).identity, null);
  show = changeShow(show, { type: 'hide-identity' }, 1002);
  assert.throws(() => changeShow(show, { type: 'next-guest' }, 1002), /大屏确认/);
  assert.throws(() => changeShow(show, { type: 'stage-hidden', revision: show.revision - 1 }, 1002), /过期/);
  show = changeShow(show, { type: 'stage-hidden', revision: stageView(show, 1002).hideRevision }, 1002);
  show = changeShow(show, { type: 'next-guest' }, 1003);
  assert.equal(stageView(show, 1003).guest, 2);
  assert.equal(stageView(show, 1003).identity, null);
  assert.throws(() => changeShow(show, { type: 'draw', guest: 1, slot: 1 }, 1004), /已变更/);
});

test('卧底亮牌标题与头像所属阵营一致，文案保留表面队伍', () => {
  const game = createGame(() => 0.99);
  for (const [infiltrated, affiliation] of [['白', '黑'], ['黑', '白']]) {
    const slot = game.cards.findIndex(card => card.spy && card.team === infiltrated);
    let show = changeShow(createShow(game), { type: 'draw', guest: 1, slot }, 1000);
    show = changeShow(show, { type: 'show-identity', guest: 1 }, 1000);
    const { team, apparentTeam, title, text } = stageView(show, 1001).identity;
    assert.equal(team, affiliation);
    assert.equal(apparentTeam, infiltrated);
    assert.equal(title, affiliation + '队 · 卧底');
    assert.ok(text.includes('你实际上是' + affiliation + '队成员，但会作为卧底潜伏在' + infiltrated + '队'));
  }
});

test('第 2、4 轮只展示指定队伍手工填写的单个分数', () => {
  let show = setup();
  assert.equal(stageView(show).score, null);
  assert.throws(() => changeShow(show, { type: 'publish-score', round: 1, team: '白', score: 1, actualScore: 3 }), /仅可/);
  assert.throws(() => changeShow(show, { type: 'publish-score', round: 2, team: '白', score: '', actualScore: 3 }), /有效分数/);
  show = changeShow(show, { type: 'publish-score', round: 2, team: '白', score: 0, actualScore: 3 });
  assert.deepEqual(stageView(show).score, { team: '白', score: 0, actualScore: 3 });
  show = changeShow(show, { type: 'publish-score', round: 4, team: '黑', score: -2.5, actualScore: 3 });
  assert.equal(stageView(show).screenRound, 4);
  assert.deepEqual(stageView(show).score, { team: '黑', score: -2.5, actualScore: 3 });
  show = changeShow(show, { type: 'publish-score', round: 2, team: '白', score: 13, actualScore: 3 });
  assert.deepEqual(stageView(show).score, { team: '白', score: 13, actualScore: 3 });
  assert.deepEqual(show.roundScores[4], { team: '黑', score: -2.5, actualScore: 3 });
});

test('旧版队伍总分等待按新规则录入，并保留已使用的魔镜记录', () => {
  const { roundScores, ...previous } = setup();
  const restored = restoreShow({
    ...previous,
    game: inspectGuest(previous.game, '黑', 1),
    phase: 'mirror',
    screenRound: 4,
    screenReveal: true,
    rounds: [
      null,
      { totals: { 黑: 9, 白: 0 }, reveal: { team: '白', scores: { 1: 42 } } },
      null,
      { totals: { 黑: 20, 白: 18 }, reveal: null },
    ],
  });
  assert.deepEqual(restored.roundScores, { 2: null, 4: null });
  assert.equal(restored.phase, 'scores');
  assert.equal(restored.game.mirror.黑.guest, 1);
  assert.throws(() => changeShow(restored, { type: 'phase', phase: 'mirror' }), /第 2、4 轮/);
  assert.equal(stageView(restored).score, null);
  assert.equal('rounds' in restored, false);
});

test('魔镜等两次队伍分数发布后才开放，每队一次，大屏只公开本次查验结果与必要信息', () => {
  let show = setup();
  assert.throws(() => changeShow(show, { type: 'phase', phase: 'mirror' }), /第 2、4 轮/);
  for (const round of [2, 4]) {
    show = changeShow(show, { type: 'publish-score', round, team: '黑', score: round, actualScore: 3 });
  }
  show = changeShow(show, { type: 'phase', phase: 'mirror' });
  for (const team of ['黑', '白']) {
    show = changeShow(show, { type: 'mirror', team, guest: 1 });
    assert.equal(typeof show.game.mirror[team].spy, 'boolean');
    assert.deepEqual(stageView(show, show.mirrorUntil - 1).mirror, { team, guest: 1, spy: show.game.mirror[team].spy, remaining: 1 });
    assert.throws(() => changeShow(show, { type: 'mirror', team, guest: 2 }, show.mirrorUntil), /已经使用/);
    assert.equal(stageView(show, show.mirrorUntil).mirror, null);
    show = { ...show, mirrorUntil: 0 };
  }
  assert.doesNotMatch(JSON.stringify(stageView(show)), /"cards"|"scoringTeam"/);
});

test('旧存档只能导入未开始的新场次，并保留已经完成的抽签', () => {
  const game = drawCard(createGame(), 1, 3);
  const show = changeShow(createShow(), { type: 'import-v1', game });
  assert.deepEqual(show.game, game);
  assert.equal(show.guest, 2);
  assert.throws(() => changeShow(show, { type: 'import-v1', game }), /已有场次/);
});

test('队名和姓名随场次保存并在重置后保留', () => {
  const show = changeShow(createShow(), { type: 'names', teamNames: { 黑: ' 夜影 ', 白: '晨光' }, guestNames: { 1: ' 阿明 ' } });
  assert.equal(stageView(show).teamNames.黑, '夜影');
  assert.equal(stageView(changeShow(show, { type: 'reset' })).guestNames[1], '阿明');
});


test('普通身份文案不透露卧底设定，两类身份总时长均为25秒且可提前收起', () => {
  const game = createGame();
  for (const spy of [false, true]) {
    const slot = game.cards.findIndex(card => card.spy === spy);
    let show = changeShow(createShow(game), { type: 'draw', guest: 1, slot }, 1000);
    show = changeShow(show, { type: 'show-identity', guest: 1 }, 1000);
    assert.equal(show.identityUntil, 1000 + identityDuration);
    const identity = stageView(show, 1000).identity;
    if (!spy) {
      assert.doesNotMatch(identity.title + identity.text, /平民|卧底/);
      assert.equal(identity.text, '你是一位特别勇敢的勇士，欢迎来到阿瓦隆王国进行我们的侍卫选举！你要尽力争取胜利，为你们的队伍取得更多的积分！');
    }
  }
});

test('汇总只展示已有四个数值，魔镜超时恢复且保留查验记录', () => {
  let show = setup();
  assert.throws(() => changeShow(show, { type: 'phase', phase: 'score-summary' }), /第 2、4 轮/);
  for (const round of [2, 4]) show = changeShow(show, { type: 'publish-score', round, team: round === 2 ? '白' : '黑', score: round * 10, actualScore: round * 9 });
  show = changeShow(show, { type: 'phase', phase: 'score-summary' });
  assert.deepEqual(stageView(show).scoreSummary, show.roundScores);
  assert.doesNotMatch(JSON.stringify(stageView(show)), /"cards"|"scoringTeam"|"spy"/);
  show = changeShow(show, { type: 'phase', phase: 'mirror' });
  show = changeShow(show, { type: 'mirror', team: '黑', guest: 1 }, 1000);
  assert.throws(() => changeShow(show, { type: 'mirror', team: '白', guest: 2 }, 1001), /等待/);
  assert.equal(stageView(show, 1000 + mirrorDuration).mirror, null);
  assert.ok(show.game.mirror.黑);
  assert.equal(stageView(restoreShow({ ...show, mirrorUntil: undefined }), 1001).mirror, null);
  show = changeShow(show, { type: 'mirror', team: '白', guest: 2 }, 1000 + mirrorDuration);
  assert.equal(stageView(show, 1000 + mirrorDuration).mirror.guest, 2);
});

test('静音只改变播放开关，重置后仍保持', () => {
  const show = changeShow(createShow(), { type: 'music', muted: true });
  assert.equal(show.musicMuted, true);
  assert.equal(stageView(show).musicMuted, true);
  assert.equal(changeShow(show, { type: 'reset' }).musicMuted, true);
  assert.equal(stageView(createShow()).musicMuted, false);
  assert.throws(() => changeShow(show, { type: 'music', muted: 'yes' }), /静音/);
});

test('手动收起魔镜恢复默认画面，保留查验记录和已使用次数', () => {
  let show = setup();
  assert.throws(() => changeShow(show, { type: 'hide-mirror' }), /魔镜环节/);
  for (const round of [2, 4]) show = changeShow(show, { type: 'publish-score', round, team: '黑', score: 10, actualScore: 9 });
  show = changeShow(show, { type: 'phase', phase: 'mirror' });
  show = changeShow(show, { type: 'mirror', team: '黑', guest: 1 }, 1000);
  const record = show.game.mirror.黑;
  const previous = show;
  show = changeShow(show, { type: 'hide-mirror' }, 1001);
  assert.equal(stageView(show, 1001).mirror, null);
  assert.equal(previous.mirrorUntil, 1000 + mirrorDuration);
  assert.equal(show.revision, previous.revision + 1);
  assert.deepEqual(show.game.mirror.黑, record);
  assert.throws(() => changeShow(show, { type: 'mirror', team: '黑', guest: 2 }, 1001), /已经使用/);
  show = changeShow(show, { type: 'mirror', team: '白', guest: 2 }, 1001);
  assert.equal(stageView(show, 1001).mirror.guest, 2);
});
