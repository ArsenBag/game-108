# Рекламный ролик «108» (вертикальный 1080×1920, 30 с)

1. `node promo/setup.js` — сценарная раздача (цепочка семёрок «бери 8», легендарные Т♠ и Д♠, закрытие пиковой дамой −40) → `promo/state.json`.
2. `node server.js` (порт 3108), затем `node promo/capture.js` — снимает игру на «телефоне» 390×844 ×3 в режиме `?promo=1`,
   в 4 раза замедленно (таймеры и анимации), кадры и время событий → `promo/frames_game/`.
3. `python3 -m http.server 3110 --directory .` и `node promo/render.js` — покадровый рендер сцен `promo/stage.html` (30 к/с) → `promo/frames_video/`.
4. `cd promo && python3 music.py` — синтезированная музыка (120 BPM, хиджаз от ре) + звуки игры на событиях → `promo/audio.wav`.
5. `ffmpeg -framerate 30 -i promo/frames_video/%04d.jpg -i promo/audio.wav -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart -c:a aac -b:a 192k -shortest promo/108_promo.mp4`

Сцены и тайминг — `SEG`, `GAME_CUTS`, `CAPS` в начале скрипта `stage.html`. Шрифт Rubik (OFL) — `promo/fonts/`.
