#!/usr/bin/env python3
"""Материалы для Google Play: иконка 512×512, обложка 1024×500, скриншоты телефона 1080×1920 с подписями.
Аргумент — папка со шрифтами Rubik TTF (rubik-latin.ttf, rubik-cyrillic.ttf). Запускать из корня проекта."""
import sys, os, json
from PIL import Image, ImageDraw, ImageFont, ImageFilter
T = sys.argv[1].rstrip('/') + '/'
OUT = 'store/build'; os.makedirs(OUT + '/screenshots', exist_ok=True)
def fonts(size): return ImageFont.truetype(T + 'rubik-latin.ttf', size), ImageFont.truetype(T + 'rubik-cyrillic.ttf', size)
def runs(text):
    out = []
    for ch in text:
        cyr = 'Ѐ' <= ch <= 'ӿ'
        if out and out[-1][0] == cyr: out[-1][1] += ch
        else: out.append([cyr, ch])
    return out
def width(text, size): L, C = fonts(size); return sum((C if c else L).getlength(t) for c, t in runs(text))
def draw(d, xy, text, size, fill, stroke=0, sfill='#1d1a2e', anchor='l'):
    L, C = fonts(size); x, y = xy
    if anchor == 'c': x -= width(text, size) / 2
    for c, t in runs(text):
        f = C if c else L
        d.text((x, y), t, font=f, fill=fill, stroke_width=stroke, stroke_fill=sfill); x += f.getlength(t)
def cover(path, W, H, blur=0, dark=0.0):
    im = Image.open(path).convert('RGB'); k = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    x0, y0 = (im.width - W) // 2, (im.height - H) // 2; im = im.crop((x0, y0, x0 + W, y0 + H))
    if blur: im = im.filter(ImageFilter.GaussianBlur(blur))
    if dark: im = Image.blend(im, Image.new('RGB', im.size, (12, 14, 40)), dark)
    return im.convert('RGBA')
def rounded(im, r):
    m = Image.new('L', im.size, 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=r, fill=255)
    out = Image.new('RGBA', im.size, (0, 0, 0, 0)); out.paste(im, (0, 0), m); return out

# ---------- иконка 512 (квадрат без прозрачности — Google сам скругляет углы) ----------
ic = Image.new('RGBA', (512, 512), '#0f4c4c'); d = ImageDraw.Draw(ic)
k = 512 * .9; cw, ch = k * .40, k * .56
for ang, dx, col in ((-14, -.15, '#ff6b6b'), (12, .15, '#4f7bd9')):
    cc = Image.new('RGBA', (int(cw) + 8, int(ch) + 8), (0, 0, 0, 0)); cd = ImageDraw.Draw(cc)
    cd.rounded_rectangle([0, 0, cw + 7, ch + 7], radius=20, fill='#1d1a2e'); cd.rounded_rectangle([8, 8, cw - 1, ch - 1], radius=16, fill='#fff7e6')
    cd.rounded_rectangle([20, 20, cw - 13, ch - 13], radius=12, fill=col)
    cc = cc.rotate(ang, expand=True, resample=Image.BICUBIC); ic.alpha_composite(cc, (int(256 - cc.width / 2 + dx * k), int(256 - k * .36)))
draw(ImageDraw.Draw(ic), (256, 256 - 10), '108', int(k * .42), '#ffc93c', 16, anchor='c')
ic.convert('RGB').save(OUT + '/icon-512.png')

# ---------- обложка 1024×500 ----------
W, H = 1024, 500
fg = cover('art/src/bg_city.png', W, H)
grad = Image.new('RGBA', (W, H)); gd = ImageDraw.Draw(grad)
for x in range(W): gd.line([(x, 0), (x, H)], fill=(18, 16, 38, int(215 * max(0, 1 - x / 640))))
fg.alpha_composite(grad)
def card(path, w=150):
    c = Image.open(path).convert('RGBA'); h = round(w * 102 / 72); c = rounded(c.resize((w, h), Image.LANCZOS), 16)
    out = Image.new('RGBA', (w + 14, h + 14), (0, 0, 0, 0)); bd = ImageDraw.Draw(out)
    bd.rounded_rectangle([0, 0, w + 13, h + 13], radius=22, fill='#1d1a2e'); bd.rounded_rectangle([3, 3, w + 10, h + 10], radius=19, fill='#ffd34d')
    out.alpha_composite(c, (7, 7)); return out
