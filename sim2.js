const E = require('./engine108.js');
function playGame(strats, seed) {
  const g = E.createGame({ players: strats.map((s, i) => ({ name: s + i, isBot: true, strategy: s })), seed });
  E.startRound(g);
  while (g.phase !== 'gameOver') { if (g.phase === 'roundEnd') { E.startRound(g); continue; } E.botAction(g); }
  return g;
}
const base = { points: 1, queenHold: 0, queenDraw: false, eightCover: true, timing: true, suitLong: 1, keepNine: 0, suitChoice: 'long' };
const variants = {
  'core (8+масть+момент)':            {},
  'core + держать дам (-12)':         { queenHold: 1 },
  'core + держать дам + девятка':     { queenHold: 1, keepNine: 1 },
  'core + брать вместо дамы (>2 карт)': { queenDraw: true, queenDrawMin: 2 },
  'core + брать вместо дамы (>4 карт)': { queenDraw: true, queenDrawMin: 4 },
  'core + держать дам + брать (>4)':  { queenHold: 1, queenDraw: true, queenDrawMin: 4 },
  'core без момента':                 { timing: false },
  'core без масти':                   { suitLong: 0, suitChoice: 'random' },
};
console.log('вариант'.padEnd(38), 'vs 3 greedy', ' vs 3 core', ' очков/партию');
for (const [label, patch] of Object.entries(variants)) {
  E.STRATEGIES.core = base;
  E.STRATEGIES.v = Object.assign({}, base, patch);
  const res = [];
  for (const opp of ['greedy', 'core']) {
    let lost = 0, pts = 0;
    for (let i = 0; i < 3000; i++) {
      const seat = i % 4; const strats = [opp, opp, opp, opp]; strats[seat] = 'v';
      const g = playGame(strats, 3000 + i);
      if (g.losers.includes(seat)) lost++;
      pts += g.history.reduce((s, h) => s + h.results[seat].pts, 0) / g.history.length;
    }
    res.push((100 * lost / 3000).toFixed(1) + '%', (pts / 3000).toFixed(1));
  }
  console.log(label.padEnd(38), res[0].padStart(9), res[2].padStart(9), res[3].padStart(12));
}
