#!/usr/bin/env python3
"""Нарезка листов SpriteCook (4 карты в ряд, прозрачный фон) → art/back_<id>.webp и art/legend_<card>.webp.
Высокие карты из листа обрезаются по центру до пропорции нашей карты 72:102."""
from PIL import Image
import numpy as np
R = 72 / 102
def cells(path):
    im = Image.open(path).convert('RGBA'); a = np.array(im)[:, :, 3] > 40
    cols = a.any(axis=0); runs = []; s = None
    for x, v in enumerate(cols):
        if v and s is None: s = x
        if not v and s is not None: runs.append((s, x)); s = None
    if s is not None: runs.append((s, len(cols)))
    runs = sorted(sorted(runs, key=lambda r: r[1] - r[0], reverse=True)[:4])
    out = []
    for x0, x1 in runs:
        rows = np.where(a[:, x0:x1].any(axis=1))[0]
        out.append(im.crop((x0, rows[0], x1, rows[-1] + 1)))
    return out
def fit(c, inset, cy, W, H):
    w, h = c.size; c = c.crop((round(w * inset), round(w * inset), w - round(w * inset), h - round(w * inset)))
    w, h = c.size; nh = round(w / R)
    if nh > h: nw = round(h * R); x0 = (w - nw) // 2; c = c.crop((x0, 0, x0 + nw, h))
    else: y0 = max(0, min(h - nh, round(h * cy - nh / 2))); c = c.crop((0, y0, w, y0 + nh))
    return c.resize((W, H), Image.LANCZOS)
for name, c in zip(['city', 'silk', 'samarkand', 'cosmos'], cells('art/src/backs4.png')):
    fit(c, .045, .5, 300, 425).convert('RGB').save(f'art/back_{name}.webp', quality=84, method=6)
for sheet, ids in (('legend_A', ['QS', 'KH', 'AS', 'JD']), ('legend_B', ['QH', 'KS', 'AH', 'JC'])):
    for cid, c in zip(ids, cells(f'art/src/{sheet}.png')):
        fit(c, .06, .5, 240, 340).convert('RGB').save(f'art/legend_{cid}.webp', quality=84, method=6)
print('ok')
