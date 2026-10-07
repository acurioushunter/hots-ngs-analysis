"""Whole-picture analysis of every Division C West Season 22 game played by Can't Counterpick Stupid.

Input : knowledge/raw/ngs/matches/*.json and knowledge/ngs_div.db
Run   : python analyze_ccs_full.py
Prints team totals per game, wins versus losses, healer splits, role splits, and the Garden of Terror game in detail.
"""
import glob, json, pathlib, re, collections, statistics as st

ROOT = pathlib.Path(__file__).parent
CCS = "Can't Counterpick Stupid"
ABBR = {"Phoenix Rising Amethyst": "PRA", "COSMOS": "COS", "Good Lordy": "GL", "Roll1Esports": "R1", "Anomaly": "ANO", CCS: "CCS"}


def load_games():
    games = []
    for path in sorted(glob.glob(str(ROOT / "knowledge" / "raw" / "ngs" / "matches" / "*.json"))):
        j = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
        names = [j["team_names"]["team_one"]["team_name"], j["team_names"]["team_two"]["team_name"]]
        if CCS not in names:
            continue
        m = re.match(r"(\d+) minutes? (\d+) seconds?", j["game_length"])
        mins = int(m.group(1)) + int(m.group(2)) / 60
        teams = {n: [] for n in names}
        for side in j["players"]:
            for p in side:
                teams[names[p["team"]]].append(p)
        opp = [n for n in names if n != CCS][0]
        won = any(p["winner"] for p in teams[CCS])
        games.append(dict(id=int(pathlib.Path(path).stem), map=j["game_map"]["name"], mins=mins, opp=opp, won=won, teams=teams, raw=j))
    return games


def S(players, key):
    return sum((p["score"][key] or 0) for p in players)


def team_stats(players, mins):
    return dict(
        td=S(players, "takedowns"), deaths=S(players, "deaths"), dead=S(players, "time_spent_dead") / 60,
        hd=S(players, "hero_damage") / mins / 1000, tf=S(players, "teamfight_hero_damage") / mins / 1000,
        minion=S(players, "minion_damage") / mins / 1000, camp=S(players, "creep_damage") / mins / 1000,
        struct=S(players, "structure_damage") / mins / 1000, xp=S(players, "experience_contribution") / mins / 1000,
        camps=S(players, "merc_camp_captures"), heal=S(players, "healing") / mins / 1000,
        taken=S(players, "damage_taken") / mins / 1000, level=statistics_mean([p["score"]["level"] for p in players]),
    )


def statistics_mean(v):
    return sum(v) / len(v)


def healer(players):
    return [p["hero"]["name"] for p in players if p["hero"]["new_role"] == "Healer"]


