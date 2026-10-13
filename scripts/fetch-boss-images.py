"""Download Verteron field-boss portraits from aion2data.com into public/bosses."""

from __future__ import annotations

import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "web" / "public" / "bosses"
BASE = "https://aion2data.com/game/monsters"

# Mapped from aion2data.com/bosses card markup (UT_256_MOB_*).
BOSS_ICONS: dict[str, str] = {
    "kernon_west": "UT_256_MOB_Keneir_01_V02.webp",
    "neikel_east": "UT_256_MOB_Keneir_01_V03.webp",
    "rotten_kutar": "UT_256_MOB_BigMan_01_V03.webp",
    "blooming_korin": "UT_256_MOB_Coradon_01.webp",
    "bodyguard_teegant": "UT_256_MOB_Neuth_03_V01.webp",
    "kusan_mad": "UT_256_MOB_KrallElite_01.webp",
    "ritualist_garshim": "UT_256_MOB_KrallElite_01.webp",
    "scholar_aulla": "UT_256_MOB_OwlMagic_01.webp",
    "chaser_taulo": "UT_256_MOB_OwlElite_01_V01.webp",
    "bloodfang_pnyn": "UT_256_MOB_KalnifElite_01_V01.webp",
    "furious_saursus": "UT_256_MOB_UrsussElite_01_V01.webp",
    "heretic_layla": "UT_256_MOB_SuraPriest_01_V04.webp",
    "harvest_moshav": "UT_256_MOB_DrakanElite_03_V01.webp",
    "black_tentacle_lawa": "UT_256_MOB_NagaElite_05.webp",
    "forest_aullamu": "UT_256_MOB_OwlElite_01_V01.webp",
    "centurion_demiros": "UT_256_MOB_Undead_01.webp",
    "sentinel_knash": "UT_256_MOB_BeritraD_04_V01.webp",
    "divine_ansas": "UT_256_MOB_Guardit_03.webp",
    # Card markup hid these two; nearest confirmed family icons from client dumps:
    "phantasm_kasia": "UT_256_MOB_SpiritKnt_02.webp",
    "soul_kashapa": "UT_256_MOB_Kashapa_01.webp",
    "researcher_setram": "UT_256_MOB_DrakanElite_01.webp",
    "silent_dartan": "UT_256_MOB_BeritraD_01.webp",
    "high_commander_lagta": "UT_256_MOB_Lagta_01.webp",
    "eternal_gartua": "UT_256_MOB_Gartua_01_V02.webp",
}


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    for boss_id, filename in BOSS_ICONS.items():
        dest = ROOT / f"{boss_id}.webp"
        url = f"{BASE}/{filename}"
        print(f"GET {url}")
        req = urllib.request.Request(url, headers={"User-Agent": "AionBossTracker/1.0"})
        with urllib.request.urlopen(req, timeout=40) as resp:
            data = resp.read()
        dest.write_bytes(data)
        print(f"  -> {dest} ({len(data)} bytes)")


if __name__ == "__main__":
    main()
