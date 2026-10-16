---
name: electron-pickup
description: >
  Сценарий «окно Electron»: само десктоп-приложение должно показать изменение.
  Триггеры: «electron», Electron, «ребилд», rebuild, пересборка, exe.
  «дев» / dev и «браузер» / browser — это скилл browser-dev, не этот.
  Если пользователь не назвал сценарий (Electron или браузер), не угадывай и спроси.
---

# Electron: подхватить изменение в окне приложения

Это сценарий **Electron**. Проверка — окно AionBossTracker, не вкладка браузера. Обновление страницы в браузере этот сценарий не закрывает.

Если пользователь не сказал, нужно окно Electron или уже запущенный dev-сервер в браузере — спроси, какой из двух сценариев. Не выбирай сам и не запускай команды, пока не ответит.

Все команды ниже — из каталога `web/`. В корне репозитория `package.json` нет. Не выдумывай npm-скрипты: отдельных `electron:restart`, `electron:reload` и «пересобрать только UI» нет.

## 1. Зависимости

Если нет `web/node_modules`, в `web/` выполни `npm install`. Хук `postinstall` сам запускает `nuxt prepare`.

## 2. Dev Electron или упакованный exe

По умолчанию — dev-окно. Полная упаковка только если пользователь просит exe, portable, `release` или `dist`.

### Dev-окно — перезапуска Electron достаточно, пакет не собирать

Скрипт `electron:dev` в `web/package.json`:

```text
concurrently -k "nuxt dev --host 127.0.0.1 --port 3000" "wait-on http://127.0.0.1:3000 && cross-env VITE_DEV_SERVER_URL=http://127.0.0.1:3000 electron ."
```

Команда: `npm run electron:dev`.

Как UI попадает в окно: `web/electron/main.cjs`, `isDev = !app.isPackaged`. Неупакованный Electron не читает `.output/public`. Он открывает `process.env.VITE_DEV_SERVER_URL` или `http://127.0.0.1:3000`. Скрипт задаёт `VITE_DEV_SERVER_URL=http://127.0.0.1:3000`. Файлы в пакет не копируются: окно грузит живой Nuxt.

- Правки Vue, страниц, компонентов и CSS подхватывает этот же Nuxt в окне Electron. `electron:build` не запускай.
- `web/electron/main.cjs`, `web/electron/preload.cjs` и нативное (`web/electron/piper-tts.cjs`, Piper, трей, IPC) читаются только при старте процесса. Отдельного скрипта перезапуска нет. Ближайшая команда: полностью выйти из текущего приложения и снова выполнить `npm run electron:dev`.
- Крестик окно только прячет. Выход — пункт «Выход» в трее (тултип «AION 2 — трекер боссов»). Иначе single-instance lock оставит старый процесс.

### Упакованный exe — нужен полный `electron:build`

Скрипт `electron:build`:

```text
npm run piper:fetch && nuxt generate && electron-builder --win portable dir && node scripts/copy-dist.mjs
```

Команда: `npm run electron:build`.

Как UI попадает в exe: `nuxt generate` пишет `web/.output/public`. `electron-builder` кладёт в пакет `electron/**/*`, `.output/public/**/*` и `package.json`. Упакованное приложение отдаёт этот каталог с `http://127.0.0.1:41787/` (`publicRoot()` в `web/electron/main.cjs`). Dev-сервер и перезапуск `electron:dev` exe не обновляют. Более короткой команды сборки в `package.json` нет.

Перед сборкой закрой старый процесс через трей → «Выход». Иначе `scripts/copy-dist.mjs` пропустит копию, если занят `dist/AionBossTracker`.

Готовые файлы: `web/release/AionBossTracker.exe`, `dist/AionBossTracker.exe`, быстрый запуск — `dist/AionBossTracker/AionBossTracker.exe`.

## 3. Как убедиться

Изменение видно в окне Electron, которое открыл `npm run electron:dev` (внутри адрес `http://127.0.0.1:3000`) или в только что собранном `AionBossTracker.exe`. Вкладка браузера не считается проверкой.
