"""Checks for ngs_div.db: structure must be complete, and must agree with the older hots_s22.db where both have the game."""
import pathlib, sqlite3

ROOT = pathlib.Path(__file__).parent
db = sqlite3.connect(ROOT / "knowledge" / "ngs_div.db")
old = sqlite3.connect(ROOT / "hots_s22.db")
bad = []


def check(ok, msg):
    if not ok:
        bad.append(msg)


games = [r[0] for r in db.execute("SELECT replay_id FROM ngs_game")]
check(len(games) >= 53, f"only {len(games)} games")

for gid in games:
    players = db.execute("SELECT COUNT(*), SUM(won) FROM ngs_player_game WHERE replay_id=?", (gid,)).fetchone()
    check(players == (10, 5), f"{gid}: players {players}")
    picks = db.execute("SELECT COUNT(*) FROM ngs_pick WHERE replay_id=?", (gid,)).fetchone()[0]
    check(10 <= picks <= 11, f"{gid}: {picks} picks")  # 11 when a drafted hero was swapped out
    bans = db.execute("SELECT COUNT(*) FROM ngs_hero_ban WHERE replay_id=?", (gid,)).fetchone()[0]
    check(4 <= bans <= 6, f"{gid}: {bans} hero bans")
    unattributed = db.execute("SELECT COUNT(*) FROM ngs_pick WHERE replay_id=? AND team IS NULL UNION ALL SELECT COUNT(*) FROM ngs_hero_ban WHERE replay_id=? AND team IS NULL", (gid, gid)).fetchall()
    check(all(u[0] == 0 for u in unattributed), f"{gid}: pick or ban without a team")

# Agreement with the older hand built database (same games, same winners, same heroes).
for gid, winner in db.execute("SELECT replay_id, winner FROM ngs_game"):
    row = old.execute("SELECT winner FROM game WHERE game_id=?", (gid,)).fetchone()
    if row:
        check(row[0].upper() == winner.upper(), f"{gid}: winner {winner} vs {row[0]}")
        new_heroes = sorted(h for (h,) in db.execute("SELECT hero FROM ngs_player_game WHERE replay_id=?", (gid,)))
        old_heroes = sorted(h for (h,) in old.execute("SELECT hero FROM player_game WHERE game_id=?", (gid,)))
        check(new_heroes == old_heroes, f"{gid}: hero lists differ")
        new_bans = sorted(h for (h,) in db.execute("SELECT hero FROM ngs_hero_ban WHERE replay_id=?", (gid,)))
        old_bans = sorted(h for (h,) in old.execute("SELECT hero FROM ban WHERE game_id=?", (gid,)))
        check(new_bans == old_bans, f"{gid}: bans differ {new_bans} vs {old_bans}")

# Every series has its map bans (two per team).
for (series,) in db.execute("SELECT DISTINCT series FROM ngs_game"):
    n = db.execute("SELECT COUNT(*) FROM ngs_map_ban WHERE series=?", (series,)).fetchone()[0]
    check(n in (0, 4), f"{series}: {n} map bans")

print("FAILED:" if bad else "OK", *bad[:25], sep="\n")
raise SystemExit(bool(bad))
