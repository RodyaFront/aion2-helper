# Session dashboard — calibration captures

The watcher maps Kinah (`930100031` / bound `930100001`) and Abyss Points (`930100003`) from the item catalog. Inventory frames carry the **new absolute** wallet size; session nets are `new − previous` (first sighting is baseline). Aggregate id `930100030` (Kina All) is ignored.

**Gather / resource-node metrics are not implemented:** the protocol has no reliable “gathered item X × N” event. Do not calibrate gather via EnvRemove.

## Mode

From `web/electron/native/boss-kill-watcher/publish` (or after `npm run build:watcher`):

```bash
./boss-kill-watcher.exe calib > calib-YYYY-MM-DD.txt
```

Keep a parallel text note: `HH:MM:SS → what you saw on screen`.

## Checklist

| Tag | In game | Note |
| --- | --- | --- |
| Kinah+ | Earn Kinah (mob / sell / quest) | Exact + amount |
| Kinah− | Buy something | Exact − amount |
| AP+ / AP− | Gain and spend Abyss Points | Exact deltas |
| Kill log | Kill 5–10 normal mobs | Names + loot |
| Loot sanity | Pick up ground loot | Matches loot window |

## What to send

1. `calib-….txt` (stdout JSON lines with `"type":"calib"`).
2. Your time → event → number notes (and optional screenshots).

Engineering matches `itemId` against your notes and updates `shared/session/currency.ts` + `assets/aion2/protocol/currency.json` if ids moved.
