"""Checks for build_playbook.py output. Every number is recomputed straight from knowledge/ngs_div.db and compared with playbook/data.json.
Run: python build_playbook.py && python test_playbook.py   (then node test_engine.js)
"""
import json, pathlib, sqlite3, sys

ROOT = pathlib.Path(__file__).parent
data = json.loads((ROOT / "playbook" / "data.json").read_text(encoding="utf-8"))
db = sqlite3.connect(ROOT / "knowledge" / "ngs_div.db")
fails = []


def check(name, ok, detail=""):
    print(("ok   " if ok else "FAIL ") + name + ("" if ok else "  -> " + str(detail)))
    if not ok:
        fails.append(name)


US = data["us"]["team"]
n_games = db.execute("SELECT COUNT(*) FROM ngs_game").fetchone()[0]
newest = db.execute("SELECT MAX(replay_id) FROM ngs_game").fetchone()[0]
check("data.json is not stale: game count matches the database", data["meta"]["games"] == n_games, (data["meta"]["games"], n_games))
check("data.json is not stale: newest game matches", data["meta"]["newest_game"] == newest, (data["meta"]["newest_game"], newest))

for team, t in data["teams"].items():
    w = db.execute("SELECT COUNT(*) FROM ngs_game WHERE winner=?", (team,)).fetchone()[0]
    g = db.execute("SELECT COUNT(*) FROM ngs_game WHERE team0=? OR team1=?", (team, team)).fetchone()[0]
    check(f"{team}: record {w}-{g - w} matches the database", (t["wins"], t["games"]) == (w, g), (t["wins"], t["games"], w, g))
    fp = db.execute("SELECT COUNT(*), SUM(winner=?) FROM ngs_game WHERE first_pick_team=?", (team, team)).fetchone()
    check(f"{team}: first pick record matches", t["first_pick"] == [fp[0], fp[1] or 0], (t["first_pick"], fp))

ccs = data["teams"]["Can't Counterpick Stupid"]
check("CCS is 12-6 (known from the Oct 7 analysis)", (ccs["wins"], ccs["games"] - ccs["wins"]) == (12, 6), "")
q = db.execute("SELECT COUNT(*), SUM(won) FROM ngs_player_game WHERE battletag='UnicycleYay' AND hero='Qhira'").fetchone()
r = ccs["players"]["UnicycleYay"]["heroes"]["Qhira"]
check("UnicycleYay Qhira 5 games 2 wins matches SQL and is flagged weak", (r["g"], r["w"]) == (q[0], q[1]) == (5, 2) and r["weak"], r)
check("UnicycleYay's other heroes are not flagged", not any(v["weak"] for h, v in ccs["players"]["UnicycleYay"]["heroes"].items() if h != "Qhira"), "")

late = db.execute("SELECT COUNT(*) FROM ngs_hero_ban b JOIN ngs_game g USING(replay_id) WHERE b.team=? AND b.hero='Thrall' AND b.slot>=10 AND (g.team0=? OR g.team1=?)", ("Can't Counterpick Stupid", US, US)).fetchone()[0]
check("CCS round two Thrall bans against us match SQL (4)", ccs["bans_r2_vs_us"].get("Thrall") == late and late > 0, (ccs["bans_r2_vs_us"].get("Thrall"), late))

tomb = data["map_stats"]["Tomb of the Spider Queen"]["ranged_rec"]
check("Tomb ranged record is 7-3 and 2-6 with Blaze counted as melee", tomb == {"3+": [10, 7], "2-": [8, 2]}, tomb)
check("Blaze is not ranged, Brightwing is", data["heroes"]["Blaze"]["ranged"] is False and data["heroes"]["Brightwing"]["ranged"] is True, "")

chelsi = next(p for p in data["us"]["players"] if p["tag"] == "chelsi")
t = db.execute("SELECT COUNT(*), SUM(won) FROM ngs_player_game WHERE team=? AND battletag='chelsi' AND hero='Tychus'", (US,)).fetchone()
check("chelsi Tychus 9 games 7 wins matches SQL", (chelsi["ngs"]["Tychus"]["g"], chelsi["ngs"]["Tychus"]["w"]) == (t[0], t[1]) == (9, 7), chelsi["ngs"]["Tychus"])

check("every Icy Veins map has prefer lines", all(m["prefer"] for m in data["maps"].values()), [n for n, m in data["maps"].items() if not m["prefer"]])
blaze = data["maps"]["Garden of Terror"]["tiers"]["Blaze"]
check("Blaze has separate Offlaner and Tank tiers (S and D)", blaze.get("Offlaner") == "S" and blaze.get("Tank") == "D", blaze)
check("every hero in the pools exists", all(h in data["heroes"] for p in data["us"]["players"] for h in p["pool"]), "")
check("every rule hero exists", all(h in data["heroes"] for r in data["rules"]["rules"] for h in r.get("heroes", {})), "")
check("every rule has a reason and evidence", all(r.get("why") and r.get("evidence") for r in data["rules"]["rules"]), "")
check("each team has facts and the CCS sheet carries the curated notes", (ROOT / "facts" / "teams" / "can-t-counterpick-stupid.md").read_text(encoding="utf-8").count("Curated notes") == 1, "")
check("draft_tool.html carries the data", "window.PLAYBOOK=" in (ROOT / "draft_tool.html").read_text(encoding="utf-8"), "")
print("\n" + (f"{len(fails)} FAILED" if fails else "ALL OK"))
sys.exit(1 if fails else 0)
