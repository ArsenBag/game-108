#!/usr/bin/env python3
"""Стингеры для реакций «108»: классические мультяшные звуки, отрендеренные офлайн (numpy → mp3).
Запуск: python3 make_sfx.py <out_dir>  → <out_dir>/<name>.mp3 (моно, 44.1 кГц, 96 кбит/с)."""
import numpy as np, subprocess, sys, os, wave
SR = 44100
out = sys.argv[1] if len(sys.argv) > 1 else '.'
os.makedirs(out, exist_ok=True)
rng = np.random.default_rng(108)

def t_(dur): return np.arange(int(SR * dur)) / SR
def env(n, a=.01, d=.1, s=.7, r=.2, dur=None):
    """ADSR по сэмплам (a,d,r — секунды; s — уровень)."""
    N = n; A, D, R = int(a * SR), int(d * SR), int(r * SR)
    S = max(0, N - A - D - R)
    e = np.concatenate([np.linspace(0, 1, A), np.linspace(1, s, D), np.full(S, s), np.linspace(s, 0, R)])
    return e[:N] if len(e) >= N else np.pad(e, (0, N - len(e)))
def lp(x, cutoff):
    """Простой однополюсный ФНЧ с переменной частотой среза (cutoff — массив или число, Гц)."""
    c = np.broadcast_to(np.asarray(cutoff, dtype=float), x.shape)
    a = np.exp(-2 * np.pi * c / SR); y = np.zeros_like(x); z = 0.0
    for i in range(len(x)): z = a[i] * z + (1 - a[i]) * x[i]; y[i] = z
    return y
def hp(x, cutoff): return x - lp(x, cutoff)
def bp(x, f, q=4): return lp(hp(x, f / q), f * q)
def saw(ph): return 2 * (ph % 1) - 1
def sq(ph): return np.sign(np.sin(2 * np.pi * ph))
def phase(freq):
    """freq — массив Гц → фаза (циклы)."""
    return np.cumsum(np.asarray(freq, dtype=float)) / SR
def glide(f0, f1, dur, curve=1.0):
    t = t_(dur); k = (t / dur) ** curve; return f0 * (f1 / f0) ** k
def vib(f, dur, depth=.02, rate=5.5, start=.1):
    t = t_(dur); g = np.clip((t - start) / .25, 0, 1); return f * (1 + depth * g * np.sin(2 * np.pi * rate * t))
def mix(*parts):
    """parts: (сигнал, старт сек). Суммирует с учётом смещения."""
    n = max(int(s * SR) + len(x) for x, s in parts); y = np.zeros(n)
    for x, s in parts: i = int(s * SR); y[i:i + len(x)] += x
    return y
def norm(x, peak=.9): m = np.max(np.abs(x)) + 1e-9; return x / m * peak
def save(name, x, peak=.9):
    x = norm(x, peak); x = np.concatenate([x, np.zeros(int(SR * .05))])
    w = f'{out}/{name}.wav'
    with wave.open(w, 'wb') as f: f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR); f.writeframes((x * 32767).astype(np.int16).tobytes())
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', w, '-codec:a', 'libmp3lame', '-b:a', '96k', f'{out}/{name}.mp3'], check=True); os.remove(w)
    print(name, round(len(x) / SR, 2), 's')

# ---------- инструменты ----------
def brass(freq, dur, wah=(1800, 500), vibd=.015, a=.03, r=.12, bright=1.0):
    """Тромбон/труба: пила → ФНЧ с огибающей среза («вау»), вибрато."""
    n = int(dur * SR); f = np.broadcast_to(np.asarray(freq, float), (n,))
    f = vib(f, dur, vibd, 5.2, .15); ph = phase(f)
    x = saw(ph) * .7 + saw(ph * 2 + .3) * .15 + np.sin(2 * np.pi * ph) * .3
    t = t_(dur); cut = wah[0] * bright + (wah[1] - wah[0]) * bright * np.clip(t / dur, 0, 1) ** .6
    x = lp(x, np.maximum(cut, 150)); x = lp(x, 4000)
    return x * env(n, a, .05, .85, r)
def bell(freq, dur, amp=1.0):
    t = t_(dur); x = np.zeros_like(t)
    for ratio, g, dec in ((1, 1, 1.0), (2.0, .5, .7), (2.76, .35, .5), (5.4, .15, .3), (8.9, .06, .2)):
        x += g * np.sin(2 * np.pi * freq * ratio * t) * np.exp(-t / (dur * dec * .5))
    return x * amp * np.minimum(1, t * 400)
def marimba(freq, dur):
    t = t_(dur); x = np.sin(2 * np.pi * freq * t) * np.exp(-t * 6) + .3 * np.sin(2 * np.pi * freq * 4 * t) * np.exp(-t * 18)
    return x * np.minimum(1, t * 600)
