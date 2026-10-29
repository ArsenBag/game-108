#!/usr/bin/env node
// Съёмка геймплея для ролика: телефон 390×844 (×3), сценарий из promo/state.json, кадры CDP-скринкаста с метками времени.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] || __dirname + '/frames_game';
const K = 4;            // замедленная съёмка: страница живёт в K раз медленнее, при сборке ускоряем обратно
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const state = fs.readFileSync(__dirname + '/state.json', 'utf8');
const ACH = ['first_round','first_win','close_q','close_qs','reset','chain','nine','returner','big_take','skipper','closer','elim_win','close_call','daily','rare1','holo','legend','collector','traveler','decks','social','poke','online','historian','stories'];
(async () => {
  const b = await chromium.launch({ args: ['--force-device-scale-factor=3'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.addInitScript(([st, ach]) => {
    localStorage.clear();
    localStorage.setItem('g108save', st);
    localStorage.setItem('g108settings', JSON.stringify({ sound: false, coach: false, bg: 'city', deck: 'city', speed: 'normal', level: 'pro', mode: 'classic' }));
    const a = {}; ach.forEach(k => a[k] = 1);
    localStorage.setItem('g108prof', JSON.stringify({ xp: 640, ach: a, coach: {}, places: { city: 1 }, decks: { city: 1 } }));
  }, [state, ACH]);
  // таймеры, часы и requestAnimationFrame страницы — в K раз медленнее
  await p.addInitScript(K => {
    const pn0 = performance.now.bind(performance), dn0 = Date.now, P0 = pn0(), D0 = dn0();
    performance.now = () => P0 + (pn0() - P0) / K;
    const now = () => D0 + (dn0() - D0) / K;
    const RD = Date;
    function SD(...a) { if (!(this instanceof SD)) return new RD(now()).toString(); return a.length ? new RD(...a) : new RD(now()); }
    SD.prototype = RD.prototype; SD.now = now; SD.parse = RD.parse; SD.UTC = RD.UTC;
    window.Date = SD;
    const st = window.setTimeout.bind(window), si = window.setInterval.bind(window), raf = window.requestAnimationFrame.bind(window);
    window.setTimeout = (f, d, ...a) => st(f, (+d || 0) * K, ...a);
    window.setInterval = (f, d, ...a) => si(f, (+d || 0) * K, ...a);
    window.requestAnimationFrame = cb => raf(t => cb(P0 + (t - P0) / K));
  }, K);
  await p.goto('http://localhost:3108/?promo=1');
  await p.waitForFunction(() => window.__promo && document.querySelector('#hand .card'));
  await p.waitForTimeout(2500 * K);                              // спрайты, фон, шрифты
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / K });
  const frames = []; let n = 0;
  cdp.on('Page.screencastFrame', async f => {
    const name = String(n++).padStart(5, '0') + '.jpg';
    fs.writeFileSync(OUT + '/' + name, Buffer.from(f.data, 'base64'));
    frames.push([f.metadata.timestamp, name]);
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  const events = []; const T0 = Date.now() / 1000;
  const ev = (k) => events.push([Date.now() / 1000, k]);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 1170, maxHeight: 2532, everyNthFrame: 1 });
  await p.waitForTimeout(300 * K);
  ev('deal'); await p.evaluate(() => { window.__promo.animateDeal(); });
  const wait = ms => p.waitForTimeout(ms * K);
  const play = async (id, k) => { ev(k || 'play:' + id); await p.evaluate(id => window.__promo.play(id), id); };
  const draw = async (k) => { ev(k || 'draw'); await p.evaluate(() => window.__promo.draw()); };
  await wait(3000);
  await play('7H', 'take2'); await wait(1150);
  await play('7C', 'chain2'); await wait(1150);
  await play('7S', 'chain3'); await wait(1250);
  await play('7D', 'chain4'); await wait(1500);
  await draw('take8'); await wait(1900);
  await play('AD', 'skip'); await wait(1200);
  await play('AS', 'legendAS'); await wait(1400);
  await play('6S', 'take1'); await wait(1100);
  await draw('draw1'); await wait(1200);
  await play('QS', 'queen40'); await wait(3200);
  await cdp.send('Page.stopScreencast');
  await wait(300);
  // время кадров и событий — в «игровых» секундах от первого кадра
  const f0 = frames[0][0];
  const gf = frames.map(([t, nm]) => [+((t - f0) / K).toFixed(4), nm]);
  const ge = events.map(([t, k]) => [+((t - f0) / K).toFixed(4), k]);
  fs.writeFileSync(OUT + '/index.json', JSON.stringify({ frames: gf, events: ge }));
  const gaps = gf.slice(1).map((f, i) => f[0] - gf[i][0]);
  console.log('frames', gf.length, 'game duration', gf[gf.length - 1][0].toFixed(2), 'fps', (gf.length / gf[gf.length - 1][0]).toFixed(1), 'max gap', Math.max(...gaps).toFixed(3), 'errors', errs);
  await b.close();
})();
