"""Enemy high health hero vs our percent damage, counting only heroes that took the talent.
python3 hp_vs_pct_talents.py"""
import sqlite3
from collections import defaultdict
from hp_vs_pct import HIGH_HEALTH, tally
from pct_talents import load_builds, NO_EFFECT_VS

def effective_pct_heroes(game_id, heroes, enemy_high, builds):
    """Our heroes whose percent talents were taken and still work vs the enemy high health heroes."""
    found = []
    for hero in heroes:
        if not builds.get((game_id, hero)):
            continue
        if all((hero, e) in NO_EFFECT_VS for e in enemy_high):
            continue
        found.append(hero)
    return found

def team_heroes(db):
    heroes = defaultdict(list)
    for gid, team, hero in db.execute("SELECT game_id, team, hero FROM player_game"):
        heroes[(gid, team)].append(hero)
    return heroes

def run(db):
    builds, heroes, buckets = load_builds(), team_heroes(db), defaultdict(list)
    for gid, team, opp, won in db.execute("SELECT game_id, team, opponent, won FROM team_game"):
        enemy_high = sorted(HIGH_HEALTH & set(heroes[(gid, opp)]))
        if not enemy_high:
            continue
        effective = effective_pct_heroes(gid, heroes[(gid, team)], enemy_high, builds)
        buckets[bool(effective)].append((won, gid, team, enemy_high, effective))
    return buckets

def print_summary(buckets):
    print("Games where the enemy had Stitches/Diablo/Muradin/Deathwing")
    print("| we had a percent damage talent actually taken | record |\n|---|---|")
    for has in (True, False):
        print(f"| {'yes' if has else 'no'} | {tally([r[0] for r in buckets[has]])} |")

if __name__ == "__main__":
    b = run(sqlite3.connect("hots_s22.db"))
    print_summary(b)
    print("\nNo effective percent damage talent:")
    for won, gid, team, high, _ in b[False]:
        print(f"- {gid} {'W' if won else 'L'} {team} vs {', '.join(high)}")
