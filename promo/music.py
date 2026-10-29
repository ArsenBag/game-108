#!/usr/bin/env python3
"""Звук ролика «108»: синтезированная музыка (120 BPM, хиджаз от ре: дойра, бас, щипковая мелодия, подклад)
+ звуки игры из sfx/ на событиях геймплея + акценты на склейках. Выход: promo/audio.wav (30 с, 44,1 кГц, стерео)."""
import json, subprocess, numpy as np
from scipy.signal import fftconvolve

SR = 44100
DUR = 30.0
N = int(SR * DUR)
BPM = 120; BEAT = 60 / BPM; STEP = BEAT / 4
rng = np.random.default_rng(108)
L = np.zeros(N); R = np.zeros(N)

def t_(d): return np.arange(int(SR * d)) / SR
def add(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N or i + len(sig) <= 0: return
    j = min(N, i + len(sig)); s = sig[:j - i] * gain
    L[i:j] += s * np.sqrt((1 - pan) / 2) * 1.414; R[i:j] += s * np.sqrt((1 + pan) / 2) * 1.414
def hz(note):  # 'D4' → частота
    names = {'C': -9, 'C#': -8, 'Db': -8, 'D': -7, 'D#': -6, 'Eb': -6, 'E': -5, 'F': -4, 'F#': -3, 'Gb': -3, 'G': -2, 'G#': -1, 'Ab': -1, 'A': 0, 'A#': 1, 'Bb': 1, 'B': 2}
    n, o = note[:-1], int(note[-1])
    return 440 * 2 ** ((names[n] + (o - 4) * 12) / 12)
def onepole_lp(x, a):
    y = np.empty_like(x); acc = 0.0
    for i, v in enumerate(x): acc += a * (v - acc); y[i] = acc
    return y

# ---------- инструменты ----------
def pluck(f, d=0.6, bright=1.0, decay=2.2):  # щипковая струна (дутар): гармоники с затуханием, верхние гаснут быстрее
    t = t_(d); s = np.zeros_like(t)
    for k in range(1, 14):
        fk = f * k * (1 + 0.0007 * k * k)
        if fk > SR / 2.2: break
        s += (1 / k ** (1.25 - .25 * bright)) * np.sin(2 * np.pi * fk * t + rng.random() * 6) * np.exp(-t * decay * (1 + 0.55 * k))
    att = np.minimum(1, t / 0.003)
    return s * att * 0.32
def bass(f, d=0.42):
    t = t_(d)
    s = np.sin(2 * np.pi * f * t) + 0.45 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 9) + 0.2 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t * 14)
    return s * np.exp(-t * 4.2) * np.minimum(1, t / 0.006) * 0.55
def dum():  # низкий удар дойры
    t = t_(0.45); f = 65 + 85 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 7.5) + rng.standard_normal(len(t)) * np.exp(-t * 60) * 0.25
    return s * 0.9
def tek():  # звонкий удар по краю
    t = t_(0.12); n = rng.standard_normal(len(t))
    n = np.diff(np.concatenate([[0], n])); s = n * np.exp(-t * 55) + 0.4 * np.sin(2 * np.pi * 820 * t) * np.exp(-t * 40)
    return s * 0.42
def jingle():  # колечки на ободе дойры
    t = t_(0.09); n = np.diff(np.concatenate([[0], np.diff(np.concatenate([[0], rng.standard_normal(len(t))]))]))
    return n * np.exp(-t * 45) * 0.09
def pad(freqs, d):
    t = t_(d); s = np.zeros_like(t)
    for f in freqs:
        for det in (-0.12, 0.12):
            ff = f * 2 ** (det / 12)
            saw = 2 * ((ff * t + rng.random()) % 1) - 1
            s += saw
    s = onepole_lp(s, 0.035)
    env = np.minimum(1, t / 0.35) * np.minimum(1, (d - t) / 0.4)
    return s * env * 0.05
def impact(big=1.0):
    t = t_(1.6); f = 42 + 70 * np.exp(-t * 9)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.6)
    crash = rng.standard_normal(len(t)); crash = np.diff(np.concatenate([[0], crash])) * np.exp(-t * 3.2) * 0.5
    return (boom * 1.1 + crash * 0.55) * big
def riser(d=1.0):
    t = t_(d); n = rng.standard_normal(len(t)); n = np.diff(np.concatenate([[0], n]))
    env = (t / d) ** 2.2
    return n * env * 0.35