for path, ang, pos in (('art/legend_AS.webp', 13, (835, 70)), ('art/legend_KH.webp', -2, (735, 50)), ('art/legend_QS.webp', -15, (630, 80))):
    c = card(path).rotate(ang, expand=True, resample=Image.BICUBIC)
    sh = Image.new('RGBA', c.size, (0, 0, 0, 0)); sh.putalpha(c.getchannel('A').point(lambda v: int(v * .5))); sh = sh.filter(ImageFilter.GaussianBlur(8))
    fg.alpha_composite(sh, (pos[0] + 8, pos[1] + 12)); fg.alpha_composite(c, pos)
meta = json.load(open('sprites/meta.json')); x = 600
for hid, cell in (('m14', 1), ('f07', 1), ('m10', 5), ('f09', 5), ('m08', 1)):
    st = Image.open(f'sprites/{hid}.webp').convert('RGBA'); w = meta[hid]['w']
    c = st.crop((cell * w, 0, (cell + 1) * w, 256)); hh = 150; c = c.resize((round(w * hh / 256), hh), Image.LANCZOS)
    fg.alpha_composite(c, (x, H - hh - 2)); x += c.width - 16
d = ImageDraw.Draw(fg)
draw(d, (52, 52), '108', 170, '#ffc93c', 11)
draw(d, (58, 262), 'карточная игра', 46, '#ffffff', 6)
draw(d, (58, 318), 'из ташкентских дворов', 46, '#ffffff', 6)
draw(d, (58, 400), '25 героев · легенды · онлайн', 32, '#ffe9a8', 5)
fg.convert('RGB').save(OUT + '/feature-graphic.png')

# ---------- скриншоты 1080×1920 с подписями ----------
gf = json.load(open('promo/frames_game/index.json'))
ev = {k: t for t, k in gf['events']}
def game_frame(t):
    best = gf['frames'][0][1]
    for x, n in gf['frames']:
        if x <= t: best = n
        else: break
    return 'promo/frames_game/' + best
SHOTS = [
    ('Карточная игра', 'из ташкентских дворов', game_frame(ev['chain4'] + .45), 'bg_city'),
    ('25 героев', 'с характером и эмоциями', 'store/raw/start.png', 'bg_yard'),
    ('Редкие и легендарные', 'карты с героями', 'store/raw/album.png', 'bg_yurt'),
    ('Цепочки, тузы', 'и пиковая дама −40', game_frame(ev['queen40'] + .55), 'bg_roof'),
    ('Звания, достижения', 'и партия дня', 'store/raw/profile.png', 'bg_train'),
    ('Играй с друзьями', 'онлайн по ссылке', 'store/raw/lobby.png', 'bg'),
]
for i, (l1, l2, shot, bg) in enumerate(SHOTS, 1):
    W, H = 1080, 1920
    can = cover(f'art/{bg}.webp', W, H, blur=14, dark=.45)
    d = ImageDraw.Draw(can)
    draw(d, (W / 2, 70), l1, 86, '#ffc93c', 9, anchor='c')
    draw(d, (W / 2, 172), l2, 62, '#ffffff', 7, anchor='c')
    sc = Image.open(shot).convert('RGBA')
    ph = 1580; pw = round(sc.width * ph / sc.height)
    sc = rounded(sc.resize((pw, ph), Image.LANCZOS), 56)
    frame = Image.new('RGBA', (pw + 28, ph + 28), (0, 0, 0, 0)); ImageDraw.Draw(frame).rounded_rectangle([0, 0, pw + 27, ph + 27], radius=70, fill='#1d1a2e')
    frame.alpha_composite(sc, (14, 14))
    shadow = Image.new('RGBA', frame.size, (0, 0, 0, 0)); shadow.putalpha(frame.getchannel('A').point(lambda v: int(v * .55))); shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    fx, fy = (W - frame.width) // 2, H - frame.height - 40
    can.alpha_composite(shadow, (fx + 10, fy + 16)); can.alpha_composite(frame, (fx, fy))
    can.convert('RGB').save(f'{OUT}/screenshots/{i:02d}.png')
print('store ok:', sorted(os.listdir(OUT)), sorted(os.listdir(OUT + '/screenshots')))