def pluck(freq, dur, bright=.5):
    """Карплус-Стронг: щипок струны."""
    n = int(dur * SR); L = int(SR / freq); buf = rng.uniform(-1, 1, L); y = np.zeros(n)
    for i in range(n): y[i] = buf[i % L]; buf[i % L] = (buf[i % L] + buf[(i + 1) % L]) * .5 * (.996 - (1 - bright) * .004)
    return y * env(n, .002, .02, .9, .05)
def noise(dur): return rng.uniform(-1, 1, int(dur * SR))
def kick(dur=.25, f0=150, f1=45):
    n = int(dur * SR); x = np.sin(2 * np.pi * phase(glide(f0, f1, dur, .5))); return x * np.exp(-t_(dur) * 14)
def snare(dur=.2):
    t = t_(dur); x = hp(noise(dur), 1500) * np.exp(-t * 28) * .8 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 35) * .6; return x
def crash(dur=1.6, f=5000):
    t = t_(dur); x = hp(noise(dur), f) * np.exp(-t * 2.2) + bp(noise(dur), 8000, 3) * np.exp(-t * 3); return x * .8
def woodblock(freq=1200, dur=.08):
    t = t_(dur); return np.sin(2 * np.pi * freq * t) * np.exp(-t * 90) + .3 * hp(noise(dur), 3000) * np.exp(-t * 200)
def slide_whistle(f0, f1, dur, breath=.25):
    f = glide(f0, f1, dur, 1.0); f = vib(f, dur, .01, 6, .05); t = t_(dur)
    x = np.sin(2 * np.pi * phase(f)) + .25 * np.sin(2 * np.pi * phase(f * 2)); x += breath * bp(noise(dur), 2500, 2) * .5
    return x * env(len(x), .02, .05, .9, .12)
def applause(dur=2.4, density=55):
    n = int(dur * SR); y = np.zeros(n); t = t_(dur); prof = np.minimum(1, t / .25) * np.exp(-np.maximum(0, t - dur * .55) * 2.2)
    for _ in range(int(density * dur)):
        s = int(rng.uniform(0, dur - .04) * SR); l = int(SR * rng.uniform(.015, .035)); c = bp(noise(l / SR), rng.uniform(1200, 2600), 2) * np.exp(-t_(l / SR) * 150)
        y[s:s + len(c)] += c[:len(y) - s] * rng.uniform(.4, 1)
    y += bp(noise(dur), 1800, 1.5) * .08 * prof
    return y * prof

# ---------- стингеры ----------
def sad_trombone(notes=((233, .42), (220, .42), (208, .42), (196, 1.4)), gap=.05):
    parts, pos = [], 0.0
    for i, (f, d) in enumerate(notes):
        last = i == len(notes) - 1
        fr = glide(f * 1.03, f * (0.93 if last else 1.0), d, .7)
        parts.append((brass(fr, d, wah=(2200, 450), vibd=.03 if last else .015, r=.25 if last else .08), pos)); pos += d + gap
    return mix(*parts)
save('cry', sad_trombone())                                                   # плач — «вау-вау-вау-вааау»
save('sad', sad_trombone(((220, .45), (196, 1.1))))                           # грусть — короткий тромбон
save('devastated', mix((sad_trombone(((247, .35), (233, .35), (220, .35), (175, 1.8))), 0), (crash(1.8, 3000) * .5, 1.1), (kick(.5, 90, 30), 1.1)))
# «ба-дум-тсс» — смех / хохот стола
badum = mix((kick(), 0), (snare(), .0), (kick(), .17), (snare(), .17), (crash(1.4), .38), (snare(.25), .38))
save('laugh', badum)
save('party', mix((brass(523, .18, (3000, 1500), .01), 0), (brass(659, .18, (3000, 1500), .01), 0), (brass(784, .18, (3000, 1500), .01), 0),
                  (brass(vib(1047, 1.3, .02), 1.3, (3500, 1800), .025, r=.3), .22), (brass(1319, 1.3, (3500, 1800), .025, r=.3), .22), (brass(1568, 1.3, (3500, 1800), .025, r=.3), .22),
                  (crash(1.6), .22), (applause(2.2, 60) * .7, .3)))                 # «та-да!» + аплодисменты
save('win', mix((brass(392, .16, (3000, 1500)), 0), (brass(523, .16, (3000, 1500)), .17), (brass(659, .16, (3000, 1500)), .34),
                (brass(vib(784, 1.4, .02), 1.4, (3500, 1800), .025, r=.3), .51), (brass(988, 1.4, (3500, 1800), .025, r=.3), .51), (brass(1175, 1.4, (3500, 1800), .025, r=.3), .51),
                (crash(1.8), .51), (applause(2.6, 70), .55)))
