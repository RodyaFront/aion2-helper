"""Generate Windows app + tray icons for AionBossTracker (night ops / gold ready)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "electron" / "icons"

BG = (17, 16, 24, 255)  # --color-bg
ELEV = (28, 26, 38, 255)
GOLD = (212, 169, 58, 255)  # --color-ready
GOLD_SOFT = (212, 169, 58, 220)
TEAL = (58, 143, 136, 255)  # --color-active
LINE = (46, 44, 58, 255)


def rounded_rect(draw: ImageDraw.ImageDraw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    pad = max(1, size // 16)
    radius = max(2, size // 6)
    rounded_rect(d, (pad, pad, size - pad - 1, size - pad - 1), radius, BG)

    # Inner plate
    inset = max(2, size // 10)
    rounded_rect(
        d,
        (pad + inset // 2, pad + inset // 2, size - pad - inset // 2 - 1, size - pad - inset // 2 - 1),
        max(2, radius - 2),
        ELEV,
    )

    cx = cy = size / 2
    # Timer ring (teal arc track + gold progress)
    r = size * 0.30
    width = max(2, size // 10)
    bbox = [cx - r, cy - r, cx + r, cy + r]
    d.arc(bbox, start=0, end=360, fill=LINE, width=width)
    d.arc(bbox, start=-60, end=200, fill=TEAL, width=width)
    d.arc(bbox, start=200, end=300, fill=GOLD, width=width)

    # Center pin / ready mark
    pin_r = size * 0.09
    d.ellipse([cx - pin_r, cy - pin_r * 1.15, cx + pin_r, cy + pin_r * 0.85], fill=GOLD)
    # small diamond tip under pin
    tip = [
        (cx, cy + pin_r * 1.55),
        (cx - pin_r * 0.55, cy + pin_r * 0.55),
        (cx + pin_r * 0.55, cy + pin_r * 0.55),
    ]
    d.polygon(tip, fill=GOLD_SOFT)

    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    master = draw_icon(512)
    master.save(OUT / "icon.png", optimize=True)

    # Multi-size ICO for Windows exe / taskbar
    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    ico_images = [draw_icon(s) for s in ico_sizes]
    ico_images[-1].save(
        OUT / "icon.ico",
        format="ICO",
        sizes=[(s, s) for s in ico_sizes],
        append_images=ico_images[:-1],
    )

    # Tray: crisp 16 + 32 (Windows picks)
    draw_icon(16).save(OUT / "tray-16.png", optimize=True)
    draw_icon(32).save(OUT / "tray-32.png", optimize=True)
    draw_icon(32).save(OUT / "tray.png", optimize=True)

    print(f"Wrote icons -> {OUT}")


if __name__ == "__main__":
    main()
