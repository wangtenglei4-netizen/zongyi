import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, drawCard, inspectGuest, identityText, isValidGame } from '../lib/game.mjs';
test('每局两队各三平民一卧底，积分归属正确', () => {
  for (let i = 0; i < 100; i++) {
    const g = createGame();
    assert.ok(isValidGame(g));
    for (const team of ['黑', '白']) {
      assert.equal(g.cards.filter(c => c.team === team && !c.spy).length, 3);
      assert.equal(g.cards.filter(c => c.team === team && c.spy).length, 1);
    }
    g.cards.forEach(c => assert.ok(identityText(c).includes(c.spy ? `积分将计入${c.scoringTeam}队` : `${c.team}队的平民`)));
  }
});
test('抽签不会重复领取，且不会修改原状态', () => {
  const g = createGame(), next = drawCard(g, 1, 0);
  assert.equal(g.draws.length, 0);
  assert.throws(() => drawCard(next, 1, 1));
  assert.throws(() => drawCard(next, 2, 0));
  assert.throws(() => drawCard(g, 0, 0));
  assert.throws(() => drawCard(g, 2, 8));
});
test('魔镜须完成抽签，每队仅一次，结果与真实身份一致', () => {
  let g = createGame();
  assert.throws(() => inspectGuest(g, '黑', 1));
  for (let i = 0; i < 8; i++) g = drawCard(g, i + 1, i);
  const next = inspectGuest(g, '黑', 3);
  assert.equal(next.mirror.黑.spy, g.cards[2].spy);
  assert.throws(() => inspectGuest(next, '黑', 4));
  assert.ok(isValidGame(inspectGuest(next, '白', 1)));
  assert.ok(isValidGame(JSON.parse(JSON.stringify(next))));
});
test('损坏的本地存档不可恢复', () => {
  assert.equal(isValidGame({}), false);
  const g = createGame();
  assert.equal(isValidGame({ ...g, draws: [{ guest: 1, slot: 9 }] }), false);
  assert.equal(isValidGame({ ...g, draws: [{ guest: 1, slot: 0 }, { guest: 1, slot: 1 }] }), false);
});
