# AION 2 Boss Tracker

Nuxt + TypeScript UI, упакованный в Electron `.exe`. Сервер Lamuatan, полевые боссы Вертерона.

## Запуск

Двойной клик:

`d:\Aion2BossTracker\dist\AionBossTracker.exe`

То же лежит в `web\release\AionBossTracker.exe`.

## Разработка

```powershell
cd d:\Aion2BossTracker\web
npm run dev              # браузер
npm run electron:dev     # окно Electron на localhost
npm run electron:build   # portable .exe
npm run fetch:images     # перекачать портреты в public/bosses
```

## UX

- Карточки с портретами, местом и интервалом
- **Только что убит** — полный цикл
- **Своё время** — минуты с карты в игре (inline, без лишних окон)
- Готовые и ближайшие респауны сверху
- Поиск, фильтры: все / идут / готовы / без таймера
- Сводка в шапке: активные, готовые, ближайший босс
- `/` — фокус в поиск
- Оповещение за 15 / 10 / 5 мин: звук + toast + Windows notification
- Состояние в `localStorage`

Портреты скачаны с aion2data (client icons `UT_256_MOB_*`) и лежат локально в `web/public/bosses`.
