"""Default Verteron field bosses for AION 2 (Elyos / Lamuatan)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class BossDef:
    id: str
    name: str
    location: str
    respawn_minutes: int


# Intervals from community global measurements (kill-based respawn).
VERTERON_BOSSES: list[BossDef] = [
    BossDef("kernon_west", "Kernon of the West", "Cantas Valley", 30),
    BossDef("neikel_east", "Neikel of the East", "Dawn Legion Base", 30),
    BossDef("rotten_kutar", "Rotten Kutar", "Marsh Legion Campsite", 30),
    BossDef("blooming_korin", "Blooming Korin", "Ellun River Midstream", 60),
    BossDef("bodyguard_teegant", "Bodyguard Teegant", "Destroyed Abyss Gate", 90),
    BossDef("kusan_mad", "Kusan the Mad Gladiator", "Verteron Fortress Ruins", 120),
    BossDef("ritualist_garshim", "Ritualist Garshim", "Verteron Fortress Ruins", 120),
    BossDef("scholar_aulla", "Scholar Aulla", "Aullaeu Village", 120),
    BossDef("chaser_taulo", "Chaser Taulo", "Forest of Exiles", 120),
    BossDef("bloodfang_pnyn", "Bloodfang Pnyn", "Northern Tolbas Forest", 180),
    BossDef("furious_saursus", "Furious Saursus", "Night Dew Cave", 180),
    BossDef("heretic_layla", "Heretic Layla", "Rock Tomb Hill", 180),
    BossDef("harvest_moshav", "Harvest Manager Moshav", "Drana Plantation", 180),
    BossDef("black_tentacle_lawa", "Black Tentacle Lawa", "Ancient Zumion Temple Site", 240),
    BossDef("forest_aullamu", "Forest Warrior Aullamu", "Aullaeu Village", 240),
    BossDef("centurion_demiros", "Centurion Demiros", "Destroyed Temple Site", 240),
    BossDef("sentinel_knash", "Sentinel K'nash", "Drana Transport Hub", 240),
    BossDef("divine_ansas", "Divine Ansas", "Contaminated Sanctum", 360),
    BossDef("phantasm_kasia", "Phantasm Kasia", "Garden of the Illusion God", 360),
    BossDef("soul_kashapa", "Soul Ruler Kashapa", "Ancient Zumion Temple Site", 360),
    BossDef("researcher_setram", "Researcher Setram", "Nahid Brigade Fortress", 360),
    BossDef("silent_dartan", "Silent Dartan", "Southern Altamia Highland", 360),
    BossDef("high_commander_lagta", "High Commander Lagta", "Drana Plantation", 720),
    BossDef("eternal_gartua", "Eternal Gartua", "Forest of Exiles", 720),
]


def format_interval(minutes: int) -> str:
    if minutes < 60:
        return f"{minutes} мин"
    hours, rem = divmod(minutes, 60)
    if rem == 0:
        return f"{hours} ч"
    return f"{hours} ч {rem} мин"
