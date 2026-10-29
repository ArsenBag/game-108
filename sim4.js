const E = require('./engine108.js');
function playGame(strats, seed) {
  const g = E.createGame({ players: strats.map((s, i) => ({ name: s + i, isBot: true, strategy: s })), seed });
  E.startRound(g);
  while (g.phase !== 'gameOver') { if (g.phase === 'roundEnd') { E.startRound(g); continue; } E.botAction(g); }
  return g;
}
const variants = { 'pro (итог)': {}, 'pro без взятия вместо плохого хода': { drawIfBad: null }, 'pro, брать если ход хуже -5': { drawIfBad: -5 } };
for (const [label, patch] of Object.entries(variants)) {
  E.STRATEGIES.v = Object.assign({}, E.STRATEGIES.pro, patch);
  let lost = 0, pts = 0; const N = 4000;
  for (let i = 0; i < N; i++) {
    const seat = i % 4; const strats = ['greedy', 'greedy', 'greedy', 'greedy']; strats[seat] = 'v';
    const g = playGame(strats, 7000 + i);
    if (g.losers.includes(seat)) lost++;
    pts += g.history.reduce((s, h) => s + h.results[seat].pts, 0) / g.history.length;
  }
  console.log(label.padEnd(40), ((100 * lost / N).toFixed(1) + '%').padStart(7), (pts / N).toFixed(1).padStart(8));
}
