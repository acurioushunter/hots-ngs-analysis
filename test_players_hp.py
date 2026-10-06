"""Cross checks for players_hp.db: detail rows must add up to each player's own Storm League totals."""
import sqlite3, pathlib

db = sqlite3.connect(pathlib.Path(__file__).parent / "knowledge" / "players_hp.db")
bad = []

for tag, wins, losses in db.execute("SELECT tag, sl_wins, sl_losses FROM sp_player"):
    games = wins + losses
    for table, scope_filter in (("sp_hero", "AND scope='sl'"), ("sp_map", ""), ("sp_role", "")):
        total = db.execute(f"SELECT COALESCE(SUM(games),0) FROM {table} WHERE tag=? {scope_filter}", (tag,)).fetchone()[0]
        if total != games:
            bad.append(f"{tag}: {table} games {total} vs profile {games}")
    # recent seasons can never exceed the career total
    recent = db.execute("SELECT COALESCE(SUM(games),0) FROM sp_hero WHERE tag=? AND scope IN ('s32','s33','s34')", (tag,)).fetchone()[0]
    if recent > games:
        bad.append(f"{tag}: seasons 32 to 34 show {recent} games, more than career {games}")

if not db.execute("SELECT COUNT(*) FROM sp_player").fetchone()[0]:
    bad.append("no players loaded")
print("FAILED:" if bad else "OK", *bad[:20], sep="\n")
raise SystemExit(bool(bad))
