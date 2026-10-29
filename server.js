#!/usr/bin/env node
/* ============================================================
   «108» — сервер онлайн-игры: раздаёт статику (108.html, art/, sprites/, sfx/)
   и держит комнаты по WebSocket. Движок правил — engine108.js, тот же, что в браузере.
   Запуск: node server.js   (порт — переменная PORT, по умолчанию 3108)
   Протокол (JSON):
     клиент → сервер: {t:'join', room, name, char, token}   — войти в комнату (room пустой → создать)
                      {t:'addBot'} {t:'removeBot', pid} {t:'level', level} {t:'start'} {t:'next'}
                      {t:'act', a:'play'|'draw'|'pass'|'suit'|'accept'|'decline'|'queens', card, suit}
                      {t:'leave'} {t:'ping'}
     сервер → клиент: {t:'joined', room, token, pid}
                      {t:'lobby', room, players:[{pid,name,char,isBot,online,host}], level, host, started}
                      {t:'state', G:<состояние для этого игрока>, me, seeds, names, phase}
                      {t:'error', msg} {t:'pong'}
   ============================================================ */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const E = require('./engine108.js');

const PORT = process.env.PORT || 3108;
const ROOT = __dirname;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png',
  '.mp3': 'audio/mpeg', '.css': 'text/css', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.md': 'text/plain; charset=utf-8' };
const STATIC_DIRS = ['art', 'sprites', 'sfx'];
const CHARS = ['m01', 'm02', 'm03', 'm04', 'm05', 'm06', 'm07', 'f01', 'f02', 'f03', 'f04', 'f05', 'f06'];
const CHAR_NAMES = { m01: 'Санжар', m02: 'Тимур', m03: 'Рустам', m04: 'Шерзод', m05: 'Азиз', m06: 'Бахтиёр', m07: 'Джавохир',
  f01: 'Дильноза', f02: 'Камила', f03: 'Мадина', f04: 'Нигора', f05: 'Зухра', f06: 'Малика' };
const LEVELS = new Set(['greedy', 'eights', 'pro']);
const MAX_PLAYERS = 6;

// ---------- статика ----------
const server = http.createServer((req, res) => {
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/' || url === '/index.html') url = '/108.html';
  if (url === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  const rel = path.normalize(url).replace(/^(\.\.[\/\\])+/, '');
  const top = rel.split(/[\/\\]/).filter(Boolean)[0];
  const allowed = rel === '/108.html' || rel === '\\108.html' || STATIC_DIRS.includes(top);
  const file = path.join(ROOT, rel);
  if (!allowed || !file.startsWith(ROOT)) { res.writeHead(404); return res.end('not found'); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400' });
    fs.createReadStream(file).pipe(res);
  });
});

