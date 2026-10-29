#!/usr/bin/env node
// Снимки экранов игры для страницы в Google Play: телефон 390×844 ×3 (1170×2532). Нужен запущенный server.js на :3108.
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = __dirname + '/raw';
fs.mkdirSync(OUT, { recursive: true });
const ALBUM = { 'QS:legend': 1, 'KH:legend': 1, 'AS:legend': 2, 'JD:legend': 1, 'QH:legend': 1, 'AS:holo': 1, '8C:holo': 1, '7H:gold': 2, 'QD:gold': 1, 'KS:gold': 1,
  '9S:silver': 1, '10C:silver': 1, '6H:silver': 1, '7C:silver': 1, 'JH:silver': 1 };
const ACH = {}; ['first_round', 'first_win', 'close_q', 'close_qs', 'reset', 'chain', 'nine', 'big_take', 'daily', 'rare1', 'holo', 'legend', 'historian', 'social'].forEach(k => ACH[k] = 1);
const PROF = { xp: 1340, games: 23, wins: 14, rounds: 168, closes: 41, rares: 37, ach: ACH, stories: { m14: 1, f07: 1, m10: 1, f09: 1, m08: 1, m13: 1, f10: 1 }, coach: {}, places: {}, decks: {}, daily: {} };
(async () => {
  const b = await chromium.launch({ args: ['--force-device-scale-factor=3'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  const p = await ctx.newPage(); p.setDefaultTimeout(8000);
  await p.addInitScript(([album, prof]) => {
    if (sessionStorage.getItem('i')) return; sessionStorage.setItem('i', 1);
    localStorage.clear();
    localStorage.setItem('g108album', JSON.stringify(album)); localStorage.setItem('g108prof', JSON.stringify(prof));
    localStorage.setItem('g108settings', JSON.stringify({ coach: false, sound: false, bg: 'city', deck: 'city' }));
    localStorage.setItem('g108name', 'Арсен'); localStorage.setItem('g108char', 'm10');
  }, [ALBUM, PROF]);
  await p.goto('http://localhost:3108/'); await p.waitForTimeout(2500);
  await p.screenshot({ path: OUT + '/start.png' });
  await p.click('[data-act=album]'); await p.waitForTimeout(800); await p.screenshot({ path: OUT + '/album.png' });
  await p.click('[data-act=close]'); await p.waitForTimeout(800);
  await p.click('[data-act=profile]'); await p.waitForTimeout(800); await p.screenshot({ path: OUT + '/profile.png' });
  await p.click('[data-act=close]'); await p.waitForTimeout(800);
  // онлайн-комната с ботами
  await p.click('[data-act=online]'); await p.waitForTimeout(500);
  await p.click('[data-act=create]'); await p.waitForTimeout(1500);
  for (let i = 0; i < 3; i++) { await p.click('[data-act=bot]'); await p.waitForTimeout(300); }
  await p.waitForTimeout(800); await p.screenshot({ path: OUT + '/lobby.png' });
  console.log('ok', fs.readdirSync(OUT));
  await b.close();
})();
