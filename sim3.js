const E = require('./engine108.js');
function playGame(strats, seed) {
  const g = E.createGame({ players: strats.map((s, i) => ({ name: s + i, isBot: true, strategy: s })), seed });
  E.startRound(g);
  while (g.phase !== 'gameOver') { if (g.phase === 'roundEnd') { E.startRound(g); continue; } E.botAction(g); }
  return g;
}
const base = { points: 1, queenHold: 1, queenDraw: false, eightCover: true, timing: true, suitLong: 1, keepNine: 1, suitChoice: 'long' };
const variants = {
  'дама предпоследней +8 (как было)': {},
  'дама предпоследней -5 (сначала другую карту)': { qLast: -5 },
  'то же, штраф за даму -6':  { qLast: -5, qPen: 6 },
  'то же, штраф за даму -20': { qLast: -5, qPen: 20 },
  'greedy для сравнения':      { queenHold: 0, eightCover: false, timing: false, suitLong: 0, keepNine: 0, suitChoice: 'random' },
};
console.log('вариант'.padEnd(46), 'vs 3 greedy', 'очков/партию');
for (const [label, patch] of Object.entries(variants)) {
  E.STRATEGIES.v = Object.assign({}, base, patch);
  let lost = 0, pts = 0; const N = 4000;
  for (let i = 0; i < N; i++) {
    const seat = i % 4; const strats = ['greedy', 'greedy', 'greedy', 'greedy']; strats[seat] = 'v';
    const g = playGame(strats, 7000 + i);
    if (g.losers.includes(seat)) lost++;
    pts += g.history.reduce((s, h) => s + h.results[seat].pts, 0) / g.history.length;
  }
  console.log(label.padEnd(46), ((100 * lost / N).toFixed(1) + '%').padStart(9), (pts / N).toFixed(1).padStart(12));
}
