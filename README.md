# «108» — карточная игра

36 карт, 2–6 игроков, кто набрал 108 очков — проиграл. Боты в браузере и онлайн с друзьями по ссылке.

## Запуск сервера
```
npm install
npm start          # http://localhost:3108
```
`server.js` раздаёт `108.html` с папками `art/`, `sprites/`, `sfx/` и держит комнаты по WebSocket (`/ws`).
Кнопка «🌐 С друзьями» → «Создать комнату» → ссылка вида `https://<хост>/?room=K7PQ`.

## Сборка 108.html
`python3 build.py` — склеивает `page.html` + `engine108.js` + `avatar.js` + `sprite.js`.

## Деплой
- **Render**: New → Blueprint → этот репозиторий (`render.yaml`), план Free.
- **Railway / Fly.io**: по `Dockerfile`.

Подробности проекта — `BRIEF.md`.
