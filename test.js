const E = require('./engine108.js');
const assert = require('assert');

function mk(n, seed) {
  const g = E.createGame({ players: Array.from({ length: n }, (_, i) => ({ name: 'P' + i, isBot: true })), seed });
  E.startRound(g);
  return g;
}
function totalCards(g) { return g.deck.length + g.discard.length + g.players.reduce((s, p) => s + p.hand.length, 0); }
function allIds(g) {
  const ids = [...g.deck, ...g.discard, ...g.players.flatMap(p => p.hand)].map(c => c.id);
  return new Set(ids);
}

// 1. массовая симуляция: инварианты
let games = 0, rounds = 0, resets = 0, queenFinishes = 0, maxRounds = 0;
for (let seed = 1; seed <= 400; seed++) {
  for (const n of [2, 3, 4, 5, 6]) {
    const g = mk(n, seed * 7 + n);
    let steps = 0;
    while (g.phase !== 'gameOver') {
      if (g.phase === 'roundEnd') { rounds++; if (g.lastRound.results.some(r => r.reset)) resets++; if (g.lastRound.results[g.lastRound.finisher].pts < 0) queenFinishes++; E.startRound(g); continue; }
      const a = E.botAction(g);
      assert(a, 'бот не нашёл действия ' + JSON.stringify({ phase: g.phase, lm: E.legalMoves(g) }));
      assert.strictEqual(totalCards(g), 36, 'потеряны карты');
      assert.strictEqual(allIds(g).size, 36, 'дубли карт');
      steps++;
      assert(steps < 20000, 'зациклилось');
    }
    rounds++;
    games++;
    maxRounds = Math.max(maxRounds, g.round);
    assert(g.losers.length >= 1);
    assert.deepStrictEqual(g.losers, g.players.filter(p => p.score >= 108).map(p => p.id));
  }
}
console.log(`симуляций: ${games} игр, ${rounds} партий, обнулений на 107: ${resets}, закрытий на даму: ${queenFinishes}, max партий в игре: ${maxRounds}`);

// 2. сценарии правил — собираем позицию вручную
function pos(hands, topCard, opts = {}) {
  const g = E.createGame({ players: hands.map((_, i) => ({ name: 'P' + i, isBot: false })), seed: 1 });
  E.startRound(g);
  const c = id => ({ id, rank: id.slice(0, -1), suit: id.slice(-1) });
  g.players.forEach((p, i) => { p.hand = hands[i].map(c); });
  g.discard = [c(topCard)];
  const used = new Set([topCard, ...hands.flat()]);
  g.deck = (opts.deck || []).map(c).concat(
    E.SUITS.flatMap(s => E.RANKS.map(r => r + s)).filter(id => !used.has(id) && !(opts.deck || []).includes(id)).map(c));
  g.deck.reverse(); // pop() берёт с конца → первой выйдет opts.deck[0]
  g.current = 0; g.phase = 'play'; g.pending = null; g.mustCover = null; g.chosenSuit = null; g.drawnCard = null;
  return g;
}

