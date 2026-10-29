/* ============================================================
   «108» — движок правил. Чистый JS, без DOM: работает и в
   браузере, и в Node (для сервера / автотестов).
   ============================================================ */
(function (root) {
  'use strict';

  const SUITS = ['S', 'C', 'D', 'H'];                 // ♠ ♣ ♦ ♥
  const RANKS = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const POINTS = { '6': 6, '7': 7, '8': 8, '9': 0, '10': 10, 'J': 2, 'Q': 3, 'K': 4, 'A': 11 };
  const SUIT_SYM = { S: '♠', C: '♣', D: '♦', H: '♥' };
  const SUIT_RU = { S: 'пики', C: 'трефы', D: 'бубны', H: 'червы' };
  const RANK_RU = { '6': '6', '7': '7', '8': '8', '9': '9', '10': '10', J: 'В', Q: 'Д', K: 'К', A: 'Т' };
  const TARGET = 108;
  const RESET_AT = 107;

  // --- утилиты ------------------------------------------------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function makeDeck() {
    const d = [];
    for (const s of SUITS) for (const r of RANKS) d.push({ id: r + s, rank: r, suit: s });
    return d;
  }
  function shuffle(arr, rnd) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  function cardName(c) { return RANK_RU[c.rank] + SUIT_SYM[c.suit]; }
  function isQ(c) { return c.rank === 'Q'; }
  function queenFinishValue(c) { return c.suit === 'S' ? 40 : 20; }
  function counters(pending, c) {
    // после четырёх шестёрок/семёрок цепочка закрыта: отбиваться больше нечем
    if (pending.count >= 4) return false;
    if (pending.kind === '6') return c.rank === '6';
    if (pending.kind === '7') return c.rank === '7';
    if (pending.kind === 'K') return c.rank === '9' && c.suit === 'H';
    return false;
  }
  function covers(suit, c) { return c.suit === suit || c.rank === 'Q' || c.rank === '8'; }

  // --- создание игры ------------------------------------------
  function createGame(opts) {
    const players = opts.players.map((p, i) => ({
      id: i, name: p.name, isBot: !!p.isBot, strategy: p.strategy || 'pro', hand: [], score: 0, out: false,
    }));
    const seed = opts.seed == null ? (Math.random() * 2 ** 31) | 0 : opts.seed;
    return {
      seed, rngState: seed,
      players,
      deck: [], discard: [],
      round: 0,
      dealer: players.length - 1,
      current: 0,
      phase: 'lobby',         // lobby | play | chooseSuit | counterOffer | roundEnd | gameOver
      chosenSuit: null,       // масть, заказанная дамой
      pending: null,          // {kind:'6'|'7'|'K', draws:n} — штраф, который нужно отбить или взять
      mustCover: null,        // масть восьмёрки, которую обязан покрыть текущий игрок
      drawnCard: null,        // id карты, взятой в этот ход (единственная, которой можно сыграть)
      offerCard: null,        // id вытянутой карты-отбоя при взятии штрафа
      finisher: null,         // кто выложил последнюю карту, но его карта ещё «действует» (6/7/К♥/туз) — партия не закончена
      finishCards: null,      // чем он закрыл (для подсчёта дам)
      aceTarget: false,       // текущий игрок «под тузом» вышедшего: может отбиться тузом или картой той же масти либо пропустить
      mode: opts.mode === 'elim' ? 'elim' : 'classic',   // classic — первый, кто набрал 108, проиграл; elim — набравший 108 выбывает, играют до последнего
      winner: null, eliminated: [],                      // elim: победитель и порядок выбывания
      lastRound: null, losers: null,
      history: [],
      log: [],
    };
  }

  function rnd(state) {
    // детерминированный генератор, состояние сохраняется в state
    const f = mulberry32(state.rngState);
    const v = f();
    state.rngState = (state.rngState + 0x6D2B79F5) | 0;
    return v;
  }
  function log(state, text, kind) {
    state.log.push({ t: text, k: kind || 'info', p: state.current });
    if (state.log.length > 60) state.log.shift();
  }
  function cur(state) { return state.players[state.current]; }
  function top(state) { return state.discard[state.discard.length - 1]; }
  function effSuit(state) {
    const t = top(state);
    return (t.rank === 'Q' && state.chosenSuit) ? state.chosenSuit : t.suit;
  }
  // следующий игрок за столом; выбывшие (режим на выбывание) пропускаются
  function nextIdx(state, i) {
    const n = state.players.length;
    for (let k = 1; k <= n; k++) { const j = (i + k) % n; if (!state.players[j].out) return j; }
    return i;
  }
  function prevIdx(state, i) {
    const n = state.players.length;
    for (let k = 1; k <= n; k++) { const j = (i - k + n) % n; if (!state.players[j].out) return j; }
    return i;
  }
  const activePlayers = state => state.players.filter(p => !p.out);
  function findInHand(p, id) { return p.hand.find(c => c.id === id); }
  function removeFromHand(p, id) {
    const i = p.hand.findIndex(c => c.id === id);
    return i >= 0 ? p.hand.splice(i, 1)[0] : null;
  }

  // --- раздача ------------------------------------------------
  function startRound(state) {
    state.round += 1;
    if (state.round > 1) {
      // сдаёт тот, у кого больше всего очков; при равенстве — прежний сдающий, если он среди лидеров
      const act = activePlayers(state);
      const mx = Math.max(...act.map(p => p.score));
      const leaders = act.filter(p => p.score === mx).map(p => p.id);
      state.dealer = leaders.includes(state.dealer) ? state.dealer : leaders[0];
    }
    if (state.players[state.dealer].out) state.dealer = nextIdx(state, state.dealer);
    const n = activePlayers(state).length;
    state.deck = shuffle(makeDeck(), () => rnd(state));
    state.discard = [];
    state.players.forEach(p => { p.hand = []; });
    state.chosenSuit = null; state.pending = null; state.mustCover = null;
    state.drawnCard = null; state.offerCard = null;
    state.finisher = null; state.finishCards = null; state.aceTarget = false;
    state.lastRound = null; state.losers = null; state.eliminatedNow = [];
    state.log = [];
    // по одной карте по кругу, начиная с игрока после сдающего; сдающему 4-я карта идёт на стол
    let seat = nextIdx(state, state.dealer);
    for (let k = 0; k < 4 * n; k++) {
      const c = state.deck.pop();
      if (seat === state.dealer && k === 4 * n - 1) state.discard.push(c);
      else state.players[seat].hand.push(c);
      seat = nextIdx(state, seat);
    }
    state.phase = 'play';
    const opener = top(state);
    log(state, `Партия ${state.round}. Сдаёт ${state.players[state.dealer].name}, на столе ${cardName(opener)}.`);
    // первая карта действует как сыгранная сдающим
    state.current = state.dealer;
    if (opener.rank === '8') {
      state.mustCover = opener.suit;
      state.current = nextIdx(state, state.dealer);
      log(state, `${cur(state).name} должен покрыть восьмёрку: ${SUIT_RU[opener.suit]}.`, 'play');
    } else {
      applyEffects(state, opener, false, null);
    }
    return state;
  }

  // --- что можно делать ---------------------------------------
  function canPlayOn(state, c) {
    const t = top(state);
    return c.rank === 'Q' || c.rank === t.rank || c.suit === effSuit(state);
  }
  function legalMoves(state) {
    const res = { cards: [], canDraw: false, canPass: false, canFinishQueens: false, drawLabel: 'Взять карту' };
    if (state.phase !== 'play') return res;
    const p = cur(state);
    if (state.mustCover) {
      if (state.drawnCard) res.cards = [state.drawnCard];
      else {
        res.cards = p.hand.filter(c => covers(state.mustCover, c)).map(c => c.id);
        if (!res.cards.length) { res.canDraw = true; res.drawLabel = 'Тянуть до покрытия'; }
      }
      return res;
    }
    if (state.pending) {
      res.cards = p.hand.filter(c => counters(state.pending, c)).map(c => c.id);
      res.canDraw = true;
      res.drawLabel = `Взять ${state.pending.draws}`;
      return res;
    }
    if (state.aceTarget) {
      // под тузом: отбиться тузом или картой той же масти — или пропустить ход; вышедший (без карт) обязан взять карту
      if (state.finisher === state.current) { res.canDraw = true; res.drawLabel = 'Взять карту'; return res; }
      res.cards = p.hand.filter(c => c.rank === 'A' || c.suit === top(state).suit).map(c => c.id);
      res.canPass = true; res.passLabel = 'Пропустить ход';
      return res;
    }
    if (state.drawnCard) {
      // после взятия карты: любой подходящий ход из руки или пас
      res.cards = p.hand.filter(c => canPlayOn(state, c)).map(c => c.id);
      res.canPass = true;
      return res;
    }
    res.cards = p.hand.filter(c => canPlayOn(state, c)).map(c => c.id);
    res.canDraw = true; // в обычный ход всегда можно взять карту вместо хода
    res.canFinishQueens = p.hand.length >= 2 && p.hand.every(isQ);
    return res;
  }

  // --- ходы ---------------------------------------------------
  function advance(state, skip) {
    state.drawnCard = null;
    state.aceTarget = false;
    state.current = nextIdx(state, state.current);
    if (skip) state.current = nextIdx(state, state.current);
    state.phase = 'play';
    if (state.finisher != null) resolveFinisher(state);
  }
  // ход дошёл до того, кто выложил последнюю карту: со штрафом — берёт и возвращается, без — вышел
  function resolveFinisher(state) {
    const f = state.finisher;
    if (state.current !== f) return;
    if (state.pending) {
      log(state, `Штраф вернулся к ${state.players[f].name} — он снова в игре.`, 'info');
      return;                                   // берёт штраф обычным ходом (draw), после этого finisher снимается
    }
    if (state.aceTarget) {
      log(state, `${state.players[f].name} под тузом — должен взять карту и снова в игре.`, 'info');
      return;                                   // берёт карту (draw), после этого finisher снимается
    }
    log(state, `${state.players[f].name} вышел.`, 'end');
    endRound(state, f, state.finishCards || []);
  }
  // штраф взят / отбит — если это не вышедший, партия закончена
  function settleAfterPenalty(state, takerIdx) {
    if (state.finisher == null) return false;
    if (takerIdx === state.finisher) { state.finisher = null; state.finishCards = null; return false; }
    log(state, `${state.players[state.finisher].name} вышел.`, 'end');
    endRound(state, state.finisher, state.finishCards || []);
    return true;
  }

  function playCard(state, cardId) {
    const lm = legalMoves(state);
    if (!lm.cards.includes(cardId)) throw new Error('Нельзя сыграть эту карту: ' + cardId);
    const p = cur(state);
    const c = removeFromHand(p, cardId);
    state.discard.push(c);
    state.chosenSuit = null;
    state.drawnCard = null;
    const wasCovering = !!state.mustCover;
    state.mustCover = null;
    const wasPending = state.pending;

    if (c.rank === '8') {
      state.mustCover = c.suit;
      log(state, `${p.name}: ${cardName(c)}${wasCovering ? ' (покрыл восьмёрку восьмёркой)' : ''} — нужно покрыть ${SUIT_RU[c.suit]}.`, 'play');
      return state; // ход остаётся у игрока
    }
    if (p.hand.length === 0) {
      if (state.finisher != null) {             // второй игрок тоже вышел — партия закончена, закрыл первый
        log(state, `${p.name} выложил последнюю карту — ${cardName(c)}.`, 'end');
        return endRound(state, state.finisher, state.finishCards || []);
      }
      const acts = c.rank === '6' || c.rank === '7' || c.rank === 'A' || (c.rank === 'K' && c.suit === 'H');
      if (!acts) {
        log(state, `${p.name} выложил последнюю карту — ${cardName(c)}.`, 'end');
        return endRound(state, state.current, [c]);
      }
      // карта действует: партия продолжается, пока её не отобьют или штраф не возьмут
      state.finisher = state.current; state.finishCards = [c];
      log(state, `${p.name} выложил последнюю карту — ${cardName(c)}, но она действует!`, 'end');
      applyEffects(state, c, wasCovering, wasPending);
      return state;
    }
    applyEffects(state, c, wasCovering, wasPending);
    return state;
  }

  // эффект карты c, только что положенной текущим игроком (не восьмёрки и не последней)
  function applyEffects(state, c, wasCovering, wasPending) {
    const p = cur(state);
    if (c.rank === 'Q') {
      log(state, `${p.name}: ${cardName(c)} — заказывает масть.`, 'play');
      state.phase = 'chooseSuit';
      return state;
    }
    let skip = false;
    if (c.rank === '6') {
      state.pending = { kind: '6', draws: (wasPending ? wasPending.draws : 0) + 1, count: (wasPending ? wasPending.count : 0) + 1 };
      log(state, `${p.name}: ${cardName(c)} — следующий берёт ${state.pending.draws} или отбивается шестёркой.`, 'play');
    } else if (c.rank === '7') {
      state.pending = { kind: '7', draws: (wasPending ? wasPending.draws : 0) + 2, count: (wasPending ? wasPending.count : 0) + 1 };
      log(state, `${p.name}: ${cardName(c)} — следующий берёт ${state.pending.draws} или отбивается семёркой.`, 'play');
    } else if (c.rank === 'K' && c.suit === 'H') {
      state.pending = { kind: 'K', draws: 5, count: 1 };
      log(state, `${p.name}: ${cardName(c)} — следующий берёт 5 или отбивается 9♥.`, 'play');
    } else if (wasPending && wasPending.kind === 'K' && c.rank === '9' && c.suit === 'H') {
      state.pending = null;
      log(state, `${p.name}: ${cardName(c)} — отбил короля червей.`, 'play');
      if (settleAfterPenalty(state, state.current)) return state;
    } else if (c.rank === 'A' && state.finisher != null) {
      const nx = state.players[nextIdx(state, state.current)];
      log(state, `${p.name}: ${cardName(c)} — ${nx.name} под тузом: отбиться тузом или картой ${SUIT_RU[c.suit]}, либо пропустить.`, 'play');
      state.drawnCard = null; state.aceTarget = false; state.current = nextIdx(state, state.current); state.phase = 'play'; state.aceTarget = true;
      resolveFinisher(state);
      return state;
    } else if (c.rank === 'A') {
      skip = true;
      log(state, `${p.name}: ${cardName(c)} — ${state.players[nextIdx(state, state.current)].name} пропускает ход.`, 'play');
    } else {
      log(state, `${p.name}: ${cardName(c)}${wasCovering ? ' — восьмёрка покрыта' : ''}.`, 'play');
    }
    advance(state, skip);
    return state;
  }

  function chooseSuit(state, suit) {
    if (state.phase !== 'chooseSuit') throw new Error('Сейчас нельзя заказывать масть');
    if (!SUITS.includes(suit)) throw new Error('Нет такой масти');
    state.chosenSuit = suit;
    log(state, `${cur(state).name} заказал ${SUIT_RU[suit]} ${SUIT_SYM[suit]}.`, 'play');
    advance(state, false);
    return state;
  }

  function finishWithQueens(state) {
    const lm = legalMoves(state);
    if (!lm.canFinishQueens) throw new Error('Нельзя закончить дамами');
    const p = cur(state);
    const cards = p.hand.splice(0, p.hand.length);
    cards.forEach(c => state.discard.push(c));
    log(state, `${p.name} сбросил всех дам: ${cards.map(cardName).join(' ')}.`, 'end');
    return endRound(state, state.current, cards);
  }

  function drawOne(state) {
    if (!state.deck.length) {
      if (state.discard.length <= 1) return null;
      const t = state.discard.pop();
      state.deck = shuffle(state.discard, () => rnd(state));
      state.discard = [t];
      log(state, 'Колода кончилась — бито перетасовано.', 'info');
    }
    return state.deck.pop();
  }

  function draw(state) {
    const lm = legalMoves(state);
    if (!lm.canDraw) throw new Error('Сейчас нельзя брать');
    const p = cur(state);

    if (state.mustCover) {
      let n = 0;
      for (;;) {
        const c = drawOne(state);
        if (!c) { // карты кончились — снимаем обязанность
          log(state, `${p.name}: карт больше нет, восьмёрка остаётся непокрытой.`, 'info');
          state.mustCover = null; advance(state, false); return state;
        }
        p.hand.push(c); n++;
        if (covers(state.mustCover, c)) {
          state.drawnCard = c.id;
          log(state, `${p.name} тянул ${n} ${plural(n)} и достал ${cardName(c)} — покрывает.`, 'draw');
          return state;
        }
      }
    }

    if (state.aceTarget) {
      const c = drawOne(state);
      state.aceTarget = false;
      if (state.finisher === state.current) { state.finisher = null; state.finishCards = null; log(state, `${p.name} снова в игре.`, 'info'); }
      if (!c) { advance(state, false); return state; }
      p.hand.push(c);
      if (c.rank === 'A' || c.suit === top(state).suit) { state.drawnCard = c.id; log(state, `${p.name} взял карту — ${cardName(c)}, можно покрыть туза.`, 'draw'); }
      else { log(state, `${p.name} взял карту, ход переходит.`, 'draw'); advance(state, false); }
      return state;
    }
    if (state.pending) {
      const c = drawOne(state);
      if (!c) { state.pending = null; if (settleAfterPenalty(state, state.current)) return state; advance(state, false); return state; }
      p.hand.push(c);
      if (counters(state.pending, c)) {
        state.offerCard = c.id;
        state.phase = 'counterOffer';
        log(state, `${p.name} тянет карту — ${cardName(c)}! Можно отбиться.`, 'draw');
        return state;
      }
      const rest = state.pending.draws - 1;
      for (let i = 0; i < rest; i++) { const d = drawOne(state); if (d) p.hand.push(d); }
      log(state, `${p.name} взял ${state.pending.draws} ${plural(state.pending.draws)}.`, 'draw');
      state.pending = null;
      if (settleAfterPenalty(state, state.current)) return state;
      advance(state, false);
      return state;
    }

    const c = drawOne(state);
    if (!c) { advance(state, false); return state; }
    p.hand.push(c);
    state.drawnCard = c.id;
    if (p.hand.some(x => canPlayOn(state, x))) {
      log(state, `${p.name} взял карту — есть чем ходить.`, 'draw');
    } else {
      log(state, `${p.name} взял карту, ход переходит.`, 'draw');
      advance(state, false);
    }
    return state;
  }

  function acceptCounter(state) {
    if (state.phase !== 'counterOffer') throw new Error('Нечего отбивать');
    const id = state.offerCard;
    state.offerCard = null;
    state.phase = 'play';
    return playCard(state, id);
  }
  function declineCounter(state) {
    if (state.phase !== 'counterOffer') throw new Error('Нечего отбивать');
    const p = cur(state);
    const rest = state.pending.draws - 1;
    for (let i = 0; i < rest; i++) { const d = drawOne(state); if (d) p.hand.push(d); }
    log(state, `${p.name} взял ${state.pending.draws} ${plural(state.pending.draws)}.`, 'draw');
    state.offerCard = null; state.pending = null;
    if (settleAfterPenalty(state, state.current)) return state;
    advance(state, false);
    return state;
  }
  function pass(state) {
    const lm = legalMoves(state);
    if (!lm.canPass) throw new Error('Сейчас нельзя пасовать');
    if (state.aceTarget) {
      log(state, `${cur(state).name} пропускает ход.`, 'info');
      advance(state, false);
      return state;
    }
    log(state, `${cur(state).name} пасует.`, 'info');
    advance(state, false);
    return state;
  }

  // --- конец партии и счёт ------------------------------------
  function endRound(state, finisher, finishingCards) {
    state.finisher = null; state.finishCards = null; state.aceTarget = false; state.pending = null;
    const results = state.players.map((p, i) => {
      let pts, note;
      if (p.out) return { idx: i, pts: 0, before: p.score, after: p.score, reset: false, note: 'выбыл', hand: [], out: true };
      if (i === finisher) {
        const qs = finishingCards.filter(isQ);
        pts = qs.length ? -qs.reduce((s, c) => s + queenFinishValue(c), 0) : 0;
        note = qs.length ? `закрыл на ${qs.length === 1 ? 'даму' : 'дам'}` : 'закрыл партию';
      } else if (p.hand.length && p.hand.every(isQ)) {
        pts = p.hand.reduce((s, c) => s + queenFinishValue(c), 0);
        note = 'остался с одними дамами';
      } else {
        pts = p.hand.reduce((s, c) => s + POINTS[c.rank], 0);
        note = p.hand.length ? `${p.hand.length} ${plural(p.hand.length)} на руках` : '';
      }
      const before = p.score;
      let after = before + pts, reset = false;
      if (after === RESET_AT) { after = 0; reset = true; note += ' · ровно 107 — счёт обнулён'; }
      p.score = after;
      return { idx: i, pts, before, after, reset, note, hand: p.hand.map(c => c.id) };
    });
    state.lastRound = { round: state.round, finisher, results };
    state.history.push(state.lastRound);
    if (state.mode === 'elim') {
      // режим на выбывание: набравшие 108 выходят из-за стола, остальные играют дальше
      const now = state.players.filter(p => !p.out && p.score >= TARGET);
      now.forEach(p => { p.out = true; p.outRound = state.round; state.eliminated.push(p.id); });
      state.eliminatedNow = now.map(p => p.id);
      now.forEach(p => log(state, `${p.name} набрал ${p.score} и выбывает!`, 'end'));
      const left = activePlayers(state);
      if (left.length <= 1) {
        let w = left[0];
        if (!w) {                                  // выбыли все сразу — побеждает тот, у кого меньше очков
          w = now.slice().sort((a, b) => a.score - b.score)[0];
          w.out = false; state.eliminated = state.eliminated.filter(id => id !== w.id);
        }
        state.winner = w.id;
        state.losers = state.players.filter(p => p.id !== w.id).map(p => p.id);
        state.phase = 'gameOver';
      } else state.phase = 'roundEnd';
      return state;
    }
    const over = state.players.filter(p => p.score >= TARGET);
    if (over.length) {
      state.losers = over.map(p => p.id);
      state.phase = 'gameOver';
    } else {
      state.phase = 'roundEnd';
    }
    return state;
  }

  function plural(n) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return 'карту';
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'карты';
    return 'карт';
  }

  // --- бот: стратегии ---------------------------------------------
  // Каждый приём можно включить/выключить, чтобы сравнивать их в симуляции.
  const STRATEGIES = {
    random:  { random: true },
    greedy:  { points: 1, queenHold: 0, queenDraw: false, eightCover: false, timing: false, suitLong: 0, keepNine: 0, suitChoice: 'random' },
    saver:   { points: 1, queenHold: 1, queenDraw: true,  eightCover: false, timing: false, suitLong: 0, keepNine: 1, suitChoice: 'random' },
    timing:  { points: 1, queenHold: 0, queenDraw: false, eightCover: false, timing: true,  suitLong: 0, keepNine: 0, suitChoice: 'random' },
    eights:  { points: 1, queenHold: 0, queenDraw: false, eightCover: true,  timing: false, suitLong: 0, keepNine: 0, suitChoice: 'random' },
    suit:    { points: 1, queenHold: 0, queenDraw: false, eightCover: false, timing: false, suitLong: 1, keepNine: 0, suitChoice: 'long' },
    pro:     { points: 1, queenHold: 1, qLast: -5, queenDraw: false, eightCover: true, timing: true, suitLong: 1, keepNine: 1, suitChoice: 'long' },
  };
  function stratOf(p) { return STRATEGIES[p.strategy] || STRATEGIES.pro; }

  function botChooseSuit(state, S) {
    const p = cur(state);
    if (S.random || S.suitChoice === 'random') return SUITS[Math.floor(rnd(state) * 4)];
    const cnt = { S: 0, C: 0, D: 0, H: 0 };
    p.hand.forEach(c => { if (!isQ(c)) cnt[c.suit] += 1 + POINTS[c.rank] / 20; });
    let best = SUITS[0], bv = -1;
    for (const s of SUITS) if (cnt[s] > bv) { bv = cnt[s]; best = s; }
    if (bv <= 0) best = SUITS[Math.floor(rnd(state) * 4)];
    return best;
  }

  function botPickCard(state, ids, S) {
    const p = cur(state);
    if (S.random) return ids[Math.floor(rnd(state) * ids.length)];
    const next = state.players[nextIdx(state, state.current)];
    let best = null, bv = -Infinity;
    for (const id of ids) {
      const c = findInHand(p, id);
      const rest = p.hand.filter(x => x.id !== id);
      let v = POINTS[c.rank] * S.points;                 // сбрасываем дорогие карты
      if (c.rank === 'Q') {
        if (rest.length === 0) v = 30;                    // закрыть на даму — лучшее, что есть
        else if (S.queenHold) v = rest.length === 1 ? (S.qLast == null ? 8 : S.qLast) : -(S.qPen || 12); // дам бережём на конец
      }
      if (c.rank === '8' && S.eightCover) {
        const hasCover = rest.some(x => covers(c.suit, x) && !(x.rank === '8' && !rest.some(y => y.id !== x.id && covers(x.suit, y))));
        v += hasCover ? 3 : -30;
      }
      const attack = c.rank === '6' || c.rank === '7' || (c.rank === 'K' && c.suit === 'H');
      if (attack) v += S.timing ? (next.hand.length <= 2 ? 9 : 1) : 3;
      if (c.rank === 'A') v += S.timing ? (next.hand.length <= 1 ? 12 : 0) : 3;
      if (c.rank === '9' && S.keepNine && rest.some(isQ) && rest.length > 1) v -= 4; // девятка — страховка к дамам
      v += rest.filter(x => x.suit === c.suit).length * 0.6 * S.suitLong;  // держим длинную масть
      v += rnd(state) * 0.5;
      if (v > bv) { bv = v; best = id; }
    }
    state.lastPick = bv;
    return best;
  }

  function botAction(state) {
    const p = cur(state);
    if (!p.isBot) return null;
    const S = stratOf(p);
    if (state.phase === 'chooseSuit') { chooseSuit(state, botChooseSuit(state, S)); return 'chooseSuit'; }
    if (state.phase === 'counterOffer') { acceptCounter(state); return 'accept'; }
    if (state.phase !== 'play') return null;
    const lm = legalMoves(state);
    if (lm.canFinishQueens) { finishWithQueens(state); return 'queens'; }
    if (lm.cards.length) {
      const best = botPickCard(state, lm.cards, S);
      const bc = findInHand(p, best);
      // ходить можно только дамой, а карт в руке ещё много — лучше взять карту и сберечь даму
      if (S.queenDraw && lm.canDraw && bc.rank === 'Q' && p.hand.length > (S.queenDrawMin || 2) && state.deck.length) { draw(state); return 'draw'; }
      // лучший ход всё равно плохой (например, восьмёрка без покрытия) — лучше взять одну карту
      if (S.drawIfBad != null && lm.canDraw && state.lastPick < S.drawIfBad && state.deck.length) { draw(state); return 'draw'; }
      playCard(state, best); return 'play';
    }
    if (lm.canDraw) { draw(state); return 'draw'; }
    if (lm.canPass) { pass(state); return 'pass'; }
    return null;
  }

  const api = {
    SUITS, RANKS, POINTS, SUIT_SYM, SUIT_RU, RANK_RU, TARGET, RESET_AT,
    createGame, startRound, legalMoves, playCard, chooseSuit, draw,
    acceptCounter, declineCounter, pass, finishWithQueens, botAction, STRATEGIES,
    top, effSuit, cardName, canPlayOn, isQ, queenFinishValue, plural, nextIdx, prevIdx,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine108 = api;
})(typeof window !== 'undefined' ? window : globalThis);