save('lose', mix((sad_trombone(((196, .5), (185, .5), (175, .5), (131, 2.0))), 0), (kick(.6, 70, 28), 2.0), (crash(2.0, 2500) * .4, 2.0)))
save('reset', mix(*[(bell(f, .9, .8), i * .09) for i, f in enumerate((784, 988, 1175, 1568, 1976, 2349, 3136))] + [(bell(3136, 1.6), .7), (bell(2349, 1.6), .7), (applause(1.6, 40) * .4, .5)]))  # 107 — джекпот
save('happy', mix((marimba(523, .5), 0), (marimba(784, .7), .12)))
save('excited', mix(*[(bell(f, .6, .7), i * .055) for i, f in enumerate((523, 587, 659, 784, 880, 1047, 1175, 1319, 1568))]))   # искры вверх
save('relief', mix((slide_whistle(1500, 420, .7, .3), 0), (bp(noise(.6), 900, 1.5) * np.exp(-t_(.6) * 5) * .5, .55)))        # свисток вниз + выдох
save('shocked', mix((slide_whistle(380, 1700, .45, .25), 0), (crash(.6, 7000) * .35, .42)))                                   # свисток вверх
save('smug', mix((bell(1319, 1.0), 0), (bell(1760, 1.4), .14)))                                                              # «ти-динь»
save('sly', mix(*[(pluck(f, .22, .35), i * .17) for i, f in enumerate((165, 175, 185, 196, 185, 175))]))                      # крадущиеся щипки
save('evil', mix((brass(147, .26, (900, 300), .01), 0), (brass(175, .26, (900, 300), .01), 0), (brass(220, .26, (900, 300), .01), 0),
                 (brass(vib(139, .9, .02), .9, (1200, 300), .03, r=.3), .32), (brass(175, .9, (1200, 300), .03, r=.3), .32), (brass(208, .9, (1200, 300), .03, r=.3), .32),
                 (kick(.6, 80, 30), .32)))                                                                                      # «дун-дууун»
save('angry', mix((kick(.6, 120, 40), 0), (bp(noise(.9), 300, 1.2) * np.exp(-t_(.9) * 3), 0), (kick(.6, 120, 40), .22), (hp(noise(.8), 3500) * np.exp(-t_(.8) * 4) * .5, .25)))  # удар + пар
save('annoyed', mix((sq(phase(np.full(int(.35 * SR), 110.))) * env(int(.35 * SR), .005, .02, .9, .05) * .5 + sq(phase(np.full(int(.35 * SR), 112.))) * env(int(.35 * SR), .005, .02, .9, .05) * .5, 0)))  # зуммер
save('worried', mix((brass(vib(659, .35, .04, 9, 0), .35, (2000, 1200), .0), 0), (brass(vib(523, .6, .05, 9, 0), .6, (1800, 800), .0, r=.2), .36)))                # «у-оу»
save('nervous', mix(*[(woodblock(1400, .07), s) for s in np.cumsum([0, .22, .2, .17, .14, .12, .1, .09, .08, .07])]))         # тикает всё быстрее
save('overwhelmed', mix(*[(np.sin(2 * np.pi * phase(glide(rng.uniform(1800, 2400), rng.uniform(2600, 3400), .07))) * env(int(.07 * SR), .005, .01, .8, .03) * .5, s) for s in np.arange(0, 1.6, .11)] + [(np.sin(2 * np.pi * phase(vib(np.full(int(1.7 * SR), 330.), 1.7, .12, 2.5, 0))) * env(int(1.7 * SR), .1, .2, .6, .4) * .25, 0)]))  # птички + кружится голова
save('meh', mix((np.sin(2 * np.pi * phase(glide(240, 150, .18, .6))) * env(int(.18 * SR), .003, .03, .6, .06), 0), (woodblock(600, .05) * .5, 0)))  # «бонк»
save('pout', mix((marimba(440, .4), 0), (marimba(349, .6), .16)))
save('think', mix((marimba(880, .35), 0), (marimba(1109, .6), .18)))                                                            # «динь?»
save('boing', np.sin(2 * np.pi * phase(220 * (1 + .55 * np.exp(-t_(.7) * 5) * np.sin(2 * np.pi * 11 * t_(.7))))) * env(int(.7 * SR), .003, .1, .6, .3))
save('queen', mix((bell(1047, 1.2), 0), (bell(1319, 1.2), .1), (bell(1568, 1.6), .2)))
save('penalty', mix((brass(glide(200, 120, .5, .5), .5, (1500, 300), .02), 0), (kick(.4, 100, 35), .0), (kick(.4, 100, 35), .25)))
save('deal_shuffle', mix(*[(bp(noise(.03), rng.uniform(2500, 5000), 2) * np.exp(-t_(.03) * 120), s) for s in np.cumsum(rng.uniform(.018, .03, 40))]))
save('tada_short', mix((brass(784, .14, (3000, 1500)), 0), (brass(vib(1047, .7, .02), .7, (3500, 1800), .02, r=.2), .15), (crash(.9) * .6, .15)))
print('done')
