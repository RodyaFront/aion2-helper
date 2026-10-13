# Boss alert sounds — urgency family v1

Original parametric synthesis for AionBossTracker (not third-party sample packs).

| File | Role | Design |
|------|------|--------|
| `boss-ping.ogg` | 15 min | 1 soft burst, lower pitch/level |
| `boss-warning.ogg` | 10 min | 2 bursts, IOI 220 ms |
| `boss-alert.ogg` | 10 sec | 4 bursts, IOI 140 ms, higher pitch/level |
| `boss-alert-meta.json` | — | burst/IOI metadata for validators |

Timbre: shared soft sine + light harmonics (no square clicks). Escalation follows auditory warning research (Edworthy et al. perceived urgency; Suied et al. IOI / reaction time).

Regenerate and validate:

```bash
npm run sounds:generate
npm run sounds:validate
```