def whoosh(d=0.35):
    t = t_(d); n = rng.standard_normal(len(t))
    env = np.sin(np.pi * t / d) ** 2
    lp = onepole_lp(n, 0.25)
    return (n - lp) * env * 0.45
def tick():
    t = t_(0.06); return np.sin(2 * np.pi * 1800 * t) * np.exp(-t * 70) * 0.25
def shimmer(d=1.2):
    t = t_(d); s = np.zeros_like(t)
    for k, f in enumerate([1568, 1976, 2349, 2637, 3136, 3520]):
        st = k * 0.07; tt = np.clip(t - st, 0, None)
        s += np.sin(2 * np.pi * f * tt) * np.exp(-tt * 5) * (t >= st)
    return s * 0.08

# ---------- музыка ----------
GROOVE_FROM, GROOVE_TO = 3.0, 29.2
doira = 'D..T.TD.D..T.TT.'
bassline = [0, 3, 6, 8, 11, 14]
# хиджаз от ре: D Eb F# G A Bb C; аккорды чередуются по два такта: D — Eb — D — C
chords = [['D3', 'F#3', 'A3'], ['Eb3', 'G3', 'Bb3'], ['D3', 'F#3', 'A3'], ['C3', 'Eb3', 'G3']]
roots = ['D2', 'Eb2', 'D2', 'C2']
motifA = ['D5', 'Eb5', 'F#5', 'G5', 'A5', 'G5', 'F#5', 'Eb5']                       # восьмые
motifB = ['D5', None, 'F#5', 'Eb5', 'D5', 'C5', 'D5', None]
motifC = ['A5', 'Bb5', 'A5', 'G5', 'F#5', 'G5', 'A5', None]
motifD = ['G5', 'F#5', 'Eb5', 'F#5', 'D5', None, 'D5', None]
melody = [motifA, motifB, motifC, motifD]
bar = 4 * BEAT
nbars = int(DUR / bar) + 1
for b in range(nbars):
    b0 = b * bar
    ci = (b // 2) % 4
    # подклад: с самого начала, тише во вступлении
    if b0 < DUR:
        add(pad([hz(n) for n in chords[ci]], bar + 0.05), b0, 0.6 if b0 < GROOVE_FROM else 1.0, 0)
    for s in range(16):
        at = b0 + s * STEP
        if at >= DUR: break
        groove = GROOVE_FROM <= at < GROOVE_TO
        # дойра: во вступлении — только «дум» на долях, в грув — полный рисунок
        ch = doira[s]
        if groove:
            if ch == 'D': add(dum(), at, 1.0, 0)
            elif ch == 'T': add(tek(), at, 0.9, 0.25)
            if s % 2 == 0: add(jingle(), at, 1.0, -0.3)
        elif at < GROOVE_FROM and at >= 1.5 and s % 4 == 0:
            add(dum(), at, 0.7, 0)
        if groove and s in bassline:
            add(bass(hz(roots[ci])), at, 1.0, 0)
        # мелодия — восьмыми, с 5,5 с (когда начинается геймплей), в каждом втором такте вариация
        if groove and 5.5 <= at < 26.5 and s % 2 == 0:
            m = melody[(b + (1 if b % 2 else 0)) % 4]
            nt = m[s // 2]
            if nt: add(pluck(hz(nt), 0.55), at, 0.85, 0.15 * np.sin(b + s))
        # контрапункт октавой ниже во второй половине
        if groove and 16.5 <= at < 26.5 and s % 4 == 2:
            m = melody[(b + 2) % 4]; nt = m[s // 2]
            if nt: add(pluck(hz(nt) / 2, 0.5, 0.6), at, 0.45, -0.35)
# финал: аккорд ре и затухание
add(pad([hz('D3'), hz('F#3'), hz('A3'), hz('D4')], 3.5), 26.5, 1.4)
for k, n in enumerate(['D5', 'F#5', 'A5', 'D6']): add(pluck(hz(n), 1.6, 1.0, 1.4), 26.5 + k * 0.09, 0.8, (k - 1.5) * 0.3)
add(bass(hz('D2'), 1.4), 26.5, 1.0)

# ---------- акценты ролика ----------
add(riser(0.15), 0.0, 0.6); add(impact(1.2), 0.15, 1.0)
add(impact(0.6), 1.45, 0.8); add(tick(), 2.0, 1.0)
for c in [3.0, 5.5, 16.5, 20.0, 23.0]: add(whoosh(0.35), c - 0.22, 0.9); add(impact(0.35), c, 0.6)
add(riser(1.2), 25.3, 0.7); add(impact(1.3), 26.5, 1.0)
for i in range(25): add(tick(), 3.15 + i * 0.045, 0.35, (i % 5 - 2) * 0.3)        # герои выпрыгивают
for i in range(6): add(tick(), 20.0 + i * 0.5, 0.9)                                # смена мест
add(shimmer(1.4), 16.7, 1.0)

# ---------- звуки игры ----------
def load(name):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', f'../sfx/{name}', '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)
S = {k: load(f) for k, f in {'place1': 'card-place-1.mp3', 'place2': 'card-place-2.mp3', 'place3': 'card-place-3.mp3', 'slide1': 'card-slide-1.mp3', 'slide2': 'card-slide-2.mp3',
    'slide3': 'card-slide-3.mp3', 'penalty': 'penalty.mp3', 'laugh': 'laugh.mp3', 'devastated': 'devastated.mp3', 'tada': 'tada_short.mp3', 'queen': 'queen.mp3',
    'party': 'party.mp3', 'shuffle': 'deal_shuffle.mp3', 'click': 'ui_click_002.mp3', 'excited': 'excited.mp3', 'boing': 'boing.mp3'}.items()}
CUTS = [[5.5, 7.5, 0.25, 1.4], [7.5, 12.5, 3.12, 1.65], [12.5, 14.0, 14.5, 1.0], [14.0, 16.5, 19.5, 1.0]]
def vt(g):
    for a, b, g0, sp in CUTS:
        if g0 <= g < g0 + (b - a) * sp: return a + (g - g0) / sp
    return None
ev = {k: t for t, k in json.load(open('frames_game/index.json'))['events']}
def sfx(name, g, gain=1.0, pan=0.0):
    v = vt(g)
    if v is not None: add(S[name], v, gain, pan)
# раздача
for i in range(14): sfx(['slide1', 'slide2', 'slide3'][i % 3], ev['deal'] + 0.06 + i * 0.075, 0.55, (i % 4 - 1.5) * 0.3)
sfx('tada', ev['deal'] + 1.45, 0.8)
for k, pan in [('take2', -.3), ('chain2', .1), ('chain3', .3), ('chain4', 0)]:
    sfx('place' + str(1 + hash(k) % 3), ev[k] + 0.05, 1.0, pan); sfx('penalty', ev[k] + 0.08, 0.7 if k != 'chain4' else 1.0)
for i in range(8): sfx('slide' + str(1 + i % 3), ev['take8'] + 0.05 + i * 0.09, 0.6, -0.3)
sfx('devastated', ev['take8'] + 0.3, 0.9); sfx('laugh', ev['take8'] + 0.6, 0.8, 0.3)
sfx('place2', ev['legendAS'] + 0.05, 1.0); sfx('boing', ev['legendAS'] + 0.2, 0.6)
sfx('place3', ev['queen40'] + 0.05, 1.0); sfx('queen', ev['queen40'] + 0.1, 0.9); sfx('party', ev['queen40'] + 0.45, 0.9)
add(S['click'], 24.9, 1.0); add(S['party'], 25.0, 0.8)
add(S['party'], 27.4, 0.6)

# ---------- сведение: немного зала, мягкое ограничение, затухание ----------
ir_t = t_(1.1); ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 4.5); ir /= np.sqrt((ir ** 2).sum())
Lw = fftconvolve(L, ir)[:N]; Rw = fftconvolve(R, ir[::-1].copy() * 0 + np.roll(ir, 37))[:N]
L2 = L + 0.18 * Lw; R2 = R + 0.18 * Rw
fade = np.ones(N); fl = int(1.2 * SR); fade[-fl:] = np.linspace(1, 0, fl) ** 1.5
peak = max(np.abs(L2).max(), np.abs(R2).max())
L2 = np.tanh(L2 / peak * 1.6) / np.tanh(1.6) * 0.93 * fade
R2 = np.tanh(R2 / peak * 1.6) / np.tanh(1.6) * 0.93 * fade
out = np.stack([L2, R2], axis=1)
pcm = (out * 32767).astype(np.int16)
import wave
with wave.open('audio.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('audio.wav', DUR, 's, peak', round(float(np.abs(out).max()), 3))
