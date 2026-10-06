"""Cross checks for ngs.db: detail rows must add up to the headline totals, and match what we already trust."""
import sqlite3, pathlib

db = sqlite3.connect(pathlib.Path(__file__).parent / "knowledge" / "ngs.db")
bad = []


def check(ok, msg):
    if not ok:
        bad.append(msg)


# 1. A player's hero rows must add up to the games in their summary (every game has exactly one hero).
for tag, scope, total, hero_games in db.execute(
        """SELECT s.battletag, s.scope, s.total_games, COALESCE(SUM(h.games),0) FROM player_summary s
           LEFT JOIN player_hero h ON h.battletag=s.battletag AND h.blizz_id=s.blizz_id AND h.scope=s.scope
           GROUP BY s.battletag, s.blizz_id, s.scope"""):
    check(total == hero_games, f"{tag} {scope}: summary {total} games vs hero rows {hero_games}")

# 2. Team hero rows: each game has 5 of our heroes.
for team, total, hero_games in db.execute(
        "SELECT s.team, s.total_games, COALESCE(SUM(h.games),0) FROM team_summary s LEFT JOIN team_hero h ON h.team=s.team GROUP BY s.team"):
    check(hero_games == 5 * total, f"{team}: {hero_games} hero games vs 5 x {total}")

# 3. Facts already confirmed elsewhere: PRA is 12-8 and hunterstag is 12-8 in season 22; all time 50-25.
pra = db.execute("SELECT wins, losses FROM team_summary WHERE team='Phoenix Rising Amethyst'").fetchone()
check(pra == (12, 8), f"PRA record {pra}")
h22 = db.execute("SELECT wins, losses FROM player_summary WHERE battletag='hunterstag' AND scope='s22'").fetchone()
check(h22 == (12, 8), f"hunterstag s22 {h22}")
hall = db.execute("SELECT wins, losses FROM player_summary WHERE battletag='hunterstag' AND scope='all'").fetchone()
check(hall == (50, 25), f"hunterstag all time {hall}")

print("FAILED:" if bad else "OK", *bad[:20], sep="\n")
raise SystemExit(bool(bad))
