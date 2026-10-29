// Сравнение стратегий ботов: кто реже проигрывает и сколько очков набирает за партию.
const E = require('./engine108.js');
const names = Object.keys(E.STRATEGIES);

function playGame(strats, seed) {
  const g = E.createGame({ players: strats.map((s, i) => ({ name: s + i, isBot: true, strategy: s })), seed });
  E.startRound(g);
  let steps = 0;
  while (g.phase !== 'gameOver') {
    if (g.phase === 'roundEnd') { E.startRound(g); continue; }
    E.botAction(g); if (++steps > 200000) throw new Error('loop');
  }
  const ptsPerRound = g.players.map((p, i) => g.history.reduce((s, h) => s + h.results[i].pts, 0) / g.history.length);
  return { losers: g.losers, rounds: g.round, ptsPerRound };
}

function table(rows, cols) {
  const w = cols.map((c, j) => Math.max(c.length, ...rows.map(r => String(r[j]).length)));
  const line = r => r.map((v, j) => String(v).padEnd(w[j])).join('  ');
  console.log(line(cols)); console.log(w.map(x => '-'.repeat(x)).join('  ')); rows.forEach(r => console.log(line(r)));
}

// 1. Каждая стратегия в одиночку против трёх «жадных» (сбрасывают самое дорогое, дамы тратят как обычные карты)
console.log('\n== 1. Стратегия против трёх greedy, стол на 4, 2000 игр, место за столом меняется ==');
let rows = [];
for (const s of names) {
  let games = 0, lost = 0, pts = 0, rounds = 0;
  for (let i = 0; i < 2000; i++) {
    const seat = i % 4;
    const strats = ['greedy', 'greedy', 'greedy', 'greedy']; strats[seat] = s;
    const r = playGame(strats, 1000 + i);
    games++; if (r.losers.includes(seat)) lost++; pts += r.ptsPerRound[seat]; rounds += r.rounds;
  }
  rows.push([s, (100 * lost / games).toFixed(1) + '%', (pts / games).toFixed(1), (rounds / games).toFixed(1)]);
}
table(rows, ['стратегия', 'проигрыш', 'очков/партию', 'партий в игре']);
console.log('(ожидание при равной силе: 25% проигрышей)');

// 2. Все семь вперемешку: случайные столы на 4, 6000 игр
console.log('\n== 2. Случайные столы на 4 из всех стратегий, 6000 игр ==');
const stat = Object.fromEntries(names.map(n => [n, { g: 0, l: 0, p: 0 }]));
let rng = 7;
const rand = () => { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng / 0x7fffffff; };
for (let i = 0; i < 6000; i++) {
  const strats = Array.from({ length: 4 }, () => names[Math.floor(rand() * names.length)]);
  const r = playGame(strats, 50000 + i);
  strats.forEach((s, seat) => { stat[s].g++; if (r.losers.includes(seat)) stat[s].l++; stat[s].p += r.ptsPerRound[seat]; });
}
rows = names.map(n => [n, (100 * stat[n].l / stat[n].g).toFixed(1) + '%', (stat[n].p / stat[n].g).toFixed(1), stat[n].g]);
rows.sort((a, b) => parseFloat(a[1]) - parseFloat(b[1]));
table(rows, ['стратегия', 'проигрыш', 'очков/партию', 'игр']);

// 3. Один на один: pro против каждой, 2000 игр
console.log('\n== 3. Один на один: pro против каждой стратегии, 2000 игр ==');
rows = [];
for (const s of names.filter(n => n !== 'pro')) {
  let lost = 0, both = 0;
  for (let i = 0; i < 2000; i++) {
    const seat = i % 2; const strats = [s, s]; strats[seat] = 'pro';
    const r = playGame(strats, 90000 + i);
    if (r.losers.includes(seat)) { if (r.losers.length > 1) both++; else lost++; }
  }
  rows.push([s, (100 * lost / 2000).toFixed(1) + '%', (100 * both / 2000).toFixed(1) + '%']);
}
table(rows, ['соперник', 'pro проиграл', 'проиграли оба']);

// 4. Что даёт каждый приём, если убрать его из pro (абляция), против трёх greedy
console.log('\n== 4. pro без одного приёма, против трёх greedy, 2000 игр ==');
const pro = E.STRATEGIES.pro;
const ablations = {
  'без бережения дам': { queenHold: 0, queenDraw: false, keepNine: 0 },
  'без выбора момента для 6/7/К♥/туза': { timing: false },
  'без контроля восьмёрок': { eightCover: false },
  'без длинной масти': { suitLong: 0, suitChoice: 'random' },
};
rows = [];
for (const [label, patch] of Object.entries(ablations)) {
  E.STRATEGIES.ablate = Object.assign({}, pro, patch);
  let lost = 0, pts = 0;
  for (let i = 0; i < 2000; i++) {
    const seat = i % 4; const strats = ['greedy', 'greedy', 'greedy', 'greedy']; strats[seat] = 'ablate';
    const r = playGame(strats, 1000 + i);
    if (r.losers.includes(seat)) lost++; pts += r.ptsPerRound[seat];
  }
  rows.push([label, (100 * lost / 2000).toFixed(1) + '%', (pts / 2000).toFixed(1)]);
}
delete E.STRATEGIES.ablate;
table(rows, ['вариант', 'проигрыш', 'очков/партию']);
