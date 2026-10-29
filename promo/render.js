#!/usr/bin/env node
// Рендер кадров ролика: node render.js [out_dir] [fps] [t1,t2,... — только эти моменты]
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = process.argv[2] || __dirname + '/frames_video';
const FPS = +(process.argv[3] || 30);
const ONLY = process.argv[4] ? process.argv[4].split(',').map(Number) : null;
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:3110/promo/stage.html');
  await p.evaluate(() => window.ready);
  const times = ONLY || Array.from({ length: Math.round(30 * FPS) }, (_, i) => i / FPS);
  let k = 0; const T0 = Date.now();
  for (const t of times) {
    await p.evaluate(t => window.renderAt(t), t);
    const name = ONLY ? `t_${t.toFixed(2)}.jpg` : String(k).padStart(4, '0') + '.jpg';
    await p.screenshot({ path: OUT + '/' + name, type: 'jpeg', quality: 93 });
    k++;
    if (!ONLY && k % 90 === 0) console.log('frames', k, ((Date.now() - T0) / 1000).toFixed(0) + 's');
  }
  console.log('done', k, 'errors', errs.slice(0, 5));
  await b.close();
})();
