#!/usr/bin/env python3
"""Превью ссылки (art/og.jpg 1200×630) и иконки (art/icon-192.png, art/icon-512.png).
Нужны шрифты Rubik 900 (latin + cyrillic) в TTF: путь к папке — первый аргумент."""
import sys, json
from PIL import Image, ImageDraw, ImageFont, ImageFilter
T = sys.argv[1].rstrip('/') + '/'
def fonts(size): return ImageFont.truetype(T + 'rubik-latin.ttf', size), ImageFont.truetype(T + 'rubik-cyrillic.ttf', size)
def runs(text):
    out = []
    for ch in text:
        cyr = 'Ѐ' <= ch <= 'ӿ'
        if out and out[-1][0] == cyr: out[-1][1] += ch
        else: out.append([cyr, ch])
    return out
def width(text, size):
    L, C = fonts(size); return sum((C if c else L).getlength(t) for c, t in runs(text))
def draw(d, xy, text, size, fill, stroke=0, sfill='#1d1a2e', anchor='l'):
    L, C = fonts(size); x, y = xy
    if anchor == 'c': x -= width(text, size) / 2
    for c, t in runs(text):
        f = C if c else L
        d.text((x, y), t, font=f, fill=fill, stroke_width=stroke, stroke_fill=sfill); x += f.getlength(t)

W, H = 1200, 630
bg = Image.open('art/src/bg_city.png').convert('RGB')
k = max(W / bg.width, H / bg.height); bg = bg.resize((round(bg.width * k), round(bg.height * k)), Image.LANCZOS)
x0 = (bg.width - W) // 2; im = bg.crop((x0, 0, x0 + W, H)).convert('RGBA')
grad = Image.new('RGBA', (W, H)); gd = ImageDraw.Draw(grad)
for x in range(W): gd.line([(x, 0), (x, H)], fill=(18, 16, 38, int(200 * max(0, 1 - x / 760))))
im.alpha_composite(grad)
grad2 = Image.new('RGBA', (W, H)); g2 = ImageDraw.Draw(grad2)
for y in range(H): g2.line([(0, y), (W, y)], fill=(18, 16, 38, int(150 * max(0, (y - 380) / 250))))
im.alpha_composite(grad2)
def card(path, w=170):
    c = Image.open(path).convert('RGBA'); h = round(w * 102 / 72); c = c.resize((w, h), Image.LANCZOS)
    m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=18, fill=255)
    out = Image.new('RGBA', (w + 16, h + 16), (0, 0, 0, 0)); bd = ImageDraw.Draw(out)
    bd.rounded_rectangle([0, 0, w + 15, h + 15], radius=24, fill='#1d1a2e'); bd.rounded_rectangle([4, 4, w + 11, h + 11], radius=21, fill='#ffd34d')
    ci = Image.new('RGBA', (w, h)); ci.paste(c, (0, 0), m); out.alpha_composite(ci, (8, 8))
    return out
for path, ang, pos in (('art/legend_AS.webp', 14, (900, 120)), ('art/legend_KH.webp', -2, (790, 95)), ('art/legend_QS.webp', -16, (680, 125))):
    c = card(path).rotate(ang, expand=True, resample=Image.BICUBIC)
    sh = Image.new('RGBA', c.size, (0, 0, 0, 0)); sh.putalpha(c.getchannel('A').point(lambda v: int(v * .55))); sh = sh.filter(ImageFilter.GaussianBlur(8))
    im.alpha_composite(sh, (pos[0] + 10, pos[1] + 14)); im.alpha_composite(c, pos)
meta = json.load(open('sprites/meta.json'))
x = 640
for hid, cell in (('m14', 1), ('f07', 1), ('m10', 5), ('f09', 5), ('m08', 1)):
    st = Image.open(f'sprites/{hid}.webp').convert('RGBA'); w = meta[hid]['w']
    c = st.crop((cell * w, 0, (cell + 1) * w, 256)); hh = 170; c = c.resize((round(w * hh / 256), hh), Image.LANCZOS)
    im.alpha_composite(c, (x, H - hh - 4)); x += c.width - 14
d = ImageDraw.Draw(im)
draw(d, (60, 60), '108', 200, '#ffc93c', 12)
draw(d, (66, 300), 'карточная игра из чайханы', 44, '#ffffff', 6)
draw(d, (66, 372), '25 героев · редкие карты', 34, '#ffe9a8', 5)
draw(d, (66, 418), 'партия дня · игра с друзьями', 34, '#ffe9a8', 5)
draw(d, (66, 540), 'game-108.onrender.com', 30, '#8de3a5', 5)
im.convert('RGB').save('art/og.jpg', quality=86)
for S in (512, 192):
    ic = Image.new('RGBA', (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(ic)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=S // 5, fill='#0f4c4c')
    cw, ch = S * .34, S * .48
    for ang, dx, col in ((-14, -.13, '#ff6b6b'), (12, .13, '#4f7bd9')):
        cc = Image.new('RGBA', (int(cw) + 8, int(ch) + 8), (0, 0, 0, 0)); cd = ImageDraw.Draw(cc)
        cd.rounded_rectangle([0, 0, cw + 7, ch + 7], radius=S // 24, fill='#1d1a2e'); cd.rounded_rectangle([S // 64, S // 64, cw + 7 - S // 64, ch + 7 - S // 64], radius=S // 28, fill='#fff7e6')
        cd.rounded_rectangle([S * .04, S * .04, cw + 7 - S * .04, ch + 7 - S * .04], radius=S // 36, fill=col)
        cc = cc.rotate(ang, expand=True, resample=Image.BICUBIC)
        ic.alpha_composite(cc, (int(S / 2 - cc.width / 2 + dx * S), int(S * .2)))
    d = ImageDraw.Draw(ic)
    draw(d, (S / 2, S * .44), '108', int(S * .36), '#ffc93c', max(3, S // 28), anchor='c')
    ic.save(f'art/icon-{S}.png')
print('og + icons ok')
