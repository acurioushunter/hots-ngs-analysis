"""Cross checks: our compact tables must reproduce Heroes Profile's own headline numbers."""
import sqlite3, pathlib

db = sqlite3.connect(pathlib.Path(__file__).parent / "knowledge" / "hunter_hp.db")
bad = []


def one(sql, *args):
    return db.execute(sql, args).fetchone()[0]


for scope, where in (("all", "1=1"), ("sl", "game_type='sl'")):
    wins = int(one("SELECT value FROM hp_profile WHERE scope=? AND key='wins'", scope))
    losses = int(one("SELECT value FROM hp_profile WHERE scope=? AND key='losses'", scope))
    game_wins = one(f"SELECT COALESCE(SUM(won),0) FROM hp_game WHERE {where}")
    game_losses = one(f"SELECT COUNT(*)-COALESCE(SUM(won),0) FROM hp_game WHERE {where}")
    if (wins, losses) != (game_wins, game_losses):
        bad.append(f"{scope}: profile {wins}-{losses} vs match history {game_wins}-{game_losses}")
    hero_games = one("SELECT COALESCE(SUM(games),0) FROM hp_hero WHERE scope=?", scope)
    if hero_games != wins + losses:
        bad.append(f"{scope}: hero table games {hero_games} vs profile {wins + losses}")

print("FAILED:" if bad else "OK", *bad, sep="\n")
raise SystemExit(bool(bad))
