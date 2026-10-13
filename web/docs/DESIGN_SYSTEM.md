# Design system — AION 2 Boss Tracker

Single source of truth for tokens: `app/assets/css/tokens.css`.  
Anti-cliche checklist: `docs/AI_VISUAL_CLICHES.md`.  
Feature CSS (`main.css`) and components must use variables from that file. No one-off hex, `px`, or magic gaps in card markup.

Timer + settings persist across app restarts via Electron `userData` JSON (`shared/persist.ts`); localStorage is a browser/dev mirror only.

---

## 1. Product intent

This is a **scan-first utility** for long play sessions: glance at many bosses, instantly see who is ready or imminent, start a timer after a kill. Visual language is **night field ops** — deep cool surfaces, warm gold for “go”, teal for “counting”, coral for “soon”. Not marketing landing, not generic SaaS pills.

---

## 2. Spacing system

### Base unit

| Token | rem | px @16 | Role |
| --- | --- | --- | --- |
| `--space-1` | 0.25 | 4 | Hairline: chip padding-y, icon gaps |
| `--space-2` | 0.5 | 8 | Tight related controls (secondary actions) |
| `--space-3` | 0.75 | 12 | Inner card cluster gaps |
| `--space-4` | 1 | 16 | Default padding (card body, inputs) |
| `--space-5` | 1.25 | 20 | Header / toolbar rhythm |
| `--space-6` | 1.5 | 24 | Page gutters |
| `--space-8` | 2 | 32 | Empty states, large breath |
| `--space-10` | 2.5 | 40 | Rare; major section breaks |

### Rules

1. **Only use the scale.** If a value is not on the scale, pick the nearest token or add a named layout token (e.g. `--card-art-width`), never invent `0.85rem` in a component.
2. **Proximity = relation.** Elements that belong together sit ≤ `--space-2` apart. Separate clusters use `--space-3`–`--space-4`.
3. **Padding before gap.** Outer padding of a container is usually one step larger than internal gaps (`padding: space-4`, `gap: space-3`).
4. **One vertical rhythm per card.** Card stack: art/meta row → primary action → secondary row → optional panel. Each band uses the same horizontal inset (`--space-4` / `--space-3`).
5. **Countdown owns space.** The timer block gets `margin-top: auto` inside the meta column so it sits on a consistent baseline across cards of different name lengths.

### Card anatomy (spacing)

```
┌── 1px border ─────────────────────────────────┐
│ art            │ pad space-3/4                │
│ --card-art-    │ title + chip   (gap space-2) │
│ width          │ loc            (space-1)     │
│                │ interval       (space-2)     │
│                │ countdown      (mt auto)     │
├────────────────┴──────────────────────────────┤
│ primary CTA          pad-x space-3  gap-2     │
│ secondary ghosts     gap space-1              │
└───────────────────────────────────────────────┘
```

---

## 3. Color system and psychology

### Surfaces

| Token | Role | Why |
| --- | --- | --- |
| `--color-bg` | App canvas | Near-black cool navy reduces glare; long sessions |
| `--color-bg-card` | Card body | Slight lift from canvas = figure/ground without loud borders |
| `--color-bg-elev` | Inputs, toolbar | Controls read as interactive, not content |
| `--color-line` | Structure | Default card edge; status overrides `border-color` |

Atmosphere glows (`--glow-active`, `--glow-ready`) are **tint only** — they brand the night sky without competing with status colors.

### Text hierarchy

| Token | Use |
| --- | --- |
| `--color-text` | Titles, countdown (with status override) |
| `--color-text-muted` | Location, captions |
| `--color-text-faint` | Labels, idle chrome, hints |

Never use pure white (`#fff`) for body text; slight cool off-white keeps contrast high without harshness on OLED.

### Status semantics

| Status | Hue family | Tokens | Psychology |
| --- | --- | --- | --- |
| **Idle** | Neutral slate | faint / line | Low priority; desaturate card (`opacity`) so active farm targets win the scan |
| **Active** | Teal / green | `--color-active*` | Progress, “timer running”, safe wait — calming, not alarm |
| **Urgent** | Coral / warm orange | `--color-urgent*` | Approaching deadline (≤15 min). Warm, mobilizing; avoid pure red (reserved for destructive) |
| **Ready** | Gold / amber | `--color-ready*` | Reward / “go now”. Highest luminance among statuses so it pops on dark UI |
| **Danger** | Soft red | `--color-danger*` | Destructive actions only (delete), never timer state |

