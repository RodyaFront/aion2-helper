# boss-kill-watcher

Death-only Npcap sidecar for Aion Boss Tracker. Adapted from
[SkeeveAN/Aion-DPS-Meter](https://github.com/SkeeveAN/Aion-DPS-Meter) (MIT).

## Build

Requires [.NET 8 SDK](https://dotnet.microsoft.com/download).

```bash
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o publish
```

Or from `web/`: `npm run build:watcher`

## Modes

| Arg | Output |
| --- | --- |
| `detect` | `{"ok":true,"status":"ok",…}` or missing |
| `watch` | status + `death` / `field_sync` + session events (`loot`, `inventory`, `mob_kill`) |
| `calib` | same as `watch`, plus `{"type":"calib",…}` for currency calibration |

Requires [Npcap](https://npcap.com) (WinPcap API-compatible mode recommended).

Session calibration notes: [`web/docs/SESSION_CALIBRATION.md`](../../../docs/SESSION_CALIBRATION.md).

Gather / resource-node session metrics are **not** supported (no reliable gather-success packet on the wire).
