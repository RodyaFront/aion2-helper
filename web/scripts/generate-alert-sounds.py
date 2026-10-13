#!/usr/bin/env python3
"""Synthesize one urgency-coded boss alert family (ping / warning / alert).

Design basis (Edworthy / Suied urgency coding):
  - Same timbre family (soft sine + light harmonics)
  - Escalation via burst count, shorter IOI, higher pitch, higher level
  - No square-wave clicks

Short UI one-shots are levelled by RMS + peak ceiling (not EBU R128 loudnorm,
which is unreliable under ~1s).

Targets (file RMS dBFS approx via peak/RMS calibrate):
  ping    quieter, 1 burst
  warning mid,     2 bursts, IOI 220 ms
  alert   louder,  4 bursts, IOI 140 ms
"""

from __future__ import annotations

import json
import math
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

SR = 44100
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "sounds"
TMP = ROOT / "scripts" / ".sound-tmp"

SPECS = {
  "ping": {
    "bursts": 1,
    "ioi_ms": None,
    "freqs": [780.0],
    "burst_s": 0.30,
    "target_rms": 0.055,
    "peak_ceil": 10 ** (-12 / 20),  # -12 dBFS
    "max_duration_s": 0.7,
  },
  "warning": {
    "bursts": 2,
    "ioi_ms": 220,
    "freqs": [820.0, 980.0],
    "burst_s": 0.26,
    "target_rms": 0.11,
    "peak_ceil": 10 ** (-6 / 20),  # -6 dBFS
    "max_duration_s": 1.0,
  },
  "alert": {
    "bursts": 4,
    "ioi_ms": 140,
    "freqs": [900.0, 1000.0, 1100.0, 1175.0],
    "burst_s": 0.18,
    "target_rms": 0.20,
    "peak_ceil": 10 ** (-1.5 / 20),  # -1.5 dBFS
    "max_duration_s": 1.3,
  },
}


def burst(freq: float, dur: float, amp: float = 1.0) -> np.ndarray:
  n = max(1, int(dur * SR))
  t = np.arange(n, dtype=np.float64) / SR
  fund = np.sin(2 * math.pi * freq * t)
  harm2 = 0.22 * np.sin(2 * math.pi * (freq * 2) * t)
  harm3 = 0.08 * np.sin(2 * math.pi * (freq * 3) * t)
  chirp = 0.10 * np.sin(2 * math.pi * freq * (1.0 + 0.04 * (t / max(dur, 1e-6))) * t)
  raw = fund + harm2 + harm3 + chirp
  att = max(1, int(0.012 * SR))
  rel = max(1, int(min(0.14, dur * 0.55) * SR))
  env = np.ones(n, dtype=np.float64)
  env[:att] = np.linspace(0.0, 1.0, att, endpoint=True) ** 1.5
  if rel < n:
    env[-rel:] = (np.linspace(1.0, 0.0, rel, endpoint=True) ** 1.8)
  env *= np.exp(-t * (2.6 if dur < 0.25 else 2.1))
  return (raw * env * amp).astype(np.float64)


def render_tier(name: str) -> np.ndarray:
  spec = SPECS[name]
  bursts = int(spec["bursts"])
  freqs = list(spec["freqs"])
  assert len(freqs) == bursts
  ioi = spec["ioi_ms"]
  burst_s = float(spec["burst_s"])
  parts: list[np.ndarray] = []
  for i, f in enumerate(freqs):
    amp = 0.82 + 0.18 * (i / max(1, bursts - 1))
    parts.append(burst(f, burst_s, amp=amp))
    if ioi is not None and i < bursts - 1:
      # Keep nominal IOI (onset-to-onset) ≈ ioi_ms
      onset_gap = int((ioi / 1000.0) * SR)
      # If burst longer than IOI, abut with tiny spacer
      spacer = max(int(0.02 * SR), onset_gap - int(burst_s * SR))
      parts.append(np.zeros(spacer, dtype=np.float64))
  audio = np.concatenate(parts) if parts else np.zeros(1)
  pad = int(0.025 * SR)
  audio = np.concatenate([np.zeros(pad), audio, np.zeros(pad)])
  return calibrate(audio, float(spec["target_rms"]), float(spec["peak_ceil"]))


def calibrate(audio: np.ndarray, target_rms: float, peak_ceil: float) -> np.ndarray:
  # Active-region RMS (ignore near-silent pads)
  mask = np.abs(audio) > 1e-4
  if not np.any(mask):
    return audio
  rms = float(np.sqrt(np.mean(audio[mask] ** 2))) or 1e-6
  scaled = audio * (target_rms / rms)
  peak = float(np.max(np.abs(scaled))) or 1e-6
  if peak > peak_ceil:
    scaled *= peak_ceil / peak
  return scaled


def write_wav(path: Path, mono: np.ndarray) -> None:
  path.parent.mkdir(parents=True, exist_ok=True)
  pcm = np.clip(mono, -1.0, 1.0)
  pcm_i16 = (pcm * 32767.0).astype(np.int16)
  with wave.open(str(path), "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm_i16.tobytes())


def encode_ogg(wav_in: Path, ogg_out: Path) -> None:
  ogg_out.parent.mkdir(parents=True, exist_ok=True)
  subprocess.run(
    [
      "ffmpeg", "-hide_banner", "-y", "-loglevel", "error",
      "-i", str(wav_in),
      "-c:a", "libvorbis", "-q:a", "5",
      str(ogg_out),
    ],
    check=True,
  )


def main() -> int:
  OUT.mkdir(parents=True, exist_ok=True)
  TMP.mkdir(parents=True, exist_ok=True)
  meta = {"family": "aion-boss-urgency-v1", "sample_rate": SR, "tiers": {}}

  for name, spec in SPECS.items():
    audio = render_tier(name)
    wav = TMP / f"boss-{name}.wav"
    write_wav(wav, audio)
    ogg = OUT / f"boss-{name}.ogg"
    encode_ogg(wav, ogg)
    dur = len(audio) / SR
    meta["tiers"][name] = {
      "bursts": spec["bursts"],
      "ioi_ms": spec["ioi_ms"],
      "target_rms": spec["target_rms"],
      "max_duration_s": spec["max_duration_s"],
      "file": f"boss-{name}.ogg",
      "synth_duration_s": round(dur, 3),
    }
    print(
      f"boss-{name}: bursts={spec['bursts']} ioi={spec['ioi_ms']} "
      f"dur={dur:.3f}s -> {ogg.relative_to(ROOT)}",
    )

  meta_path = OUT / "boss-alert-meta.json"
  meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
  print(f"meta -> {meta_path.relative_to(ROOT)}")
  return 0


if __name__ == "__main__":
  try:
    raise SystemExit(main())
  except FileNotFoundError as e:
    print("ffmpeg/python dependency missing", e, file=sys.stderr)
    raise SystemExit(1) from e
  except subprocess.CalledProcessError as e:
    print(f"ffmpeg failed: {e}", file=sys.stderr)
    raise SystemExit(1) from e
