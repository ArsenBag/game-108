#!/usr/bin/env node
// Собирает папку www/ для Android-приложения: игра (108.html → index.html), арт, спрайты, звуки, шрифты.
// Исходники SpriteCook (art/src, sprites/sheets) и служебные файлы в приложение не попадают.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'www');
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
fs.copyFileSync(path.join(ROOT, '108.html'), path.join(OUT, 'index.html'));
const keep = { art: /\.(webp|png|jpg)$/, sprites: /\.webp$/, sfx: /\.mp3$/, fonts: /\.woff2$/ };
let n = 0, bytes = 0;
for (const [dir, re] of Object.entries(keep)) {
  fs.mkdirSync(path.join(OUT, dir), { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, dir))) {
    const src = path.join(ROOT, dir, f);
    if (!fs.statSync(src).isFile() || !re.test(f)) continue;
    fs.copyFileSync(src, path.join(OUT, dir, f)); n++; bytes += fs.statSync(src).size;
  }
}
console.log(`www: ${n} файлов, ${(bytes / 1048576).toFixed(1)} МБ`);
