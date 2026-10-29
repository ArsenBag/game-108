#!/usr/bin/env python3
"""Иконки и заставка Android-приложения «108»: адаптивная иконка (фон-цвет + передний слой),
обычная и круглая иконки по плотностям, заставки splash.png. Аргумент — папка со шрифтами Rubik TTF (latin/cyrillic)."""
import sys, os
from PIL import Image, ImageDraw, ImageFont
T = sys.argv[1].rstrip('/') + '/'
RES = os.path.join(os.path.dirname(__file__), '..', 'android', 'app', 'src', 'main', 'res')
BG = '#0f4c4c'
def font(sz): return ImageFont.truetype(T + 'rubik-latin.ttf', sz)

def emblem(S, scale=1.0):
    """Две карты и «108» на прозрачном фоне, размер S×S; scale — доля, которую занимает рисунок."""
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    k = S * scale
    cw, ch = k * .40, k * .56
    for ang, dx, col in ((-14, -.15, '#ff6b6b'), (12, .15, '#4f7bd9')):
        cc = Image.new('RGBA', (int(cw) + 8, int(ch) + 8), (0, 0, 0, 0)); d = ImageDraw.Draw(cc)
        r = max(2, int(k / 22))
        d.rounded_rectangle([0, 0, cw + 7, ch + 7], radius=r, fill='#1d1a2e')
        d.rounded_rectangle([k / 60, k / 60, cw + 7 - k / 60, ch + 7 - k / 60], radius=r, fill='#fff7e6')
        d.rounded_rectangle([k * .045, k * .045, cw + 7 - k * .045, ch + 7 - k * .045], radius=max(1, r - 2), fill=col)
        cc = cc.rotate(ang, expand=True, resample=Image.BICUBIC)
        im.alpha_composite(cc, (int(S / 2 - cc.width / 2 + dx * k), int(S / 2 - k * .36)))
    d = ImageDraw.Draw(im); f = font(int(k * .42)); txt = '108'
    w = f.getlength(txt)
    d.text((S / 2 - w / 2, S / 2 - k * .02), txt, font=f, fill='#ffc93c', stroke_width=max(2, int(k / 26)), stroke_fill='#1d1a2e')
    return im

dens = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for name, m in dens.items():
    dpath = os.path.join(RES, 'mipmap-' + name)
    # передний слой адаптивной иконки: 108dp, рисунок — в безопасной зоне 66dp
    fg = 108 * m; emblem(int(fg), 0.60).save(os.path.join(dpath, 'ic_launcher_foreground.png'))
    # обычная и круглая иконки: 48dp
    s = int(48 * m)
    big = s * 4
    sq = Image.new('RGBA', (big, big), (0, 0, 0, 0)); ImageDraw.Draw(sq).rounded_rectangle([0, 0, big - 1, big - 1], radius=big // 5, fill=BG)
    sq.alpha_composite(emblem(big, 0.92)); sq.resize((s, s), Image.LANCZOS).save(os.path.join(dpath, 'ic_launcher.png'))
    rd = Image.new('RGBA', (big, big), (0, 0, 0, 0)); ImageDraw.Draw(rd).ellipse([0, 0, big - 1, big - 1], fill=BG)
    rd.alpha_composite(emblem(big, 0.78)); rd.resize((s, s), Image.LANCZOS).save(os.path.join(dpath, 'ic_launcher_round.png'))
# цвет фона адаптивной иконки
open(os.path.join(RES, 'values', 'ic_launcher_background.xml'), 'w').write(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0F4C4C</color>\n</resources>\n')
# заставки (для Android до 12; на 12+ система рисует иконку на цвете фона)
for root, dirs, files in os.walk(RES):
    if 'splash.png' in files:
        p = os.path.join(root, 'splash.png'); w, h = Image.open(p).size
        sp = Image.new('RGBA', (w, h), BG); m = int(min(w, h) * .55)
        sp.alpha_composite(emblem(m, 0.95), ((w - m) // 2, (h - m) // 2)); sp.convert('RGB').save(p)
print('icons + splash ok')
