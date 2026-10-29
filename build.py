#!/usr/bin/env python3
"""Сборка 108.html: page.html + engine108.js + avatar.js + sprite.js.
Спрайты лежат рядом в папке sprites/ (108.html ссылается на sprites/<id>.webp)."""
import os
here = os.path.dirname(os.path.abspath(__file__))
rd = lambda n: open(os.path.join(here, n), encoding='utf-8').read()
s = rd('page.html')
s = s.replace('/*__ENGINE__*/', rd('engine108.js')).replace('/*__AVATAR__*/', rd('avatar.js')).replace('/*__SPRITE__*/', rd('sprite.js'))


open(os.path.join(here, '108.html'), 'w', encoding='utf-8').write(s)
print('108.html:', len(s.encode('utf-8')) // 1024, 'KB')
