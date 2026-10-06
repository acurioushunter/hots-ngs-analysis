"""High health frontliners vs percent damage heroes. python3 hp_vs_pct.py [TEAM]"""
import sqlite3, sys
from comps import load_comps

HIGH_HEALTH = {"Stitches", "Diablo", "Muradin", "Deathwing"}
PERCENT_DAMAGE = {"Greymane", "Tychus", "Valla", "Hanzo", "Zul'jin"}

def situation(mine, theirs):
    needs_pct = bool(HIGH_HEALTH & set(theirs))
    has_pct = bool(PERCENT_DAMAGE & set(mine))
    return needs_pct, has_pct

def tally(rows):
    wins = sum(rows)
    return f"{wins}-{len(rows) - wins}"

def run(db, team=None):
    comps, results = load_comps(db), {}
    sql = "SELECT game_id, team, opponent, won FROM team_game" + (" WHERE team=?" if team else "")
    buckets = {}
    for gid, t, opp, won in db.execute(sql, (team,) if team else ()):
        mine, theirs = comps[gid][t], comps[gid][opp]
        buckets.setdefault(situation(mine, theirs), []).append((won, gid, t, mine, theirs))
    label = team or "all teams"
    print(f"## {label}: enemy high health hero vs our percent damage hero")
    print("| enemy has Stitches/Diablo/Muradin/Deathwing | we have Greymane/Tychus/Valla/Hanzo/Zul'jin | record |\n|---|---|---|")
    for (needs, has), rows in sorted(buckets.items()):
        print(f"| {'yes' if needs else 'no'} | {'yes' if has else 'no'} | {tally([r[0] for r in rows])} |")
    return buckets

if __name__ == "__main__":
    db = sqlite3.connect("hots_s22.db")
    team = sys.argv[1] if len(sys.argv) > 1 else None
    run(db)
    if team:
        b = run(db, team)
        print(f"\nGames for {team} against a high health hero:")
        for (needs, has), rows in b.items():
            if needs:
                for won, gid, t, mine, theirs in rows:
                    print(f"- {gid} {'W' if won else 'L'} pct dmg: {'yes' if has else 'no'} | ours: {', '.join(mine)} | theirs: {', '.join(theirs)}")