// цепочка шестёрок, 2 игрока, потолок 4
{
  const g = pos([['6S', '6C', '10S'], ['6D', '6H', '10D']], '9S');
  E.playCard(g, '6S'); assert.deepStrictEqual(g.pending, { kind: '6', draws: 1, count: 1 }); assert.strictEqual(g.current, 1);
  E.playCard(g, '6D'); assert.strictEqual(g.pending.draws, 2); assert.strictEqual(g.current, 0);
  E.playCard(g, '6C'); assert.strictEqual(g.pending.draws, 3);
  E.playCard(g, '6H'); assert.strictEqual(g.pending.draws, 4); assert.strictEqual(g.current, 0);
  const lm = E.legalMoves(g); assert.deepStrictEqual(lm.cards, []); assert(lm.canDraw);
  E.draw(g); assert.strictEqual(g.players[0].hand.length, 5); assert.strictEqual(g.pending, null); assert.strictEqual(g.current, 1);
}
// семёрки по две, первая вытянутая семёрка отбивает
{
  const g = pos([['7S', '10S'], ['9D', '10D']], '9S', { deck: ['7C', '8C', '8D'] });
  E.playCard(g, '7S'); assert.strictEqual(g.pending.draws, 2);
  E.draw(g); assert.strictEqual(g.phase, 'counterOffer'); assert.strictEqual(g.offerCard, '7C');
  E.acceptCounter(g); assert.strictEqual(g.pending.draws, 4); assert.strictEqual(g.current, 0);
  assert.strictEqual(g.players[1].hand.length, 2);
  E.draw(g); assert.strictEqual(g.phase, 'play'); // вытянул 8C — не семёрка → берёт все 4
  assert.strictEqual(g.players[0].hand.length, 5); assert.strictEqual(g.current, 1);
}
// король червей и 9♥ с руки, после отбоя ход переходит
{
  const g = pos([['KH', '10S'], ['9H', '10D'], ['6C']], '10H');
  E.playCard(g, 'KH'); assert.strictEqual(g.pending.draws, 5);
  assert.deepStrictEqual(E.legalMoves(g).cards, ['9H']);
  E.playCard(g, '9H'); assert.strictEqual(g.pending, null); assert.strictEqual(g.current, 2);
  assert.deepStrictEqual(E.legalMoves(g).cards, []); // 6C на 9H не ложится
}
// туз пропускает ход
{
  const g = pos([['AS', '10S'], ['9D'], ['9C']], '9S');
  E.playCard(g, 'AS'); assert.strictEqual(g.current, 2);
}
// дама нельзя на штраф, можно на всё остальное; заказ масти
{
  const g = pos([['6S', '10S'], ['QD', '9D']], '9S');
  E.playCard(g, '6S'); assert.deepStrictEqual(E.legalMoves(g).cards, []);
  const g2 = pos([['QD', '9D'], ['10S']], 'KS');
  E.playCard(g2, 'QD'); assert.strictEqual(g2.phase, 'chooseSuit');
  E.chooseSuit(g2, 'S'); assert.strictEqual(E.effSuit(g2), 'S'); assert.deepStrictEqual(E.legalMoves(g2).cards, ['10S']);
}
// восьмёрка: покрыть с руки, покрыть восьмёркой, тянуть до покрытия
{
  const g = pos([['8S', 'JS', '9D'], ['10D']], '9S');
  E.playCard(g, '8S'); assert.strictEqual(g.mustCover, 'S'); assert.strictEqual(g.current, 0);
  assert.deepStrictEqual(E.legalMoves(g).cards, ['JS']);
  E.playCard(g, 'JS'); assert.strictEqual(g.mustCover, null); assert.strictEqual(g.current, 1);

  const g2 = pos([['8S', '8D', 'JD', '9C'], ['10D']], '9S');
  E.playCard(g2, '8S'); E.playCard(g2, '8D'); assert.strictEqual(g2.mustCover, 'D');
  E.playCard(g2, 'JD'); assert.strictEqual(g2.current, 1);

  const g3 = pos([['8S', '9D'], ['10D']], '9S', { deck: ['7C', '10H', 'QC'] });
  E.playCard(g3, '8S'); const lm = E.legalMoves(g3); assert(lm.canDraw && !lm.cards.length);
  E.draw(g3); assert.strictEqual(g3.drawnCard, 'QC'); assert.strictEqual(g3.players[0].hand.length, 4);
  assert.deepStrictEqual(E.legalMoves(g3).cards, ['QC']);
  E.playCard(g3, 'QC'); assert.strictEqual(g3.phase, 'chooseSuit');
}
// восьмёрка последней картой не заканчивает партию
{
  const g = pos([['8S'], ['10D']], '9S', { deck: ['JS'] });
  E.playCard(g, '8S'); assert.strictEqual(g.phase, 'play'); assert.strictEqual(g.players[0].hand.length, 0);
  E.draw(g); assert.strictEqual(g.drawnCard, 'JS'); E.playCard(g, 'JS');
  assert.strictEqual(g.phase, 'roundEnd'); assert.strictEqual(g.lastRound.results[0].pts, 0);
}
// нечем ходить: взял 1, подходит → можно сыграть или пас
{
  const g = pos([['10D'], ['9D']], '9S', { deck: ['JS'] });
  E.draw(g); assert.deepStrictEqual(E.legalMoves(g).cards, ['JS']); assert(E.legalMoves(g).canPass);
  E.pass(g); assert.strictEqual(g.current, 1);
  // после взятия можно ходить любой подходящей картой, а не только вытянутой
  const g2 = pos([['8C', 'JD'], ['9D']], '8D', { deck: ['8H'] });
  E.draw(g2); assert.deepStrictEqual(E.legalMoves(g2).cards.sort(), ['8C', '8H', 'JD']); assert(E.legalMoves(g2).canPass); assert(!E.legalMoves(g2).canDraw);
  E.playCard(g2, '8C'); assert.strictEqual(g2.mustCover, 'C');
}
// подсчёт: закрыл на даму -20 / пиковую -40; одни дамы +; дамы в смеси по 3; 107 → 0
{
  const g = pos([['QS'], ['QD', 'QH'], ['QC', '10S'], ['AS', 'KH', '9D']], '9S');
  g.players[3].score = 92; // 92 + 11 + 4 + 0 = 107 → 0
  E.playCard(g, 'QS');
  assert.strictEqual(g.phase, 'roundEnd');
  const r = g.lastRound.results;
  assert.strictEqual(r[0].pts, -40); assert.strictEqual(r[1].pts, 40); assert.strictEqual(r[2].pts, 13);
  assert.strictEqual(r[3].pts, 15); assert.strictEqual(r[3].after, 0); assert(r[3].reset);
}
// сброс всех дам сразу: -80 за 4 дамы (с пиковой -100)
{
  const g = pos([['QS', 'QC', 'QD', 'QH'], ['10D']], '9S');
  assert(E.legalMoves(g).canFinishQueens);
  E.finishWithQueens(g); assert.strictEqual(g.lastRound.results[0].pts, -100);
}
// 108 → проигрыш
{
  const g = pos([['10S'], ['AS', 'AD']], '9S');
  g.players[1].score = 90;
  E.playCard(g, '10S'); assert.strictEqual(g.phase, 'gameOver'); assert.deepStrictEqual(g.losers, [1]);
}
// двое перевалили за 108 — проигрывают оба
{
  const g = pos([['10S'], ['AS', 'AD'], ['AC', 'AH']], '9S');
  g.players[1].score = 90; g.players[2].score = 100;
  E.playCard(g, '10S'); assert.deepStrictEqual(g.losers, [1, 2]);
}
// сдаёт лидер по очкам
{
  const g = pos([['10S'], ['9D'], ['9C']], '9S');
  g.players[2].score = 50; g.players[1].score = 20;
  E.playCard(g, '10S'); E.startRound(g);
  assert.strictEqual(g.dealer, 2);
}
// первая карта действует сразу
{
  const seen = {};
  for (let seed = 1; seed < 3000 && Object.keys(seen).length < 5; seed++) {
    const g = mk(3, seed);
    const t = E.top(g);
    const dealer = g.dealer, first = (dealer + 1) % 3;
    if (t.rank === '6' && !seen['6']) { seen['6'] = 1; assert.deepStrictEqual(g.pending, { kind: '6', draws: 1, count: 1 }); assert.strictEqual(g.current, first); }
    if (t.rank === 'A' && !seen.A) { seen.A = 1; assert.strictEqual(g.current, (dealer + 2) % 3); assert.strictEqual(g.phase, 'play'); }
    if (t.rank === 'Q' && !seen.Q) { seen.Q = 1; assert.strictEqual(g.phase, 'chooseSuit'); assert.strictEqual(g.current, dealer); E.chooseSuit(g, 'H'); assert.strictEqual(g.current, first); assert.strictEqual(E.effSuit(g), 'H'); }
    if (t.rank === '8' && !seen['8']) { seen['8'] = 1; assert.strictEqual(g.mustCover, t.suit); assert.strictEqual(g.current, first); }
    if (t.rank === 'K' && t.suit === 'H' && !seen.K) { seen.K = 1; assert.strictEqual(g.pending.draws, 5); assert.strictEqual(g.current, first); }
  }
  assert.strictEqual(Object.keys(seen).length, 5, 'не все варианты первой карты встретились');
}
console.log('все сценарии правил прошли');
// есть только дама — можно взять карту вместо неё
{
  const g = pos([['QD', '8D', '10D'], ['10S']], '9S', { deck: ['7C'] });
  const lm = E.legalMoves(g); assert.deepStrictEqual(lm.cards, ['QD']); assert(lm.canDraw);
  E.draw(g); assert.strictEqual(g.players[0].hand.length, 4); assert.deepStrictEqual(E.legalMoves(g).cards, ['QD']); E.pass(g); assert.strictEqual(g.current, 1);
  const g2 = pos([['QD', '8D', '10S'], ['10D']], '9S');
  assert(E.legalMoves(g2).canDraw); // брать можно всегда
}
console.log('дама и взятие карты — ок');

