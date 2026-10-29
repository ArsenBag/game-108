/* ============================================================
   Персонажи «108» — 2D-куклы в SVG с анимацией (SMIL).
   avatar(seed, mood, cls) → HTML. Эмоции: см. MOOD_RIG.
   ============================================================ */
(function (root) {
  'use strict';
  const INK = '#1d1a2e';
  const SKIN = ['#f9c9a3', '#e8b088', '#c98a5b', '#8d5a3b', '#f6d8b8', '#b87c54'];
  const HAIR = ['#2b1d14', '#6b3a1e', '#e0a93c', '#c9402f', '#3b3b7a', '#1d1a2e', '#8c5a2b', '#5a2e8a'];
  const SHIRT = ['#2fa38a', '#ffc93c', '#e03c3c', '#4f7bd9', '#9b59b6', '#f4a261', '#1abc9c', '#ff6b6b'];
  const IRIS = ['#3b6fb6', '#5a3a1e', '#2f8f5b', '#6b4bb3', '#1f6f8b', '#8a5a2b'];
  let REDUCED = false;
  let uid = 0;

  // --- формы рта: всегда M + две кубические кривые + Z, чтобы они морфились друг в друга
  const MOUTH = {
    smile:  'M38 55 C42 53 58 53 62 55 C58 61 42 61 38 55 Z',
    grin:   'M36 52 C42 50 58 50 64 52 C62 69 38 69 36 52 Z',
    laugh2: 'M37 53 C42 51 58 51 63 53 C61 66 39 66 37 53 Z',
    frown:  'M39 60 C43 55 57 55 61 60 C58 60 42 60 39 60 Z',
    wail:   'M40 56 C44 54 56 54 60 56 C58 70 42 70 40 56 Z',
    wail2:  'M41 57 C45 55 55 55 59 57 C57 66 43 66 41 57 Z',
    o:      'M44 53 C46 49 54 49 56 53 C56 64 44 64 44 53 Z',
    flat:   'M40 57 C44 56 56 56 60 57 C56 59 44 59 40 57 Z',
    smirk:  'M38 58 C44 57 56 57 62 52 C58 61 42 62 38 58 Z',
    grit:   'M37 54 C42 53 58 53 63 54 C63 62 37 62 37 54 Z',
    wobble: 'M39 57 C43 53 48 61 61 55 C59 61 46 59 39 57 Z',
    pout:   'M45 57 C47 56 53 56 55 57 C53 61 47 61 45 57 Z',
    talk:   'M40 54 C44 52 56 52 60 54 C58 63 42 63 40 54 Z',
  };

  // --- обратная кинематика руки: плечо S, цель ладони H → [угол плеча, угол локтя] (левая рука)
  const UP = 13, FORE = 14;
  function ik(hx, hy, outward) {
    const sx = 31, sy = 76;
    let dx = hx - sx, dy = hy - sy, dist = Math.hypot(dx, dy);
    const max = UP + FORE - .5;
    if (dist > max) { dx *= max / dist; dy *= max / dist; dist = max; }
    if (dist < 2) { dx = 0; dy = 2; dist = 2; }
    // точка локтя: пересечение окружностей
    const a0 = (UP * UP - FORE * FORE + dist * dist) / (2 * dist);
    const h = Math.sqrt(Math.max(0, UP * UP - a0 * a0));
    const mx = sx + a0 * dx / dist, my = sy + a0 * dy / dist;
    const sgn = outward === false ? -1 : 1;
    const ex = mx + sgn * h * dy / dist, ey = my - sgn * h * dx / dist;   // локоть наружу (влево) по умолчанию
    const ang = (fx, fy) => Math.atan2(-fx, fy) * 180 / Math.PI;           // dir(t) = (-sin t, cos t)
    const a = ang(ex - sx, ey - sy);
    const t = ang(hx - ex, hy - ey);
    let e = t - a; while (e > 180) e -= 360; while (e < -180) e += 360;
    return [Math.round(a * 10) / 10, Math.round(e * 10) / 10];
  }
  // поза: l/r — цель ладони (правая задана в тех же «левых» координатах и зеркалится), w — размах покачивания, in — локоть внутрь
  function pose(l, r, w, dur, opts) {
    const o = opts || {};
    const L = ik(l[0], l[1], !o.lin), Rr = ik(r[0], r[1], !o.rin);
    return { l: [L, [L[0] + w[0], L[1] + w[1]]], r: [Rr, [Rr[0] + (o.rw ? o.rw[0] : w[0]), Rr[1] + (o.rw ? o.rw[1] : w[1])]], dur };
  }
  const HANG = [24, 102];

  // --- риг эмоций ---------------------------------------------------------
  // eyes: open|happy|wide|squint|x|wink|stars|sadclosed|spiral|roll
  // brows: neutral|angry|sad|raised|worried
  // arms: [плечо, локоть] для левой/правой; положительный угол = наружу/вверх
  //   anim: [[от],[до]] — покачивание между позами
  // body: тип движения тела; head: движение головы; mouth: список форм для цикла
  const MOOD_RIG = {
    neutral:    { eyes: 'open',  brows: 'neutral', mouth: ['smile'], body: 'breathe', head: 'sway', arms: pose(HANG, HANG, [4, 3], 3.2) },
    think:      { eyes: 'roll',  brows: 'raised',  mouth: ['flat'], body: 'breathe', head: 'tilt', arms: pose(HANG, [45, 60], [2, 2], 2.2, { rin: true }), extra: 'q' },
    happy:      { eyes: 'happy', brows: 'neutral', mouth: ['smile', 'laugh2'], body: 'hop', head: 'nod', arms: pose([16, 84], [16, 84], [12, -10], .8) },
    laugh:      { eyes: 'happy', brows: 'neutral', mouth: ['grin', 'laugh2'], mouthDur: .3, body: 'bounce', head: 'back', arms: pose([40, 88], [40, 88], [6, -8], .3, { lin: true, rin: true }), extra: 'tear', blush: true },
    party:      { eyes: 'stars', brows: 'raised',  mouth: ['grin', 'laugh2'], mouthDur: .5, body: 'jump', head: 'nod', arms: pose([18, 42], [18, 42], [-18, 14], .5, { rw: [18, -14] }), extra: 'sparkles', blush: true },
    evil:       { eyes: 'squint', brows: 'angry',  mouth: ['smirk', 'grin'], mouthDur: 1, body: 'rock', head: 'sway', arms: pose([44, 82], [44, 82], [3, 6], .35, { lin: true, rin: true, rw: [-3, -6] }), extra: 'horns' },
    smug:       { eyes: 'happy', brows: 'raised',  mouth: ['smirk'], body: 'leanback', head: 'nodslow', arms: pose(HANG, [20, 98], [2, 1], 2, { rin: true }), extra: 'sparkles' },
    sly:        { eyes: 'wink',  brows: 'raised',  mouth: ['smirk'], body: 'breathe', head: 'tilt', arms: pose(HANG, [46, 58], [2, 2], 2, { rin: true }), blush: true },
    excited:    { eyes: 'wide',  brows: 'raised',  mouth: ['grin'], body: 'bounce', head: 'nod', arms: pose([16, 40], [16, 40], [-14, 10], .4, { rw: [14, -10] }), extra: 'sparkles', blush: true },
    pout:       { eyes: 'open',  brows: 'sad',     mouth: ['pout'], body: 'turn', head: 'turn', arms: pose([60, 84], [60, 84], [1, 2], 2.5, { lin: true, rin: true }) },
    sad:        { eyes: 'open',  brows: 'sad',     mouth: ['frown'], body: 'droop', head: 'down', arms: pose([26, 104], [26, 104], [2, 1], 3), extra: 'tear' },
    cry:        { eyes: 'sadclosed', brows: 'sad', mouth: ['wail', 'wail2'], mouthDur: .5, body: 'sob', head: 'down', arms: pose([37, 48], [37, 48], [3, -6], .5, { lin: true, rin: true }), extra: 'tears' },
    devastated: { eyes: 'x',     brows: 'sad',     mouth: ['wail', 'o'], mouthDur: .35, body: 'shake', head: 'back', arms: pose([36, 22], [36, 22], [4, -5], .3), extra: 'tears' },
    angry:      { eyes: 'open',  brows: 'angry',   mouth: ['grit'], body: 'puff', head: 'shake', arms: pose([30, 62], [30, 62], [8, -10], .3, { lin: true, rin: true }), extra: 'anger', blush: true },
    annoyed:    { eyes: 'roll',  brows: 'angry',   mouth: ['flat'], body: 'breathe', head: 'no', arms: pose([60, 84], [60, 84], [1, 1], 2, { lin: true, rin: true }), extra: 'anger' },
    worried:    { eyes: 'wide',  brows: 'worried', mouth: ['wobble', 'o'], mouthDur: .6, body: 'tremble', head: 'tremble', arms: pose([46, 82], [46, 82], [3, 5], .4, { lin: true, rin: true }), extra: 'sweat' },
    nervous:    { eyes: 'open',  brows: 'worried', mouth: ['wobble'], body: 'tremble', head: 'sway', arms: pose(HANG, [34, 24], [2, 2], .6, { rw: [-6, 8] }), extra: 'sweat' },
    meh:        { eyes: 'open',  brows: 'raised',  mouth: ['flat'], body: 'shrug', head: 'tilt', arms: pose([8, 76], [8, 76], [-6, 4], 1.5) },
    shocked:    { eyes: 'wide',  brows: 'raised',  mouth: ['o'], body: 'recoil', head: 'back', arms: pose([33, 55], [33, 55], [2, -3], .15, { lin: true, rin: true }), extra: 'bang' },
    relief:     { eyes: 'happy', brows: 'neutral', mouth: ['smile', 'laugh2'], mouthDur: 1.2, body: 'exhale', head: 'nodslow', arms: pose(HANG, [40, 28], [2, 1], 1.2, { rin: true, rw: [-14, 22] }), extra: 'sweat' },
    overwhelmed:{ eyes: 'spiral', brows: 'sad',    mouth: ['wobble'], body: 'dizzy', head: 'dizzy', arms: pose([6, 66], [6, 66], [10, -6], 1.6, { rw: [-10, 6] }), extra: 'sweat' },
  };

  function anim(attr, values, dur, opts) {
    if (REDUCED) return '';
    const o = Object.assign({ type: null, begin: '0s', repeat: 'indefinite', spline: true, keyTimes: null }, opts || {});
    const n = values.split(';').length;
    const spl = o.spline && n > 1 ? ` calcMode="spline" keySplines="${Array(n - 1).fill('.42 0 .58 1').join(';')}"` : '';
    const kt = o.keyTimes ? ` keyTimes="${o.keyTimes}"` : '';
    if (o.type) return `<animateTransform attributeName="transform" type="${o.type}" values="${values}" dur="${dur}s" begin="${o.begin}" repeatCount="${o.repeat}"${spl}${kt}/>`;
    return `<animate attributeName="${attr}" values="${values}" dur="${dur}s" begin="${o.begin}" repeatCount="${o.repeat}"${spl}${kt}/>`;
  }
  const star = (cx, cy, r, fill) => {
    let d = '';
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(1) + ' ' + (cy + rr * Math.sin(a)).toFixed(1); }
    return `<path d="${d}Z" fill="${fill}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`;
  };
  const spiral = (cx, cy) => {
    let d = '';
    for (let i = 0; i <= 40; i++) { const t = i / 40 * Math.PI * 4, r = 0.4 + t * 1.1; d += (i ? 'L' : 'M') + (cx + r * Math.cos(t)).toFixed(1) + ' ' + (cy + r * Math.sin(t)).toFixed(1); }
    return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
  };

  // --- тело: движения ---------------------------------------------------
  // возвращает {sq: scale-values, tr: translate-values, rot: rotate-values, dur}
  const BODY = {
    breathe:  { sq: '1 1;1.02 .985;1 1', dur: 3.2 },
    hop:      { tr: '0 0;0 -7;0 0', sq: '1 1;1.06 .94;.96 1.06;1 1', dur: .8, rep: 3 },
    bounce:   { tr: '0 0;0 -8;0 0', sq: '1.04 .96;.97 1.05;1.04 .96', dur: .32 },
    jump:     { tr: '0 0;0 2;0 -24;0 -22;0 0;0 0', sq: '1 1;1.15 .82;.9 1.14;.92 1.1;1.18 .8;1 1', dur: .9, keyTimes: '0;.18;.42;.55;.78;1' },
    rock:     { rot: '-6;6;-6', dur: .9 },
    leanback: { rot: '-8;-6;-8', dur: 2 },
    turn:     { rot: '4;6;4', dur: 2.5 },
    droop:    { tr: '0 4;0 6;0 4', rot: '-5;-6;-5', sq: '1 .97;1 .95;1 .97', dur: 3 },
    sob:      { tr: '0 2;0 5;0 2', sq: '1.02 .97;1 1.02;1.02 .97', dur: .5 },
    shake:    { tr: '-3 0;3 -2;-2 1;2 0;-3 0', dur: .22, spline: false },
    puff:     { sq: '1.1 1.08;1.14 1.1;1.1 1.08', tr: '-2 0;2 0;-2 0', dur: .3 },
    tremble:  { tr: '-1.2 0;1.2 .8;-1 -.8;-1.2 0', dur: .16, spline: false },
    shrug:    { tr: '0 0;0 -4;0 0', dur: 1.5 },
    recoil:   { tr: '0 0;0 -14;0 3;0 0', sq: '1 1;.85 1.2;1.2 .85;1 1', dur: .6, rep: 1 },
    exhale:   { sq: '1 1;.94 1.06;1.06 .95;1 1', dur: 1.4, rep: 2 },
    dizzy:    { rot: '-8;8;-8', tr: '-3 0;3 0;-3 0', dur: 1.6 },
  };
  const HEAD = {
    sway:    { rot: '-2.5;2.5;-2.5', dur: 4.6 },
    tilt:    { rot: '-12;-8;-12', dur: 2.4 },
    nod:     { rot: '-6;6;-6', dur: .8 },
    nodslow: { rot: '-4;2;-4', dur: 2 },
    back:    { rot: '-14;-8;-14', dur: .6 },
    down:    { rot: '10;13;10', dur: 2.5 },
    turn:    { rot: '14;17;14', dur: 2.5 },
    shake:   { rot: '-8;8;-8', dur: .25 },
    no:      { rot: '-10;10;-10', dur: 1.1 },
    tremble: { rot: '-2;2;-2', dur: .14, spline: false },
    dizzy:   { rot: '-12;12;-12', dur: 1.6 },
  };

  function eyes(kind, iris, d) {
    const st = `stroke="${INK}" stroke-width="2.6" stroke-linecap="round" fill="none"`;
    const one = (cx, open) => {
      if (!open) return '';
      const wide = kind === 'wide';
      return `<g>
        <ellipse cx="${cx}" cy="42" rx="${wide ? 7.5 : 6.5}" ry="${wide ? 9 : 7.5}" fill="#fff" stroke="${INK}" stroke-width="2.4"/>
        <g class="iris">${anim(null, kind === 'roll' ? '0 -3;1.5 -3.5;-1.5 -3.5;0 -3' : '0 0;0 0;2 .5;2 .5;-1.5 .5;-1.5 .5;0 0', kind === 'roll' ? 2.2 : 7, { type: 'translate', keyTimes: kind === 'roll' ? null : '0;.3;.38;.55;.62;.82;1' })}
          <circle cx="${cx}" cy="43" r="${wide ? 3.2 : 3.8}" fill="${iris}" stroke="${INK}" stroke-width="1.2"/>
          <circle cx="${cx}" cy="43" r="${wide ? 1.6 : 2}" fill="${INK}"/>
          <circle cx="${cx - 1.6}" cy="40.8" r="1.4" fill="#fff"/>
        </g>
        ${kind === 'squint' ? `<path d="M${cx - 8} 33 L${cx + 8} 33 L${cx + 8} 41 Q${cx} 37 ${cx - 8} 42 Z" fill="var(--skin)"/><path d="M${cx - 7.5} 41 Q${cx} 37 ${cx + 7.5} 40.5" ${st}/>` : `<ellipse class="lid" cx="${cx}" cy="34.5" rx="8" ry="0" fill="var(--skin)">${anim('ry', '0;0;9;0;0', 4.4, { keyTimes: '0;.93;.955;.98;1', spline: false, begin: d + 's' })}</ellipse>`}
      </g>`;
    };
    const happy = (cx) => `<path d="M${cx - 6} 44 Q${cx} 36 ${cx + 6} 44" ${st}/>`;
    const sadclosed = (cx) => `<path d="M${cx - 6} 40 Q${cx} 47 ${cx + 6} 40" ${st}/>`;
    const x = (cx) => `<path d="M${cx - 5} 37 L${cx + 5} 47 M${cx + 5} 37 L${cx - 5} 47" ${st}/>`;
    if (kind === 'happy') return happy(40) + happy(60);
    if (kind === 'sadclosed') return sadclosed(40) + sadclosed(60);
    if (kind === 'x') return x(40) + x(60);
    if (kind === 'wink') return happy(40) + one(60, true);
    if (kind === 'stars') return star(40, 42, 7.5, '#ffc93c') + star(60, 42, 7.5, '#ffc93c');
    if (kind === 'spiral') return spiral(40, 42) + spiral(60, 42);
    return one(40, true) + one(60, true);
  }
  function brows(kind) {
    const st = `stroke="${INK}" stroke-width="3" stroke-linecap="round" fill="none"`;
    const map = {
      neutral: ['rotate(0 40 30)', 'rotate(0 60 30)'],
      angry:   ['rotate(16 40 30) translate(0 3)', 'rotate(-16 60 30) translate(0 3)'],
      sad:     ['rotate(-14 40 30) translate(0 1)', 'rotate(14 60 30) translate(0 1)'],
      worried: ['rotate(-20 40 30) translate(0 2)', 'rotate(20 60 30) translate(0 2)'],
      raised:  ['translate(0 -1)', 'translate(0 -4) rotate(-6 60 30)'],
    };
    const [l, r] = map[kind] || map.neutral;
    const pulse = kind === 'angry' ? anim(null, '0 0;0 1;0 0', .3, { type: 'translate' }) : (kind === 'raised' ? anim(null, '0 0;0 -1.5;0 0', 1.8, { type: 'translate' }) : '');
    return `<g transform="${l}"><g>${pulse}<path d="M33 31 Q40 27 47 31" ${st}/></g></g><g transform="${r}"><g>${pulse}<path d="M53 31 Q60 27 67 31" ${st}/></g></g>`;
  }
  function hairBack(style, color) {
    const hs = `fill="${color}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"`;
    if (style === 1) return `<path d="M26 44 C22 10 78 10 74 44 L80 78 Q50 70 20 78 Z" ${hs}/>`;   // длинные
    if (style === 5) return `<path d="M26 44 C24 12 76 12 74 44 L76 62 Q50 58 24 62 Z" ${hs}/>`;   // каре
    return '';
  }
  function hairFront(style, color) {
    const hs = `fill="${color}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"`;
    if (style === 0) return `<path d="M26 40 C26 16 74 14 74 40 L68 32 Q50 20 32 34 Z" ${hs}/>`;                                      // короткие
    if (style === 1) return `<path d="M26 42 C26 14 74 14 74 42 L70 30 Q58 22 50 30 Q40 20 30 34 Z" ${hs}/>`;                          // длинные с пробором
    if (style === 2) return `<path d="M27 38 C28 18 72 18 73 38 Q60 28 50 32 Q40 28 27 38 Z" ${hs}/><circle cx="50" cy="16" r="8" ${hs}/>`; // пучок
    if (style === 3) return `<path d="M26 40 C28 14 72 14 74 40 L66 34 L60 22 L54 34 L48 20 L42 34 L36 24 L30 36 Z" ${hs}/>`;          // ёжик
    if (style === 4) return `<g ${hs}><circle cx="32" cy="28" r="8"/><circle cx="42" cy="20" r="9"/><circle cx="54" cy="18" r="9"/><circle cx="66" cy="24" r="8"/><circle cx="72" cy="36" r="6"/><circle cx="28" cy="38" r="6"/></g>`; // кудри
    return `<path d="M26 44 C26 14 74 14 74 44 L72 38 Q50 30 28 38 Z" ${hs}/>`;                                                        // каре с чёлкой
  }
  function extras(kind, d) {
    const drop = (x, y, h, dur, delay) => `<g>${anim(null, `0 0;0 ${h};0 ${h}`, dur, { type: 'translate', keyTimes: '0;.85;1', begin: delay + 's', spline: false })}<path d="M${x} ${y} q-4 7 0 10 q4.5 -3 0 -10" fill="#6cc5ff" stroke="${INK}" stroke-width="1.5">${anim('opacity', '1;1;0;0', dur, { keyTimes: '0;.7;.85;1', begin: delay + 's', spline: false })}</path></g>`;
    if (kind === 'tear') return drop(34, 48, 10, 1.3, d);
    if (kind === 'tears') return drop(34, 48, 12, 1, d) + drop(66, 48, 12, 1, d - .5);
    if (kind === 'sweat') return drop(76, 28, 10, 2.2, d);
    if (kind === 'anger') return `<g>${anim('opacity', '1;.35;1', .5)}<path d="M78 16 L86 16 M82 12 L82 20 M74 24 L80 24 M77 21 L77 27" stroke="#e03c3c" stroke-width="2.8" stroke-linecap="round"/></g>`;
    if (kind === 'sparkles') return [[16, 22, 5, 0], [86, 18, 4, .3], [84, 56, 3.5, .6]].map(([x, y, r, dl]) => `<g>${anim('opacity', '.3;1;.3', .9, { begin: dl + 's' })}${star(x, y, r, '#ffc93c')}</g>`).join('');
    if (kind === 'horns') return `<g><path d="M24 28 L26 12 L34 26 Z" fill="#e03c3c" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M76 28 L74 12 L66 26 Z" fill="#e03c3c" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/></g>`;
    if (kind === 'q') return `<text x="80" y="22" font-family="Rubik, Arial Black, sans-serif" font-weight="900" font-size="20" fill="#ffc93c" stroke="${INK}" stroke-width="1">?${anim('y', '22;18;22', .9)}</text>`;
    if (kind === 'bang') return `<text x="80" y="22" font-family="Rubik, Arial Black, sans-serif" font-weight="900" font-size="22" fill="#e03c3c" stroke="${INK}" stroke-width="1">!${anim('y', '22;17;22', .5)}</text>`;
    return '';
  }
  // рука: плечо в (0,0); верх руки — рукав, предплечье — кожа, кисть — круг
  function arm(side, pose, skin, shirt, d) {
    const sgn = side === 'l' ? 1 : -1;
    const [a, b] = pose[side];
    const sh = `${sgn * a[0]};${sgn * b[0]};${sgn * a[0]}`, el = `${sgn * a[1]};${sgn * b[1]};${sgn * a[1]}`;
    return `<g transform="rotate(${sgn * a[0]})">${anim(null, sh, pose.dur, { type: 'rotate', begin: d + 's' })}
      <path d="M0 0 L0 13" stroke="${INK}" stroke-width="13.5" stroke-linecap="round"/>
      <path d="M0 0 L0 13" stroke="${shirt}" stroke-width="9.5" stroke-linecap="round"/>
      <g transform="translate(0 13)"><g transform="rotate(${sgn * a[1]})">${anim(null, el, pose.dur, { type: 'rotate', begin: d + 's' })}
        <path d="M0 0 L0 12" stroke="${INK}" stroke-width="11" stroke-linecap="round"/>
        <path d="M0 0 L0 12" stroke="${skin}" stroke-width="7.5" stroke-linecap="round"/>
        <circle cx="0" cy="14" r="5.5" fill="${skin}" stroke="${INK}" stroke-width="2.4"/>
      </g></g>
    </g>`;
  }

  function avatar(seed, mood, cls) {
    mood = MOOD_RIG[mood] ? mood : 'neutral';
    const R = MOOD_RIG[mood];
    const skin = SKIN[seed % SKIN.length], hair = HAIR[(seed * 3 + 1) % HAIR.length], shirt = SHIRT[(seed * 5 + 2) % SHIRT.length], iris = IRIS[(seed * 7) % IRIS.length];
    const style = seed % 6, glasses = seed % 4 === 1, freckles = seed % 5 === 2;
    const d = -((seed * 1.37) % 3.1);
    const id = 'av' + (uid++);
    const B = BODY[R.body] || BODY.breathe, H = HEAD[R.head] || HEAD.sway;
    const rep = B.rep || 'indefinite';
    const bodyAnim = (B.tr ? anim(null, B.tr, B.dur, { type: 'translate', keyTimes: B.keyTimes || null, repeat: rep, spline: B.spline !== false }) : '');
    const sqAnim = (B.sq ? anim(null, B.sq, B.dur, { type: 'scale', keyTimes: B.keyTimes || null, repeat: rep, spline: B.spline !== false }) : '');
    const rotAnim = (B.rot ? anim(null, B.rot.split(';').map(v => v + ' 50 105').join(';'), B.dur, { type: 'rotate', repeat: rep }) : '');
    const headAnim = anim(null, H.rot.split(';').map(v => v + ' 50 66').join(';'), H.dur, { type: 'rotate', spline: H.spline !== false, begin: d + 's' });
    // волосы догоняют голову с небольшой задержкой (вторичное движение)
    const hairAnim = anim(null, H.rot.split(';').map(v => (-(parseFloat(v)) * .35).toFixed(1) + ' 50 40').join(';'), H.dur, { type: 'rotate', spline: H.spline !== false, begin: (d + .12) + 's' });
    const mouthShapes = R.mouth.map(k => MOUTH[k]);
    const mouthAnim = mouthShapes.length > 1 ? anim('d', [...mouthShapes, mouthShapes[0]].join(';'), R.mouthDur || .8) : '';
    const talkAnim = REDUCED ? '' : `<animate class="talk-anim" attributeName="d" values="${mouthShapes[0]};${MOUTH.talk};${mouthShapes[0]};${MOUTH.talk};${mouthShapes[0]};${MOUTH.talk};${mouthShapes[0]}" dur="1.1s" begin="indefinite"/>`;
    return `<div class="ava-wrap ${cls || ''}" data-mood="${mood}" style="--skin:${skin}"><svg class="ava" viewBox="0 0 100 112" aria-hidden="true" data-mood="${mood}">
      <ellipse cx="50" cy="106" rx="22" ry="3.5" fill="rgba(0,0,0,.25)"/>
      <g transform="translate(50 105)"><g>${sqAnim}<g transform="translate(-50 -105)"><g>${bodyAnim}<g>${rotAnim}
        ${hairBack(style, hair)}
        <!-- туловище -->
        <rect x="44" y="58" width="12" height="16" rx="4" fill="${skin}" stroke="${INK}" stroke-width="2.4"/>
        <path d="M30 80 C30 68 70 68 70 80 L72 104 Q50 110 28 104 Z" fill="${shirt}" stroke="${INK}" stroke-width="2.6"/>
        <path d="M44 72 L50 80 L56 72" fill="none" stroke="${INK}" stroke-width="2" opacity=".35"/>
        <!-- голова -->
        <g>${headAnim}
          <circle cx="26" cy="46" r="4.5" fill="${skin}" stroke="${INK}" stroke-width="2.4"/><circle cx="74" cy="46" r="4.5" fill="${skin}" stroke="${INK}" stroke-width="2.4"/>
          <circle cx="50" cy="42" r="24" fill="${skin}" stroke="${INK}" stroke-width="2.6"/>
          ${freckles ? `<g fill="${INK}" opacity=".35"><circle cx="34" cy="50" r="1"/><circle cx="37" cy="53" r="1"/><circle cx="63" cy="51" r="1"/><circle cx="66" cy="54" r="1"/></g>` : ''}
          <circle cx="33" cy="51" r="4" fill="#ff8a8a" opacity="${R.blush ? .9 : .4}"/><circle cx="67" cy="51" r="4" fill="#ff8a8a" opacity="${R.blush ? .9 : .4}"/>
          ${eyes(R.eyes, iris, d)}
          ${glasses ? `<circle cx="40" cy="42" r="9.5" fill="none" stroke="${INK}" stroke-width="2.4"/><circle cx="60" cy="42" r="9.5" fill="none" stroke="${INK}" stroke-width="2.4"/><path d="M49.5 42 L50.5 42" stroke="${INK}" stroke-width="2.4"/>` : ''}
          ${brows(R.brows)}
          <path d="M50 47 Q53 51 49 52" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
          <clipPath id="${id}c"><use href="#${id}m"/></clipPath>
          <path id="${id}m" d="${mouthShapes[0]}" fill="#8e2b2b" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round">${mouthAnim}${talkAnim}</path>
          <g clip-path="url(#${id}c)"><rect x="34" y="48" width="32" height="8" fill="#fff"/><ellipse cx="50" cy="68" rx="9" ry="6" fill="#ff7b8a"/></g>
          ${R.mouth[0] === 'grit' ? `<path d="M42 54 L42 62 M47 54 L47 62 M53 54 L53 62 M58 54 L58 62" stroke="${INK}" stroke-width="1.4" clip-path="url(#${id}c)"/>` : ''}
          <g>${hairAnim}${hairFront(style, hair)}${R.extra === 'horns' ? extras('horns', d) : ''}</g>
        </g>
        <!-- руки поверх всего -->
        <g transform="translate(31 76)">${arm('l', R.arms, skin, shirt, d)}</g>
        <g transform="translate(69 76)">${arm('r', R.arms, skin, shirt, d)}</g>
        ${R.extra && R.extra !== 'horns' ? extras(R.extra, d) : ''}
      </g></g></g></g></g>
    </svg></div>`;
  }

  const api = { avatar, MOOD_RIG, setReduced: v => { REDUCED = !!v; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Avatar108 = api;
})(typeof window !== 'undefined' ? window : globalThis);
