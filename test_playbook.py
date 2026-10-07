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
# ---------------------------------------------------------------- library (heroes, builds, maps, guides)
import re
lib = json.loads((ROOT / "playbook" / "library.json").read_text(encoding="utf-8"))
kdb = sqlite3.connect(ROOT / "knowledge" / "hots_knowledge.db")
DASHES = re.compile("[—–]")
check("library covers every hero in data.json", set(data["heroes"]) <= set(lib["heroes"]), sorted(set(data["heroes"]) - set(lib["heroes"])))
n_talents = kdb.execute("SELECT COUNT(*) FROM talent").fetchone()[0]
lib_talents = sum(len(t["opts"]) for h in lib["heroes"].values() for t in h["talents"])
check("library holds every talent in the Icy Veins database", lib_talents == n_talents, (lib_talents, n_talents))
check("every library hero has an overview", all(h.get("overview") for h in lib["heroes"].values()), [n for n, h in lib["heroes"].items() if not h.get("overview")])
codes_text = (ROOT / "knowledge" / "icy_build_codes.txt").read_text(encoding="utf-8")
raw_codes = re.findall(r"\[T(\d+),(\w+)\]", codes_text)
lib_codes = [c for h in lib["heroes"].values() for c in h.get("codes", [])]
check("every build code in the sheet is decoded (none dropped)", len(raw_codes) == len(lib_codes) == lib["build_codes"] and not lib["build_code_problems"], (len(raw_codes), len(lib_codes), lib["build_code_problems"]))
q = lib["heroes"]["Qhira"]["codes"][0]
digits = re.search(r"T(\d+)", q["code"]).group(1)
sql_names = [kdb.execute("SELECT name FROM talent WHERE slug='qhira' AND level=? AND slot=?", (lv, int(d))).fetchone()[0] for lv, d in zip([1, 4, 7, 10, 13, 16, 20], digits)]
check("Qhira's build code decodes to the talent names in the database", [p["name"] for p in q["picks"]] == sql_names, (q["picks"], sql_names))
check("Chromie's code uses her own talent levels (1, 2, 5, 8, 11, 14, 18)", [p["level"] for p in lib["heroes"]["Chromie"]["codes"][0]["picks"]] == [1, 2, 5, 8, 11, 14, 18], lib["heroes"]["Chromie"]["codes"][0]["picks"])
check("The Lost Vikings has a decoded code", bool(lib["heroes"]["The Lost Vikings"].get("codes")), "")
check("every Division map has a library guide", all(m in lib["maps"] and lib["maps"][m]["sections"] for m in data["maps"]), [m for m in data["maps"] if m not in lib["maps"]])
check("the map guides carry the lane formations or objective", all(any("Objective" in s["title"] or "Formation" in s["title"] for s in lib["maps"][m]["sections"]) for m in data["maps"]), "")
check("glossary has terms and the guides are not empty", len(lib["glossary"]) > 100 and all(g["sections"] for g in lib["guides"]), len(lib["glossary"]))
fp = db.execute("SELECT COUNT(*), SUM(winner=first_pick_team) FROM ngs_game").fetchone()
mp = db.execute("SELECT COUNT(*), SUM(winner=map_pick_team) FROM ngs_game").fetchone()
want = f"won {fp[1]}-{fp[0] - fp[1]} ({fp[0]} games). The team that picked the map won {mp[1]}-{mp[0] - mp[1]}"
check("division fact: first pick and map pick records match SQL", want in lib["facts"][0]["text"], (lib["facts"][0]["text"], fp, mp))
tips = (ROOT / "playbook" / "notes" / "draft_tips.md").read_text(encoding="utf-8")
check("draft tips exist and have no em dashes, en dashes or spaced hyphens", len(tips) > 500 and not DASHES.search(tips) and " - " not in tips, "")
check("no em or en dashes in the library text (Hunter reads them as AI giveaways)", not DASHES.search(json.dumps(lib, ensure_ascii=False)), "")
page = (ROOT / "draft_tool.html").read_text(encoding="utf-8")
head = page.split("<script>")[0]
check("draft_tool.html carries the library and the hero sheet", "window.LIBRARY=" in page and 'id="sheet"' in page and not DASHES.search(head), "")
check("the artifact fragment carries the library", "window.LIBRARY=" in (ROOT / "draft_tool_artifact.html").read_text(encoding="utf-8"), "")

print("\n" + (f"{len(fails)} FAILED" if fails else "ALL OK"))
sys.exit(1 if fails else 0)
