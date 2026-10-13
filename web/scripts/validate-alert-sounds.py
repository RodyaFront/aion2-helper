#!/usr/bin/env python3
"""Validate urgency-coded boss alert samples against hard gates.

Gates:
  1. mean_volume(ping) < mean_volume(warning) < mean_volume(alert)  (dB, more negative = quieter)
  2. max_volume ladder with clear gaps
  3. Burst counts from meta match brief (1 / 2 / 4)
  4. IOI_warning > IOI_alert
  5. Duration limits: ping<=0.7, warning<=1.0, alert<=1.3
  6. Peak <= -1 dBFS
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "sounds"
META = OUT / "boss-alert-meta.json"

TIERS = ("ping", "warning", "alert")
MAX_DUR = {"ping": 0.7, "warning": 1.0, "alert": 1.3}
EXPECTED_BURSTS = {"ping": 1, "warning": 2, "alert": 4}


def ffprobe_duration(path: Path) -> float:
  r = subprocess.run(
    [
      "ffprobe", "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      str(path),
    ],
    check=True,
    capture_output=True,
    text=True,
  )
  return float(r.stdout.strip())


def measure_volumes(path: Path) -> tuple[float, float]:
  r = subprocess.run(
    [
      "ffmpeg", "-hide_banner", "-i", str(path),
      "-af", "volumedetect",
      "-f", "null", "-",
    ],
    check=True,
    capture_output=True,
    text=True,
    encoding="utf-8",
    errors="replace",
  )
  err = r.stderr
  m_mean = re.search(r"mean_volume:\s*([-\d.]+)\s*dB", err)
  m_max = re.search(r"max_volume:\s*([-\d.]+)\s*dB", err)
  if not m_mean or not m_max:
    raise RuntimeError(f"volumedetect parse failed for {path.name}\n{err[-800:]}")
  return float(m_mean.group(1)), float(m_max.group(1))


def main() -> int:
  errors: list[str] = []
  if not META.is_file():
    print(f"FAIL: missing {META}", file=sys.stderr)
    return 1

  meta = json.loads(META.read_text(encoding="utf-8"))
  tiers_meta = meta.get("tiers") or {}
  results: dict[str, dict] = {}

  print("tier       bursts  ioi_ms  dur_s   mean_dB  max_dB   file")
  print("-" * 72)

  for tier in TIERS:
    tm = tiers_meta.get(tier)
    if not tm:
      errors.append(f"{tier}: missing meta.tiers.{tier}")
      continue
    path = OUT / tm["file"]
    if not path.is_file():
      errors.append(f"{tier}: missing file {path}")
      continue

    bursts = int(tm["bursts"])
    ioi = tm.get("ioi_ms")
    dur = ffprobe_duration(path)
    mean_db, max_db = measure_volumes(path)
    results[tier] = {
      "bursts": bursts,
      "ioi": ioi,
      "dur": dur,
      "mean": mean_db,
      "max": max_db,
      "path": path,
    }

    print(
      f"{tier:<10} {bursts:<7} {str(ioi):<7} {dur:<7.3f} {mean_db:<8.1f} {max_db:<8.1f} {path.name}",
    )

    if bursts != EXPECTED_BURSTS[tier]:
      errors.append(f"{tier}: bursts={bursts} expected {EXPECTED_BURSTS[tier]}")
    if dur > MAX_DUR[tier] + 0.08:
      errors.append(f"{tier}: duration {dur:.3f}s > max {MAX_DUR[tier]}s")
    if max_db > -1.0 + 0.2:
      errors.append(f"{tier}: peak {max_db:.2f} dB > -1 dBFS")

  if "warning" in results and "alert" in results:
    w_ioi = results["warning"]["ioi"]
    a_ioi = results["alert"]["ioi"]
    if w_ioi is None or a_ioi is None:
      errors.append("IOI missing in meta for warning/alert")
    elif not (w_ioi > a_ioi):
      errors.append(f"IOI gate failed: warning {w_ioi} ms must be > alert {a_ioi} ms")

  if all(t in results for t in TIERS):
    pm, wm, am = results["ping"]["mean"], results["warning"]["mean"], results["alert"]["mean"]
    px, wx, ax = results["ping"]["max"], results["warning"]["max"], results["alert"]["max"]
    # More negative mean = quieter. Require clear steps.
    if not (pm < wm - 2.0 and wm < am - 2.0):
      errors.append(
        f"mean loudness ladder failed: ping {pm:.1f} < warning {wm:.1f} < alert {am:.1f} "
        f"(need >=2 dB gaps)",
      )
    if not (px < wx - 1.5 and wx < ax - 1.0):
      errors.append(
        f"peak ladder failed: ping {px:.1f} < warning {wx:.1f} < alert {ax:.1f}",
      )

  print("-" * 72)
  if errors:
    print("FAIL:")
    for e in errors:
      print(f"  - {e}")
    return 1

  print("PASS: urgency gates OK")
  return 0


if __name__ == "__main__":
  try:
    raise SystemExit(main())
  except subprocess.CalledProcessError as e:
    print(f"ffmpeg/ffprobe failed: {e}", file=sys.stderr)
    raise SystemExit(1) from e
