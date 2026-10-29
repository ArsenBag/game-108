/* ============================================================
   Sprite108 — персонажи из спрайтов SpriteCook.
   Тот же интерфейс, что у Avatar108: avatar(seed, mood, cls) → HTML.
   seed — id героя ('m01'…'f06') или число (берётся по кругу из CHARS).
   Полоска sprites/<id>.webp: 8 ячеек одинакового размера в ряд:
   neutral, laugh, cry, angry, shocked, smug, worried, think.
   Если картинки не грузятся (нет папки sprites/) — Sprite108.ok становится
   false, и page.html переключается на векторный Avatar108.
   ============================================================ */
(function (root) {
  'use strict';
  const BASE = 'sprites/';
  const CELLS = ['neutral', 'laugh', 'cry', 'angry', 'shocked', 'smug', 'worried', 'think'];
  // размеры ячеек (px) — из meta.json нарезки
  const META = {
    m01: { w: 169, h: 256 }, m02: { w: 173, h: 256 }, m03: { w: 195, h: 256 }, m04: { w: 173, h: 256 }, m05: { w: 165, h: 256 },
    m06: { w: 175, h: 256 }, m07: { w: 157, h: 256 }, m08: { w: 164, h: 256 }, m09: { w: 176, h: 256 }, m10: { w: 173, h: 256 },
    m11: { w: 143, h: 256 }, m12: { w: 159, h: 256 }, m13: { w: 196, h: 256 }, m14: { w: 171, h: 256 }, m15: { w: 156, h: 256 },
    f01: { w: 181, h: 256 }, f02: { w: 176, h: 256 }, f03: { w: 176, h: 256 }, f04: { w: 161, h: 256 }, f05: { w: 179, h: 256 },
    f06: { w: 169, h: 256 }, f07: { w: 182, h: 256 }, f08: { w: 165, h: 256 }, f09: { w: 156, h: 256 }, f10: { w: 147, h: 256 },
  };
  const CHARS = Object.keys(META);
  const MALE = CHARS.filter(c => c[0] === 'm'), FEMALE = CHARS.filter(c => c[0] === 'f');
  const LABEL = {
    m01: 'Санжар', m02: 'Тимур', m03: 'Рустам', m04: 'Шерзод', m05: 'Азиз', m06: 'Бахтиёр', m07: 'Джавохир',
    m08: 'Ильхом-ака', m09: 'Равшан', m10: 'MC Шох', m11: 'Фаррух', m12: 'Шавкат-ошпаз', m13: 'Алишер-полвон', m14: 'Турсун-бобо', m15: 'Дядя Вали',
    f01: 'Дильноза', f02: 'Камила', f03: 'Мадина', f04: 'Нигора', f05: 'Зухра', f06: 'Малика',
    f07: 'Холида-опа', f08: 'Лола', f09: 'Гульнара', f10: 'Нилуфар',
  };
  // короткая история каждого героя (показывается при выборе и в лобби)
  const BIO = {
    m01: 'Студент-второкурсник. Играет между парами и верит, что следующая карта — его.',
    m02: 'Барбер с андеркатом. Держит лицо, пока не прилетит семёрка.',
    m03: 'Добрый великан из соседнего подъезда. Злится громко, прощает быстро.',
    m04: 'Программист. Считает карты в уме — и всё равно берёт пять за короля.',
    m05: 'Самый младший за столом. «Йуху-у!» — его боевой клич.',
    m06: 'Дядя, который научил играть весь двор. Знает правила, которых нет в правилах.',
    m07: 'Бариста и философ. Пучок, бородка и вечное «спокойно, всё под контролем».',
    m08: 'Хозяин чайханы. Без пиалы за стол не садится, проиграв — расплёскивает.',
    m09: 'Таксист. Довезёт до 108 быстрее всех — себя или вас.',
    m10: 'Рэпер с цепью-пикой. Читает соперников, но не всегда карты.',
    m11: 'Бизнесмен. Ставит на карты, как на акции, — и так же переживает.',
    m12: 'Мастер плова. Плачет только над луком… и над пиковой дамой.',
    m13: 'Борец кураша. Огромный, сильный и очень ранимый.',
    m14: 'Аксакал. Говорят, играл в 108 ещё в монгольской юрте.',
    m15: 'Старый шулер. Туз в рукаве — не метафора.',
    f01: 'Отличница. Заказывает масть так, будто видит ваши карты.',
    f02: 'Рыжая буря. Хохочет громче всех — особенно над вами.',
    f03: 'Бухгалтер. Ведёт счёт точнее самой игры.',
    f04: 'Капитан волейбольной команды. Ловит семёрки на лету.',
    f05: 'Тихая и вежливая — до первой пиковой дамы.',
    f06: 'Пришла «только посмотреть» тридцать лет назад и до сих пор не ушла.',
    f07: 'Бабушка с золотым зубом. Тапок всегда наготове.',
    f08: 'Блогерша. Снимает сторис каждого вашего штрафа.',
    f09: 'Звезда любой свадьбы. Веер, серьги и смертельный взгляд.',
    f10: 'Геймерша. Для неё 108 — просто ещё один рейтинг.',
  };
  // настроение → [ячейка, css-анимация тела]
  const MOOD = {
    neutral:     ['neutral', 'breathe'],
    think:       ['think',   'tilt'],
    happy:       ['laugh',   'nod'],
    laugh:       ['laugh',   'bounce'],
    party:       ['laugh',   'jump'],
    evil:        ['smug',    'rock'],
    smug:        ['smug',    'leanback'],
    sly:         ['smug',    'tilt'],
    excited:     ['laugh',   'bounce-fast'],
    pout:        ['worried', 'turn'],
    sad:         ['worried', 'droop'],
    cry:         ['cry',     'sob'],
    devastated:  ['cry',     'shake'],
    angry:       ['angry',   'puff'],
    annoyed:     ['angry',   'no'],
    worried:     ['worried', 'tremble'],
    nervous:     ['worried', 'tremble'],
    meh:         ['think',   'shrug'],
    shocked:     ['shocked', 'recoil'],
    relief:      ['neutral', 'exhale'],
    overwhelmed: ['worried', 'dizzy'],
  };
  const MOOD_RIG = {}; Object.keys(MOOD).forEach(k => { MOOD_RIG[k] = { cell: MOOD[k][0], anim: MOOD[k][1] }; });

  let REDUCED = false;
  const api = { ok: true, CHARS, MALE, FEMALE, LABEL, BIO, CELLS, MOOD_RIG, META };

  function charOf(seed) {
    if (typeof seed === 'string' && META[seed]) return seed;
    const n = Math.abs(parseInt(seed, 10) || 0);
    return CHARS[n % CHARS.length];
  }
  function avatar(seed, mood, cls) {
    const id = charOf(seed);
    mood = MOOD[mood] ? mood : 'neutral';
    const [cell, anim] = MOOD[mood];
    const i = CELLS.indexOf(cell), m = META[id];
    const delay = -((CHARS.indexOf(id) * 0.37) % 2.1).toFixed(2);
    return `<div class="ava-wrap sp ${cls || ''}" data-mood="${mood}" data-char="${id}"><div class="sp-shadow"></div>` +
      `<div class="sp-talk"><div class="sp-anim ${REDUCED ? '' : 'an-' + anim}" style="animation-delay:${delay}s">` +
      `<div class="sp-img" style="background-image:url('${BASE}${id}.webp');aspect-ratio:${m.w}/${m.h};background-position-x:${(i * 100 / (CELLS.length - 1)).toFixed(4)}%"></div>` +
      `</div></div></div>`;
  }
  // подгрузить полоски героев заранее; при первой ошибке — запасной режим
  const loaded = {};
  function preload(ids, onFail) {
    (ids || CHARS).forEach(id => {
      id = charOf(id);
      if (loaded[id]) return;
      const im = new Image();
      im.onload = () => { loaded[id] = true; };
      im.onerror = () => { if (api.ok) { api.ok = false; onFail && onFail(id); } };
      im.src = BASE + id + '.webp';
      loaded[id] = 'loading';
    });
  }
  const CSS = `
.ava-wrap.sp { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; }
.sp-talk, .sp-anim { height: 100%; width: 100%; display: flex; justify-content: center; align-items: flex-end; transform-origin: 50% 100%; }
.sp-img { height: 100%; background-repeat: no-repeat; background-size: 800% 100%; image-rendering: auto;
  filter: drop-shadow(2px 3px 0 rgba(29,26,46,.35)); }
.sp-shadow { position: absolute; left: 50%; bottom: -3px; width: 48%; height: 7px; border-radius: 50%; background: rgba(0,0,0,.25); transform: translateX(-50%); }
.sp-talk.talk { animation: sp-talk 1.1s ease-in-out; }
@keyframes sp-talk { 0%,100% { transform: scale(1); } 15% { transform: scale(1.04, .96); } 30% { transform: scale(.98, 1.03); } 45% { transform: scale(1.03, .97); } 60% { transform: scale(.99, 1.02); } 75% { transform: scale(1.02, .98); } }
.an-breathe   { animation: sp-breathe 3.2s ease-in-out infinite; }
.an-tilt      { animation: sp-tilt 2.6s ease-in-out infinite; }
.an-nod       { animation: sp-nod 1.1s ease-in-out infinite; }
.an-bounce    { animation: sp-bounce .55s ease-in-out infinite; }
.an-bounce-fast { animation: sp-bounce .32s ease-in-out infinite; }
.an-jump      { animation: sp-jump .7s cubic-bezier(.34,1.56,.64,1) infinite; }
.an-rock      { animation: sp-rock 1.4s ease-in-out infinite; }
.an-leanback  { animation: sp-leanback 2.4s ease-in-out infinite; }
.an-turn      { animation: sp-turn 2.8s ease-in-out infinite; }
.an-droop     { animation: sp-droop 2.2s ease-in-out infinite; }
.an-sob       { animation: sp-sob .34s ease-in-out infinite; }
.an-shake     { animation: sp-shake .22s linear infinite; }
.an-puff      { animation: sp-puff .5s ease-in-out infinite; }
.an-no        { animation: sp-no 1s ease-in-out infinite; }
.an-tremble   { animation: sp-tremble .12s linear infinite; }
.an-shrug     { animation: sp-shrug 1.8s ease-in-out infinite; }
.an-recoil    { animation: sp-recoil .9s cubic-bezier(.34,1.56,.64,1) 1 both; }
.an-exhale    { animation: sp-exhale 2.2s ease-out 1 both; }
.an-dizzy     { animation: sp-dizzy 1.6s ease-in-out infinite; }
@keyframes sp-breathe { 0%,100% { transform: scale(1, 1); } 50% { transform: scale(1.015, 1.03); } }
@keyframes sp-tilt { 0%,100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
@keyframes sp-nod { 0%,100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(3px) rotate(2deg); } }
@keyframes sp-bounce { 0%,100% { transform: translateY(0) scale(1, 1); } 50% { transform: translateY(-7px) scale(.96, 1.06); } }
@keyframes sp-jump { 0%,100% { transform: translateY(0) scale(1.06, .94); } 50% { transform: translateY(-14px) scale(.94, 1.1); } }
@keyframes sp-rock { 0%,100% { transform: rotate(-5deg) translateY(0); } 50% { transform: rotate(5deg) translateY(-2px); } }
@keyframes sp-leanback { 0%,100% { transform: rotate(0) scale(1); } 50% { transform: rotate(-4deg) scale(1.03) translateY(-2px); } }
@keyframes sp-turn { 0%,100% { transform: rotate(0); } 50% { transform: rotate(7deg) translateX(3px); } }
@keyframes sp-droop { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(4px) scale(.98, .96); } }
@keyframes sp-sob { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-3px) scale(1.02, .98); } }
@keyframes sp-shake { 0%,100% { transform: translateX(-3px) rotate(-2deg); } 50% { transform: translateX(3px) rotate(2deg); } }
@keyframes sp-puff { 0%,100% { transform: scale(1.04) translateX(-2px); } 50% { transform: scale(1.07) translateX(2px); } }
@keyframes sp-no { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-6deg); } 75% { transform: rotate(6deg); } }
@keyframes sp-tremble { 0%,100% { transform: translateX(-1.5px); } 50% { transform: translateX(1.5px); } }
@keyframes sp-shrug { 0%,70%,100% { transform: translateY(0); } 80%,90% { transform: translateY(-5px) scale(1.02, .98); } }
@keyframes sp-recoil { 0% { transform: scale(1.25, .8); } 40% { transform: translateY(-10px) scale(.92, 1.12) rotate(-4deg); } 100% { transform: translateY(0) scale(1); } }
@keyframes sp-exhale { 0% { transform: scale(1.05, 1.08); } 100% { transform: scale(1); } }
@keyframes sp-dizzy { 0%,100% { transform: rotate(-6deg) translateX(-2px); } 50% { transform: rotate(6deg) translateX(2px); } }
`;
  function installCSS() {
    if (typeof document === 'undefined' || document.getElementById('sprite108-css')) return;
    const s = document.createElement('style'); s.id = 'sprite108-css'; s.textContent = CSS; document.head.appendChild(s);
  }
  // запуск «разговора»: небольшой покач тела на время реплики
  function talk(host) {
    const el = host && host.querySelector('.sp-talk'); if (!el || REDUCED) return;
    el.classList.remove('talk'); void el.offsetWidth; el.classList.add('talk');
  }
  Object.assign(api, { avatar, preload, talk, installCSS, charOf, setReduced: v => { REDUCED = !!v; } });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.Sprite108 = api; installCSS(); }
})(typeof window !== 'undefined' ? window : globalThis);
