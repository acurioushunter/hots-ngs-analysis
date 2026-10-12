"""Checks for knowledge/ngs_season.db (every saved NGS Season 22 game, all divisions). Prints OK when everything holds."""
import glob, pathlib, sqlite3, sys

ROOT = pathlib.Path(__file__).parent / "knowledge"
SEASON = int(sys.argv[1]) if len(sys.argv) > 1 else 22
db = sqlite3.connect(ROOT / ("ngs_season.db" if SEASON == 22 else f"ngs_season{SEASON}.db"))
fails = []


def check(name, cond, detail=""):
    if not cond:
        fails.append(f"{name} {detail}")


import json
paths = (glob.glob(str(ROOT / "raw/ngs/matches/*.json")) + glob.glob(str(ROOT / "raw/ngs/other_divisions/*.json"))) if SEASON == 22 else glob.glob(str(ROOT / f"raw/ngs/season{SEASON}/*.json"))
played = sum(1 for p in paths if json.loads(pathlib.Path(p).read_text(encoding="utf-8")).get("first_pick") in (0, 1))
n = db.execute("SELECT COUNT(*) FROM ngs_game").fetchone()[0]
check("one game row per played match page (forfeits skipped)", n == played, f"{n} rows, {played} played of {len(paths)} files")
check("every game has 10 player rows", db.execute("SELECT COUNT(*) FROM (SELECT replay_id FROM ngs_player_game GROUP BY 1 HAVING COUNT(*)<>10)").fetchone()[0] == 0)
check("winner is one of the two teams", db.execute("SELECT COUNT(*) FROM ngs_game WHERE winner NOT IN (team0, team1)").fetchone()[0] == 0)
check("every game has a division", db.execute("SELECT COUNT(*) FROM ngs_game WHERE division IS NULL").fetchone()[0] == 0)
check("every player row has a Heroes Profile id", db.execute("SELECT COUNT(*) FROM ngs_player_game WHERE blizz_id IS NULL").fetchone()[0] == 0)
check("a team is in one division only", db.execute("SELECT COUNT(*) FROM (SELECT t FROM (SELECT team0 t, division d FROM ngs_game UNION SELECT team1, division FROM ngs_game) GROUP BY t HAVING COUNT(*)>1)").fetchone()[0] == 0)
if SEASON == 22:
    div = sqlite3.connect(ROOT / "ngs_div.db")
    a = div.execute("SELECT COUNT(*), SUM(winner=team0) FROM ngs_game").fetchone()
    b = db.execute("SELECT COUNT(*), SUM(winner=team0) FROM ngs_game WHERE division='C West'").fetchone()
    check("Division C West matches ngs_div.db", a == b, f"{a} vs {b}")
if fails:
    print("FAILED:\n" + "\n".join(fails))
    sys.exit(1)
print("OK")
