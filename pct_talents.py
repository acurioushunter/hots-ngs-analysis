"""Percent max-health damage talents per hero, from Icy Veins slot order.
Key = (tier index, 1-based slot). Tiers: 0=L1 1=L4 2=L7 3=L10 4=L13 5=L16 6=L20.
Pages carry update dates; Tychus page is from 2021 (unverified for current patch).
Sylvanas L1 needs a slow, so it does nothing vs Deathwing."""

PCT_TALENTS = {
    "Hanzo":    {(5, 3): "Giant Slayer"},
    "Greymane": {(3, 2): "Cursed Bullet", (5, 3): "Alpha Killer", (6, 2): "Gilnean Roulette"},
    "Leoric":   {(4, 3): "Spectral Leech", (5, 1): "Crushing Hope"},
    "Tychus":   {(5, 2): "Titan Grenade", (5, 3): "Sizzlin' Attacks"},
    "Zul'jin":  {(5, 1): "No Mercy!"},
    "Sylvanas": {(0, 3): "Overwhelming Affliction"},
    "Valla":    {(5, 3): "Manticore"},
}
NO_EFFECT_VS = {("Sylvanas", "Deathwing")}
UNKNOWN = "-"
LETTER_TO_SLOT = {c: i for i, c in enumerate("abcdef")}

def taken_slot(code, tier):
    """Slot number taken at a tier, or None if not taken or the code is truncated."""
    if tier >= len(code) or code[tier] == UNKNOWN:
        return None
    slot = LETTER_TO_SLOT[code[tier]]
    return slot or None

def pct_talents_taken(hero, code):
    """Names of percent damage talents taken by this hero build."""
    return [name for (tier, slot), name in PCT_TALENTS.get(hero, {}).items()
            if taken_slot(code, tier) == slot]

def load_builds(path="talents_raw.txt"):
    """{(game_id, hero): [talent names]} for every hero with a percent damage talent list."""
    builds = {}
    for line in open(path):
        gid, rest = line.strip().split("|", 1)
        for entry in rest.split(","):
            _, hero, code = entry.split("~")
            if hero in PCT_TALENTS:
                builds[(int(gid), hero)] = pct_talents_taken(hero, code)
    return builds

if __name__ == "__main__":
    for (gid, hero), taken in sorted(load_builds().items()):
        print(gid, hero, taken or "none")
