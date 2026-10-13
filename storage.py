"""Persist boss timer state under %APPDATA%\\AionBossTracker."""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any


APP_DIR = Path(os.environ.get("APPDATA", Path.home())) / "AionBossTracker"
STATE_PATH = APP_DIR / "state.json"


@dataclass
class BossState:
    id: str
    name: str
    location: str
    respawn_minutes: int
    custom: bool = False
    respawn_at: float | None = None  # unix timestamp
    fired_alerts: list[int] = field(default_factory=list)  # minutes thresholds already fired


def ensure_app_dir() -> None:
    APP_DIR.mkdir(parents=True, exist_ok=True)


def load_state() -> dict[str, Any]:
    ensure_app_dir()
    if not STATE_PATH.exists():
        return {"bosses": []}
    try:
        with STATE_PATH.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        if not isinstance(data, dict) or "bosses" not in data:
            return {"bosses": []}
        return data
    except (OSError, json.JSONDecodeError):
        return {"bosses": []}


def save_state(bosses: list[BossState]) -> None:
    ensure_app_dir()
    payload = {"bosses": [asdict(b) for b in bosses]}
    tmp = STATE_PATH.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    tmp.replace(STATE_PATH)


def bosses_from_payload(payload: dict[str, Any]) -> list[BossState]:
    result: list[BossState] = []
    for raw in payload.get("bosses", []):
        if not isinstance(raw, dict):
            continue
        try:
            result.append(
                BossState(
                    id=str(raw["id"]),
                    name=str(raw["name"]),
                    location=str(raw.get("location", "")),
                    respawn_minutes=int(raw["respawn_minutes"]),
                    custom=bool(raw.get("custom", False)),
                    respawn_at=raw.get("respawn_at"),
                    fired_alerts=[int(x) for x in raw.get("fired_alerts", [])],
                )
            )
        except (KeyError, TypeError, ValueError):
            continue
    return result
