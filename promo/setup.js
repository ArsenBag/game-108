#!/usr/bin/env node
// Сценарий раздачи для рекламного ролика: подбирает «семя оформления», при котором Т♠ и Д♠ выпадают легендами,
// собирает раздачу, проверяет ходы на движке и пишет promo/state.json (сохранённая партия для ?promo=1).
const E = require('../engine108.js');
const fs = require('fs');
function h01(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const LEG = new Set(['QS', 'KH', 'AS', 'JD', 'QH', 'KS', 'AH', 'JC']);
function rar(seed, round, id) {
  const k = seed + ':' + round + ':' + id;
  if (LEG.has(id) && h01(k + ':L') < 0.025) return 'legend';
  const r = h01(k + ':R');
  return r < 0.01 ? 'holo' : r < 0.035 ? 'gold' : r < 0.09 ? 'silver' : '';
}
// ищем семя: обе легенды у меня, семёрка червей золотая, остальные карты сценария без лишних вспышек
let seed = null;
for (let s = 1; s < 50_000_000; s++) {
  if (rar(s, 1, 'QS') !== 'legend' || rar(s, 1, 'AS') !== 'legend') continue;
  if (rar(s, 1, '7H') !== 'gold' || ['holo', 'legend'].includes(rar(s, 1, '7C')) || ['holo', 'legend'].includes(rar(s, 1, '7S')) || ['holo', 'legend'].includes(rar(s, 1, 'AD'))) continue;
  seed = s; break;
}
if (seed == null) throw new Error('seed not found');
console.log('skinSeed', seed);

const players = [{ name: 'Вы', isBot: false }, { name: 'Холида-опа', isBot: false }, { name: 'Алишер-полвон', isBot: false }, { name: 'Гульнара', isBot: false }];
const G = E.createGame({ players, mode: 'classic', seed: 108, skinSeed: seed });
G.dealer = 0;
E.startRound(G);
const all = new Map(); [...G.deck, ...G.discard, ...G.players.flatMap(p => p.hand)].forEach(c => all.set(c.id, c));
const take = ids => ids.map(id => { const c = all.get(id); if (!c) throw new Error('no card ' + id); all.delete(id); return c; });
G.players[0].hand = take(['7D', 'AS', 'QS']);                 // я сдаю: 3 карты, четвёртая открыла стол
G.players[1].hand = take(['7H', '9C', 'JD', '8S']);
G.players[2].hand = take(['7C', 'AD', '6S', 'KC']);
G.players[3].hand = take(['7S', '10D', 'QD', '9H']);
G.discard = take(['10H']);
G.deck = [...all.values()];
G.current = 1; G.pending = null; G.mustCover = null; G.chosenSuit = null; G.drawnCard = null; G.offerCard = null;
G.log = [{ t: 'Партия 1. Сдаёте вы, на столе 10♥.', k: 'info', p: 0 }];
const state0 = JSON.parse(JSON.stringify(G));

// проверка сценария на движке
const steps = [['play', '7H'], ['play', '7C'], ['play', '7S'], ['play', '7D'], ['draw'], ['play', 'AD'], ['play', 'AS'], ['play', '6S'], ['draw'], ['play', 'QS']];
for (const [a, id] of steps) {
  const who = G.current;
  if (a === 'play') E.playCard(G, id); else E.draw(G);
  if (G.phase === 'counterOffer') { E.declineCounter(G); }
  console.log(`${G.players[who].name.padEnd(14)} ${a} ${id || ''} → ход: ${G.players[G.current] ? G.players[G.current].name : '-'}, штраф: ${G.pending ? G.pending.draws : '-'}, фаза: ${G.phase}`);
}
console.log('итог партии:', G.lastRound && G.lastRound.results.map(r => `${G.players[r.idx].name} ${r.pts}`).join(', '));
fs.writeFileSync(__dirname + '/state.json', JSON.stringify({ G: state0, me: 0, myName: 'Вы', avatarSeeds: ['m10', 'f07', 'm13', 'f09'] }));
console.log('state.json ok');
