#!/usr/bin/env python3
"""Режет листы эмоций SpriteCook (сетка 4×2, прозрачный фон) на полоски 8 ячеек.
Ячейки: neutral, laugh, cry, angry, shocked, smug, worried, think.
Вход: sheets/<id>.png (1024×1024 RGBA). Выход: out/<id>.webp, out/meta.json, out/montage100.jpg."""
from PIL import Image
import numpy as np, glob, os, json, sys

H = 256                                   # высота ячейки в полоске
Q = 85                                    # качество WebP
SRC = sys.argv[1] if len(sys.argv) > 1 else 'sheets'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'out'
os.makedirs(OUT, exist_ok=True)

def runs(v, minlen=3):
    out = []; start = None
    for i, x in enumerate(v):
        if x == 0 and start is None: start = i
        if x != 0 and start is not None:
            if i - 1 - start >= minlen: out.append((start, i - 1))
            start = None
    if start is not None and len(v) - 1 - start >= minlen: out.append((start, len(v) - 1))
    return out

meta = {}
for f in sorted(glob.glob(f'{SRC}/[mf]??.png')):
    cid = os.path.basename(f)[:-4]
    im = Image.open(f).convert('RGBA'); A = np.array(im); a = A[:, :, 3] > 8
    rs = a.sum(axis=1); rr = runs(rs); mids = [r for r in rr if 300 < r[0] < 700]
    if mids: ysplit = (mids[0][0] + mids[0][1]) // 2
    else: ysplit = 380 + int(np.argmin(rs[380:640]))     # ряды касаются (что-то «вылетает» из ячейки) — режем по самому пустому месту
    cells = []
    for y0, y1 in ((0, ysplit), (ysplit, A.shape[0])):
        band = a[y0:y1]; cs = band.sum(axis=0); cr = [r for r in runs(cs) if 100 < r[0] < 950]
        cuts = [0]
        for e in (256, 512, 768):
            near = [r for r in cr if abs((r[0] + r[1]) / 2 - e) < 80]
            if near: cuts.append((near[0][0] + near[0][1]) // 2)
            else: w = cs[e - 60:e + 60]; cuts.append(e - 60 + int(np.argmin(w)))
        cuts.append(A.shape[1])
        for i in range(4):
            sub = A[y0:y1, cuts[i]:cuts[i + 1]]; m = sub[:, :, 3] > 8
            ys = np.where(m.any(axis=1))[0]; xs = np.where(m.any(axis=0))[0]
            cells.append(Image.fromarray(sub[ys[0]:ys[-1] + 1, xs[0]:xs[-1] + 1]))
    W = max(c.width for c in cells); Hc = max(c.height for c in cells)
    s = H / Hc; w = round(W * s)
    strip = Image.new('RGBA', (w * 8, H), (0, 0, 0, 0))
    for i, c in enumerate(cells):                       # якорь — низ по центру
        cv = Image.new('RGBA', (W, Hc), (0, 0, 0, 0)); cv.alpha_composite(c, ((W - c.width) // 2, Hc - c.height))
        strip.paste(cv.resize((w, H), Image.LANCZOS), (i * w, 0))
    strip.save(f'{OUT}/{cid}.webp', quality=Q, method=6)
    meta[cid] = {'w': w, 'h': H}
    print(cid, '->', w, 'x', H, os.path.getsize(f'{OUT}/{cid}.webp') // 1024, 'KB')
json.dump(meta, open(f'{OUT}/meta.json', 'w'), indent=1)

mont = Image.new('RGBA', (8 * 110, len(meta) * 110), '#0f4c4c')
for r, cid in enumerate(sorted(meta)):
    st = Image.open(f'{OUT}/{cid}.webp').convert('RGBA'); w = meta[cid]['w']
    for i in range(8):
        c = st.crop((i * w, 0, (i + 1) * w, H)).resize((round(w * 100 / H), 100), Image.LANCZOS)
        mont.alpha_composite(c, (i * 110 + (110 - c.width) // 2, r * 110 + 5))
mont.convert('RGB').save(f'{OUT}/montage100.jpg', quality=90)
