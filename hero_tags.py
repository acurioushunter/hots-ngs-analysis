"""Hero knowledge table: role plus playstyle tags. Edit freely, the analysis reads this file.
Roles follow the official role list on Icy Veins (checked Oct 2026). Style tags are my own judgment.

Style tags (first tag is the primary identity, second is secondary):
  poke   = long range damage, zoning, sieging (wins by whittling the enemy before fights)
  dive   = jumps in on backline, picks off targets, needs engage or mobility
  engage = starts fights with crowd control (hooks, stuns, big initiations)
  brawl  = strong in sustained close teamfights (survivability, cleave, AoE)
  push   = fast wave and camp clear, drives objectives and lanes
  sustain= out-heals or out-lasts damage
  burst  = high short window damage (watch cooldowns)
"""

HEROES = {
    # Tanks
    "Anub'arak": ("Tank", ["engage", "brawl"]),
    "Arthas": ("Tank", ["brawl", "push", "sustain"]),
    "Blaze": ("Tank", ["poke", "push"]),
    "Diablo": ("Tank", ["engage", "dive"]),
    "E.T.C.": ("Tank", ["engage", "brawl"]),
    "Garrosh": ("Tank", ["engage", "dive"]),
    "Johanna": ("Tank", ["engage", "brawl"]),
    "Mei": ("Tank", ["poke", "engage"]),
    "Muradin": ("Tank", ["engage", "brawl"]),
    "Stitches": ("Tank", ["engage", "brawl"]),
    "Tyrael": ("Tank", ["brawl", "sustain"]),
    # Bruisers
    "Artanis": ("Bruiser", ["dive", "brawl"]),
    "Deathwing": ("Bruiser", ["dive", "burst"]),
    "Dehaka": ("Bruiser", ["dive", "sustain"]),
    "Hogger": ("Bruiser", ["brawl", "dive"]),
    "Imperius": ("Bruiser", ["brawl", "sustain"]),
    "Leoric": ("Bruiser", ["brawl", "sustain"]),
    "Ragnaros": ("Bruiser", ["poke", "brawl", "push"]),
    "Rexxar": ("Bruiser", ["brawl", "push"]),
    "Sonya": ("Bruiser", ["brawl", "dive"]),
    "Thrall": ("Bruiser", ["brawl", "dive"]),
    "Varian": ("Bruiser", ["dive", "brawl", "engage"]),
    "Yrel": ("Bruiser", ["brawl", "sustain"]),
    # Healers
    "Ana": ("Healer", ["poke", "burst"]),
    "Anduin": ("Healer", ["engage", "sustain"]),
    "Auriel": ("Healer", ["sustain", "brawl"]),
    "Brightwing": ("Healer", ["sustain", "dive"]),
    "Deckard": ("Healer", ["sustain", "brawl"]),
    "Kharazim": ("Healer", ["dive", "sustain"]),
    "Li Li": ("Healer", ["sustain", "poke"]),
    "Malfurion": ("Healer", ["sustain", "brawl"]),
    "Rehgar": ("Healer", ["brawl", "sustain"]),
    "Uther": ("Healer", ["sustain", "brawl"]),
    "Whitemane": ("Healer", ["sustain", "brawl"]),
    # Supports
    "Abathur": ("Support", ["push", "poke"]),
    "Stukov": ("Healer", ["poke", "sustain"]),
    "Tassadar": ("Ranged", ["poke", "sustain"]),
    "The Lost Vikings": ("Support", ["push"]),
    "Tyrande": ("Healer", ["poke", "dive"]),
    # Ranged assassins
    "Azmodan": ("Ranged", ["poke", "push"]),
    "Cassia": ("Ranged", ["poke", "push"]),
    "Chromie": ("Ranged", ["poke", "burst"]),
    "Falstad": ("Ranged", ["dive", "burst"]),
    "Fenix": ("Ranged", ["brawl", "burst"]),
    "Gazlowe": ("Bruiser", ["poke", "push"]),
    "Greymane": ("Ranged", ["brawl", "burst"]),
    "Gul'dan": ("Ranged", ["poke", "burst"]),
    "Hanzo": ("Ranged", ["poke", "burst"]),
    "Jaina": ("Ranged", ["poke", "burst"]),
    "Junkrat": ("Ranged", ["poke", "push"]),
    "Kael'thas": ("Ranged", ["poke", "burst"]),
    "Li-Ming": ("Ranged", ["poke", "burst"]),
    "Lunara": ("Ranged", ["poke", "push"]),
    "Mephisto": ("Ranged", ["poke", "brawl"]),
    "Nazeebo": ("Ranged", ["push", "brawl"]),
    "Orphea": ("Ranged", ["poke", "burst"]),
    "Raynor": ("Ranged", ["brawl", "push"]),
    "Sylvanas": ("Ranged", ["poke", "push"]),
    "Tracer": ("Ranged", ["dive", "burst"]),
    "Tychus": ("Ranged", ["brawl", "burst"]),
    "Valla": ("Ranged", ["brawl", "burst"]),
    "Zagara": ("Ranged", ["push", "poke"]),
    "Zul'jin": ("Ranged", ["brawl", "burst"]),
    # Melee assassins
    "Alarak": ("Melee", ["dive", "burst"]),
    "Illidan": ("Melee", ["dive", "burst"]),
    "Kerrigan": ("Melee", ["dive", "burst"]),
    "Maiev": ("Melee", ["dive", "burst"]),
    "Qhira": ("Melee", ["dive", "burst"]),
    "Valeera": ("Melee", ["dive", "burst"]),
}

STYLE_FIELDS = ("poke", "dive", "engage", "brawl", "push", "sustain", "burst")