def main():
    games = load_games()
    print("TEAM TOTALS PER GAME (per minute, k)  [CCS | opponent]")
    rows = []
    for g in games:
        a = team_stats(g["teams"][CCS], g["mins"]); b = team_stats(g["teams"][g["opp"]], g["mins"])
        rows.append((g, a, b))
        print(f"{g['id']} {g['map'][:12]:12} {ABBR[g['opp']]:3} {'W' if g['won'] else 'L'} {g['mins']:4.1f}m TD {a['td']}-{b['td']} D {a['deaths']}-{b['deaths']} "
              f"dead {a['dead']:.1f}-{b['dead']:.1f} fight {a['tf']:.1f}-{b['tf']:.1f} poke {a['hd']-a['tf']:.1f}-{b['hd']-b['tf']:.1f} "
              f"minion {a['minion']:.1f}-{b['minion']:.1f} camp {a['camp']:.1f}-{b['camp']:.1f} struct {a['struct']:.1f}-{b['struct']:.1f} xp {a['xp']:.2f}-{b['xp']:.2f} lvl {a['level']:.0f}-{b['level']:.0f}")
    print("\nCCS WINS vs LOSSES (mean difference CCS minus opponent)")
    for label, flag in (("wins", True), ("losses", False)):
        sel = [(a, b) for g, a, b in rows if g["won"] == flag]
        print(label, len(sel), {k: round(statistics_mean([a[k] - b[k] for a, b in sel]), 2) for k in ("td", "deaths", "dead", "tf", "hd", "minion", "camp", "struct", "xp", "heal", "taken")})
    print("\nHEALER SPLIT: opposing healer in each CCS game")
    split = collections.defaultdict(lambda: [0, 0]); per = collections.defaultdict(lambda: [0, 0])
    for g, a, b in rows:
        hs = healer(g["teams"][g["opp"]]); mine = healer(g["teams"][CCS])
        key = "Brightwing or Anduin" if any(h in ("Brightwing", "Anduin") for h in hs) else "any other healer"
        split[key][0] += 1; split[key][1] += g["won"]
        for h in hs:
            per[h][0] += 1; per[h][1] += g["won"]
        print(g["id"], ABBR[g["opp"]], "opp healer", hs, "| CCS healer", mine, "W" if g["won"] else "L")
    print({k: f"{v[1]}-{v[0]-v[1]}" for k, v in split.items()})
    print({k: f"{v[1]}-{v[0]-v[1]}" for k, v in sorted(per.items(), key=lambda kv: -kv[1][0])})
    print("\nCCS PLAYERS in wins vs losses (per game averages)")
    stats = collections.defaultdict(lambda: collections.defaultdict(list))
    for g in games:
        for p in g["teams"][CCS]:
            s = p["score"]; bucket = "W" if g["won"] else "L"
            stats[p["battletag"]][bucket].append((s["hero_damage"] / g["mins"], s["teamfight_hero_damage"] / g["mins"], s["deaths"], s["time_spent_dead"], s["damage_taken"] / g["mins"], s["total_rank"] if "total_rank" in s else p.get("total_rank")))
    for who, d in stats.items():
        for b in ("W", "L"):
            v = d[b]
            if v:
                print(f"{who[:12]:12} {b} n={len(v)} dmg/min {statistics_mean([x[0] for x in v]):6.0f} fightdmg/min {statistics_mean([x[1] for x in v]):6.0f} deaths {statistics_mean([x[2] for x in v]):.1f} dead s {statistics_mean([x[3] for x in v]):.0f} taken/min {statistics_mean([x[4] for x in v]):6.0f} rating {statistics_mean([x[5] for x in v]):.0f}")
    print("\nQHIRA self healing and damage taken vs rest of CCS team")
    for g in games:
        for p in g["teams"][CCS]:
            if p["hero"]["name"] == "Qhira":
                others = [q for q in g["teams"][CCS] if q is not p]
                s = p["score"]
                print(g["id"], "Qhira selfheal", s["self_healing"], "taken", s["damage_taken"], "tf taken", s["teamfight_damage_taken"], "| teammates max selfheal", max(q["score"]["self_healing"] or 0 for q in others), "max taken", max(q["score"]["damage_taken"] for q in others))
    print("\nGARDEN 23230 both rosters")
    g = next(x for x in games if x["id"] == 23230)
    for t in (CCS, g["opp"]):
        for p in sorted(g["teams"][t], key=lambda p: -p["score"]["hero_damage"]):
            s = p["score"]
            print(f"{ABBR[t]} {p['battletag'][:11]:11} {p['hero']['name']:11} {p['hero']['new_role']:15} {s['kills']}/{s['deaths']}/{s['assists']} hd {s['hero_damage']//1000}k tf {(s['teamfight_hero_damage'] or 0)//1000}k taken {s['damage_taken']//1000}k heal {s['healing']//1000}k self {(s['self_healing'] or 0)//1000}k struct {s['structure_damage']//1000}k min {s['minion_damage']//1000}k camp {s['creep_damage']//1000}k camps {s['merc_camp_captures']} dead {s['time_spent_dead']}s xp {s['experience_contribution']//1000}k rank {p['total_rank']}")


if __name__ == "__main__":
    main()