// ---- последняя карта 6/7/К♥/туз действует: окно выхода ----
(function () {
const E=require('./engine108.js');
const C=(id)=>({id,rank:id.slice(0,-1),suit:id.slice(-1)});
function mk(n,hands,top){ const G=E.createGame({players:Array.from({length:n},(_,i)=>({name:'P'+i})),seed:1}); E.startRound(G); G.discard=[C(top)]; G.current=0; G.pending=null; G.mustCover=null; G.chosenSuit=null; G.phase='play'; G.drawnCard=null; hands.forEach((h,i)=>G.players[i].hand=h.map(C)); return G; }
let G, ok=0, fail=0; const t=(name,c)=>{ if(c){ok++;} else {fail++; console.log('FAIL',name);} };
// 1: 6 последней, цепочка возвращается к вышедшему (3 игрока)
G=mk(3,[['6S'],['6H','10D'],['6C','JD']],'9S');
E.playCard(G,'6S'); t('1a окно',G.finisher===0&&G.phase==='play'&&G.current===1);
E.playCard(G,'6H'); E.playCard(G,'6C'); t('1b ход у вышедшего со штрафом',G.current===0&&G.pending.draws===3);
E.draw(G); if(G.phase==='counterOffer') E.declineCounter(G); t('1c вернулся',G.players[0].hand.length>=3&&G.finisher===null&&G.phase==='play'&&G.current===1);
// 2: 7 последней, следующий берёт → конец, закрыл P0
G=mk(3,[['7S'],['10D'],['JD']],'9S'); E.playCard(G,'7S'); E.draw(G);
t('2 конец после взятия',G.phase==='roundEnd'&&G.lastRound.finisher===0&&G.lastRound.results[1].hand.length===3);
// 3: туз последней, B отбился тузом, C кинул 6 той масти → P0 берёт и возвращается
G=mk(3,[['AS'],['AC','10D'],['6C','JD']],'9S');
E.playCard(G,'AS'); t('3a B под тузом',G.aceTarget&&G.current===1&&E.legalMoves(G).cards.join()==='AC'&&E.legalMoves(G).canPass);
E.playCard(G,'AC'); t('3b C под тузом',G.aceTarget&&G.current===2&&E.legalMoves(G).cards.join()==='6C');
E.playCard(G,'6C'); t('3c штраф у P0',G.current===0&&G.pending&&G.pending.draws===1);
E.draw(G); if(G.phase==='counterOffer') E.declineCounter(G); t('3d P0 вернулся',G.finisher===null&&G.players[0].hand.length>=1&&G.phase==='play');
// 4: туз последней, B пропускает, C ходит обычно, круг доходит до P0 без штрафа → конец
G=mk(3,[['AS'],['10D','JD'],['9D','JC']],'9S');
E.playCard(G,'AS'); E.pass(G); t('4a после пропуска ход у C',G.current===2&&!G.aceTarget&&G.phase==='play');
const lm=E.legalMoves(G); t('4b C ходит по тузу пик',lm.cards.length===0&&lm.canDraw);
E.draw(G); if(G.drawnCard) E.pass(G);
t('4c конец, P0 вышел',G.phase==='roundEnd'&&G.lastRound.finisher===0);
// 5: туз последней, B кинул 10 той же масти, C кинул 6 → P0 берёт (3 игрока)
G=mk(3,[['AS'],['10S','JD'],['6S','JC']],'9S');
E.playCard(G,'AS'); E.playCard(G,'10S'); t('5a игра идёт',G.phase==='play'&&G.current===2&&!G.aceTarget);
E.playCard(G,'6S'); t('5b штраф у P0',G.current===0&&G.pending.draws===1);
// 6: К♥ последней, 9♥ → конец без взятия
G=mk(3,[['KH'],['9H','10D'],['JD']],'10H'); E.playCard(G,'KH'); E.playCard(G,'9H');
t('6 конец после 9♥',G.phase==='roundEnd'&&G.lastRound.finisher===0&&G.lastRound.results[1].hand.length===1);
// 7: К♥ последней, берёт 5 → конец
G=mk(3,[['KH'],['10D'],['JD']],'10H'); E.playCard(G,'KH'); E.draw(G); if(G.phase==='counterOffer') E.declineCounter(G);
t('7 конец после взятия 5',G.phase==='roundEnd'&&G.lastRound.results[1].hand.length===6);
// 8: вышедший под тузом (2 игрока: P0 туз, P1 туз → P0 под тузом) → берёт карту и возвращается
G=mk(2,[['AS'],['AC','10D']],'9S'); E.playCard(G,'AS'); E.playCard(G,'AC');
t('8a P0 под тузом',G.current===0&&G.aceTarget&&E.legalMoves(G).canDraw&&!E.legalMoves(G).canPass);
E.draw(G); t('8b P0 вернулся',G.finisher===null&&G.players[0].hand.length===1);
// 9: обычная последняя карта — конец сразу
G=mk(3,[['10S'],['10D'],['JD']],'9S'); E.playCard(G,'10S'); t('9 обычная карта',G.phase==='roundEnd');
// 10: второй игрок тоже вышел в окне → конец, закрыл первый
G=mk(3,[['6S'],['6H'],['JD','QS']],'9S'); E.playCard(G,'6S'); E.playCard(G,'6H'); t('10 второй вышел',G.phase==='roundEnd'&&G.lastRound.finisher===0);
// 11: симуляция ботов — ничего не ломается
let fin=0; for(let i=0;i<500;i++){ const g=E.createGame({players:[{name:'a',isBot:true},{name:'b',isBot:true},{name:'c',isBot:true,strategy:'greedy'},{name:'d',isBot:true}],seed:i}); E.startRound(g); let n=0; while(g.phase!=='roundEnd'&&g.phase!=='gameOver'&&n<3000){E.botAction(g);n++;} if(n<3000) fin++; }
t('11 симуляция 500 партий',fin===500);
if (fail) { console.log('окно выхода: ошибок', fail); process.exit(1); } console.log('окно выхода: ' + ok + ' проверок — ок');
})();