### Contrast rules

1. Status color appears in **three places max** on a card: border, chip, countdown. Same hue, different roles.
2. Ready and urgent must **not** share a hue family (previous failure mode: both gold).
3. Soft fills (`*-soft`) are for backgrounds/chips; solid hues for border, countdown, emphasis text.
4. Primary button uses active green — it means “commit kill / start cycle”, aligned with active state language.

---

## 4. Typography

| Role | Token | Notes |
| --- | --- | --- |
| UI body | `--font-sans` | Segoe stack; offline-safe on Windows |
| Titles | `--font-display` | Constantia/Cambria — slight classical weight without web font fetch |
| Timers | `--font-mono` + `tabular-nums` | Stable width while digits tick |

Page title → `--text-2xl` + display. Card title → `--text-lg` + display. Countdown → `--text-countdown` + mono.

---

## 5. Interaction states (buttons)

Cascade rule: variant hover/active must set **background, border-color, and color** explicitly. Never rely on `.btn:hover` alone for `.btn-primary` — same specificity lets the default hover wipe the green fill (bug seen as dark button + green outline text).

| Variant | Rest | Hover | Active (press) | Focus-visible |
| --- | --- | --- | --- | --- |
| Default `.btn` | elev + line | card-hover + brighter line | deeper press + `translateY` | `--shadow-focus-ring` |
| `.btn-primary` | green gradient + ink | `--color-btn-primary-hover` + glow | `--color-btn-primary-active` | focus ring + glow |
| `.btn-ghost` | transparent + muted | active-soft + active-text | wash-strong | focus ring |
| `.btn-danger` | danger-soft | danger-soft-hover | danger-soft-active | focus ring |
| `.filter-btn` | muted | wash | wash-strong | — |
| `.filter-btn.is-active` | active-soft (wins over hover) | same | same | — |

Tokens: `--color-btn-primary-hover`, `--color-btn-primary-active`, `--press-offset`, `--shadow-focus-ring`, `--shadow-primary-hover`.

## 6. Motion

| Token / class | When | Principle |
| --- | --- | --- |
| Ready pulse | `is-ready` | Soft gold ring — “available” without seizure risk |
| Urgent breathe | `is-urgent` | Border luminance only |
| Toast / modal in | enter | Short ease-out, ≤250ms |
| Button press | `:active` | 1px down via `--press-offset` |

Honor `prefers-reduced-motion: reduce` (status animations off). Motion reinforces status; it must not be the only signal (color + chip + countdown remain).

---

## 7. Grid states (scan hierarchy)

Priority on a card: **status + countdown > kill CTA**.

| State | Card | Kill CTA | Grid |
| --- | --- | --- | --- |
| Idle | desaturated, lower opacity | `btn-primary` «Только что убит» | default |
| Active (>15м) | teal border | quiet outline «Перезапустить таймер» | default / focus if filter Перерождаются ≤3 |
| Urgent (≤15м) | coral wash + breathe | quiet outline | same |
| Ready | gold pulse | `btn-ready` «Убит снова» | focus if filter Готовы ≤3 |

- Filter bar copy: `В фильтре «X»: N · всего M` (stats in header stay global).
- `formatInterval`: seconds if <1 мин; never emit `0 ч` for sub-hour values.
- Focus grid: `--grid-card-min-focus`, larger countdown.

## 8. Settings

- Tab nav: `.app-tabs` / `.app-tab` (same elev surface language as filters).
- Volume: `stores/settings.ts` → `--` no new color tokens; slider uses `accent-color: var(--color-active)`.
- Gain is linear 0–1 from UI 0–100%; Web Audio peaks multiply by gain.

## 9. Reuse checklist

Before adding UI:

1. Is there a token for this color/spacing? Use it.
2. If not, add to `tokens.css` and document the **why** here (one sentence).
3. Do not hardcode `#…`, `Npx`, or `0.XXrem` in component `<style>` or ad-hoc rules.
4. Status styling goes through modifiers (`is-idle|active|urgent|ready`) tied to semantic tokens.

---

## 10. Anti-patterns (rejected)

- Pill-stat soup and equal-weight button walls (scan fails).
- Purple neon / generic AI dashboard gradients.
- Ready and urgent both amber.
- Countdown smaller than the location line.
- One-off spacing “to make this card look good” without updating the scale.