// ---------- комнаты ----------
const rooms = new Map();            // code → room
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
function code() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 4; i++) s += A[crypto.randomInt(A.length)]; return rooms.has(s) ? code() : s; }
function makeRoom() {
  const r = { code: code(), players: [], level: 'pro', G: null, botTimer: null, created: Date.now(), lastActive: Date.now() };
  rooms.set(r.code, r); log('room', r.code, 'created'); return r;
}
// игрок: {pid, name, char, isBot, token, ws|null, online}
function send(ws, msg) { if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(msg)); } catch (e) {} } }
function lobbyMsg(r) {
  return { t: 'lobby', room: r.code, level: r.level, started: !!r.G,
    players: r.players.map((p, i) => ({ pid: i, name: p.name, char: p.char, isBot: p.isBot, online: p.isBot || !!(p.ws && p.ws.readyState === 1), host: i === hostIdx(r) })) };
}
function hostIdx(r) { const i = r.players.findIndex(p => !p.isBot && p.ws && p.ws.readyState === 1); return i < 0 ? r.players.findIndex(p => !p.isBot) : i; }
function broadcastLobby(r) { r.players.forEach(p => send(p.ws, lobbyMsg(r))); }
// состояние для конкретного игрока: чужие руки и колода скрыты (только количество)
function maskFor(G, pid) {
  const hide = n => Array.from({ length: n }, (_, i) => ({ id: 'x' + i, rank: '?', suit: '?' }));
  return Object.assign({}, G, {
    deck: hide(G.deck.length), rngState: 0, seed: 0,
    players: G.players.map(p => Object.assign({}, p, { hand: p.id === pid ? p.hand : hide(p.hand.length) })),
    discard: G.discard.slice(-12),                        // верх биты достаточно для показа
    discardCount: G.discard.length,
    // карта-отбой видна только её владельцу
    offerCard: G.current === pid ? G.offerCard : (G.offerCard ? 'hidden' : null),
  });
}
function broadcastState(r) {
  r.players.forEach((p, i) => { if (!p.isBot) send(p.ws, { t: 'state', G: maskFor(r.G, i), me: i, seeds: r.players.map(q => q.char), names: r.players.map(q => q.name) }); });
}
function startGame(r) {
  if (r.players.filter(p => !p.isBot).length < 1 || r.players.length < 2) return;
  r.G = E.createGame({ players: r.players.map(p => ({ name: p.name, isBot: p.isBot, strategy: r.level })) });
  E.startRound(r.G); r.lastActive = Date.now();
  log('room', r.code, 'start', r.players.map(p => p.name + (p.isBot ? '(бот)' : '')).join(', '));
  broadcastLobby(r); broadcastState(r); scheduleBots(r);
}
function nextRound(r) {
  if (!r.G || r.G.phase !== 'roundEnd') return;
  E.startRound(r.G); r.lastActive = Date.now(); broadcastState(r); scheduleBots(r);
}
const ACTIVE = new Set(['play', 'chooseSuit', 'counterOffer']);
function scheduleBots(r) {
  clearTimeout(r.botTimer);
  const G = r.G; if (!G || !ACTIVE.has(G.phase)) return;
  const p = r.players[G.current];
  // отключившийся человек играет как бот, чтобы стол не завис
  const asBot = p.isBot || !(p.ws && p.ws.readyState === 1);
  if (!asBot) return;
  r.botTimer = setTimeout(() => {
    const cur = G.players[G.current], was = cur.isBot; cur.isBot = true;
    try { E.botAction(G); } catch (e) { log('bot error', e.message); }
    cur.isBot = was;
    broadcastState(r); scheduleBots(r);
  }, G.phase === 'play' ? 900 + Math.random() * 500 : 600);
}
function doAction(r, pid, m) {
  const G = r.G; if (!G) return 'Игра не началась';
  if (G.current !== pid) return 'Сейчас не ваш ход';
  try {
    switch (m.a) {
      case 'play': E.playCard(G, m.card); break;
      case 'draw': E.draw(G); break;
      case 'pass': E.pass(G); break;
      case 'suit': E.chooseSuit(G, m.suit); break;
      case 'accept': E.acceptCounter(G); break;
      case 'decline': E.declineCounter(G); break;
      case 'queens': E.finishWithQueens(G); break;
      default: return 'Неизвестное действие';
    }
  } catch (e) { return e.message; }
  r.lastActive = Date.now();
  broadcastState(r); scheduleBots(r);
  return null;
}
function addBot(r) {
  if (r.players.length >= MAX_PLAYERS || r.G) return;
  const used = new Set(r.players.map(p => p.char));
  const free = CHARS.filter(c => !used.has(c));
  const c = free[crypto.randomInt(free.length)] || CHARS[crypto.randomInt(CHARS.length)];
  r.players.push({ name: CHAR_NAMES[c], char: c, isBot: true, token: null, ws: null });
  broadcastLobby(r);
}

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', ws => {
  let room = null, pid = -1;
  ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.t === 'ping') return send(ws, { t: 'pong' });
    if (m.t === 'join') {
      const name = String(m.name || 'Игрок').slice(0, 16).trim() || 'Игрок';
      const char = CHARS.includes(m.char) ? m.char : null;
      let r = m.room ? rooms.get(String(m.room).toUpperCase()) : null;
      if (m.room && !r) return send(ws, { t: 'error', msg: 'Комната ' + String(m.room).toUpperCase() + ' не найдена' });
      if (!r) r = makeRoom();
      // возвращение по токену (перезагрузка страницы, обрыв связи)
      let i = m.token ? r.players.findIndex(p => p.token && p.token === m.token) : -1;
      if (i < 0) {
        if (r.G) return send(ws, { t: 'error', msg: 'Игра в этой комнате уже идёт' });
        if (r.players.length >= MAX_PLAYERS) return send(ws, { t: 'error', msg: 'В комнате уже 6 игроков' });
        const used = new Set(r.players.map(p => p.char));
        const ch = char && !used.has(char) ? char : (CHARS.filter(c => !used.has(c))[0] || CHARS[0]);
        r.players.push({ name, char: ch, isBot: false, token: crypto.randomBytes(12).toString('hex'), ws });
        i = r.players.length - 1;
      } else { r.players[i].ws = ws; if (name) r.players[i].name = name; }
      room = r; pid = i; r.lastActive = Date.now();
      send(ws, { t: 'joined', room: r.code, token: r.players[i].token, pid: i });
      broadcastLobby(r);
      if (r.G) { send(ws, { t: 'state', G: maskFor(r.G, i), me: i, seeds: r.players.map(q => q.char), names: r.players.map(q => q.name) }); scheduleBots(r); }
      log('room', r.code, 'join', name, 'pid', i);
      return;
    }
    if (!room || pid < 0) return send(ws, { t: 'error', msg: 'Сначала войдите в комнату' });
    const r = room, isHost = hostIdx(r) === pid;
    if (m.t === 'addBot') { if (isHost) addBot(r); }
    else if (m.t === 'removeBot') { if (isHost && !r.G && r.players[m.pid] && r.players[m.pid].isBot) { r.players.splice(m.pid, 1); broadcastLobby(r); } }
    else if (m.t === 'level') { if (isHost && LEVELS.has(m.level)) { r.level = m.level; broadcastLobby(r); } }
    else if (m.t === 'start') { if (isHost && !r.G) startGame(r); }
    else if (m.t === 'next') { if (r.G && r.G.phase === 'roundEnd') nextRound(r); }
    else if (m.t === 'newGame') { if (isHost && r.G && r.G.phase === 'gameOver') { r.G = null; broadcastLobby(r); } }
    else if (m.t === 'act') { const err = doAction(r, pid, m); if (err) send(ws, { t: 'error', msg: err }); }
    else if (m.t === 'leave') { leave(); }
  });
  function leave() {
    if (!room || pid < 0) return;
    const r = room, p = r.players[pid];
    if (p && p.ws === ws) p.ws = null;
    if (!r.G) {   // в лобби — убрать совсем
      const idx = r.players.indexOf(p); if (idx >= 0 && !r.G) r.players.splice(idx, 1);
    }
    broadcastLobby(r); if (r.G) scheduleBots(r);
    room = null; pid = -1;
  }
  ws.on('close', () => { if (room && pid >= 0) { const r = room, p = r.players[pid]; if (p && p.ws === ws) p.ws = null; if (!r.G) { const idx = r.players.indexOf(p); if (idx >= 0) r.players.splice(idx, 1); } broadcastLobby(r); if (r.G) scheduleBots(r); } });
});
// heartbeat и уборка пустых комнат
setInterval(() => {
  wss.clients.forEach(ws => { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; try { ws.ping(); } catch (e) {} });
  const now = Date.now();
  for (const [c, r] of rooms) {
    const anyone = r.players.some(p => !p.isBot && p.ws && p.ws.readyState === 1);
    if (!anyone && now - r.lastActive > 30 * 60 * 1000) { clearTimeout(r.botTimer); rooms.delete(c); log('room', c, 'removed'); }
  }
}, 30000);

server.listen(PORT, () => log(`108 server on http://localhost:${PORT}`));
