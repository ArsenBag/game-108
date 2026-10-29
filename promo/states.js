#!/usr/bin/env node
// Тестовые состояния для проверки мобильной раскладки: n игроков, у «меня» k карт, сохранённая партия.
const E = require('../engine108.js');
const fs = require('fs');
const HEROES = ['m10', 'f07', 'm13', 'f09', 'm08', 'f10'];
const NAMES = ['Вы', 'Холида-опа', 'Алишер-полвон', 'Гульнара', 'Ильхом-ака', 'Нилуфар'];
function make(n, myCards, opts = {}) {
  const players = Array.from({ length: n }, (_, i) => ({ name: NAMES[i], isBot: false }));
  const G = E.createGame({ players, mode: opts.mode || 'classic', seed: 7 + n, skinSeed: 3464 });
  G.dealer = n - 1; E.startRound(G);
  // добираем мне карт из колоды
  while (G.players[0].hand.length < myCards && G.deck.length) G.players[0].hand.push(G.deck.pop());
  G.players.forEach((p, i) => { if (i) p.score = [0, 57, 96, 23, 104, 12][i]; });
  G.players[0].score = opts.myScore || 41;
  G.current = 0; G.pending = null; G.mustCover = null; G.phase = 'play'; G.round = 3;
  return { G, me: 0, myName: 'Вы', avatarSeeds: HEROES.slice(0, n) };
}
const out = {
  p2: make(2, 5), p4: make(4, 7), p6: make(6, 9), p6big: make(6, 16, { myScore: 97 }),
};
fs.writeFileSync(__dirname + '/states_test.json', JSON.stringify(out));
console.log(Object.keys(out).join(' '));
