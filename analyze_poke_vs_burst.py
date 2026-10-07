"""Poke (damage outside team fights) versus fight damage, and which draft-time signals actually predict results.

Input : knowledge/raw/ngs/matches/*.json (Division C West Season 22, 56 games)
Run   : python analyze_poke_vs_burst.py
Poke   = hero damage outside team fights per minute (hero_damage minus teamfight_hero_damage).
Fight  = teamfight hero damage per minute.
Marksman set (auto attack ranged heroes, chosen by hand): see MARKSMEN.
"""
import collections, glob, json, pathlib, re, statistics

ROOT = pathlib.Path(__file__).parent
MARKSMEN = {"Greymane", "Valla", "Raynor", "Tychus", "Lunara", "Hanzo", "Cassia", "Sylvanas", "Zul'jin", "Fenix", "Falstad"}
HIGH_DAMAGE = 2400  # average hero damage per minute for a "real damage dealer"
PRA = "Phoenix Rising Amethyst"


def load_rows():
    rows = []
    for path in glob.glob(str(ROOT / "knowledge" / "raw" / "ngs" / "matches" / "*.json")):
        j = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
        m = re.match(r"(\d+) minutes? (\d+) seconds?", j["game_length"])
        mins = int(m.group(1)) + int(m.group(2)) / 60
        names = j["team_names"]
        teams = [names["team_one"]["team_name"], names["team_two"]["team_name"]]
        for side in j["players"]:
            for p in side:
                s = p["score"]
                rows.append(dict(gid=int(pathlib.Path(path).stem), team=teams[p["team"]], hero=p["hero"]["name"], won=int(p["winner"]),
                                 mins=mins, hd=s["hero_damage"], tf=s["teamfight_hero_damage"] or 0))
    return rows


def by_game(rows):
    games = collections.defaultdict(lambda: collections.defaultdict(list))
    for r in rows:
        games[r["gid"]][r["team"]].append(r)
    return games


def hero_table(rows):
    agg = collections.defaultdict(lambda: [0, 0.0, 0.0, 0.0])
    for r in rows:
        a = agg[r["hero"]]
        a[0] += 1; a[1] += r["hd"] / r["mins"]; a[2] += (r["hd"] - r["tf"]) / r["mins"]; a[3] += r["tf"] / r["mins"]
    return {h: (n, hd / n, poke / n, fight / n) for h, (n, hd, poke, fight) in agg.items()}


def team_totals(players):
    return dict(poke=sum((p["hd"] - p["tf"]) / p["mins"] for p in players), fight=sum(p["tf"] / p["mins"] for p in players), won=players[0]["won"])


def margin_record(games, key, edges):
    buckets = collections.defaultdict(lambda: [0, 0])
    for teams in games.values():
        a, b = [team_totals(p) for p in teams.values()]
        for me, opp in ((a, b), (b, a)):
            d = me[key] - opp[key]
            label = next(lbl for lo, lbl in edges if d >= lo)
            buckets[label][0] += 1; buckets[label][1] += me["won"]
    return buckets


def marksmen_record(games):
    own = collections.defaultdict(lambda: [0, 0]); cells = collections.defaultdict(lambda: [0, 0])
    for teams in games.values():
        sides = list(teams.values())
        for me, opp in ((sides[0], sides[1]), (sides[1], sides[0])):
            m = sum(p["hero"] in MARKSMEN for p in me); o = sum(p["hero"] in MARKSMEN for p in opp)
            won = me[0]["won"]
            own[min(m, 2)][0] += 1; own[min(m, 2)][1] += won
            cells[(min(m, 2), min(o, 2))][0] += 1; cells[(min(m, 2), min(o, 2))][1] += won
    return own, cells


def high_damage_record(games, table):
    out = collections.defaultdict(lambda: [0, 0])
    for teams in games.values():
        for players in teams.values():
            n = sum(table[p["hero"]][1] >= HIGH_DAMAGE and table[p["hero"]][0] >= 3 for p in players)
            out[min(n, 3)][0] += 1; out[min(n, 3)][1] += players[0]["won"]
    return out


def rec(v):
    return f"{v[1]}-{v[0] - v[1]}"


def main():
    rows = load_rows()
    games = by_game(rows)
    table = hero_table(rows)
    print("HERO poke and fight damage per minute (4+ games):")
    for h, (n, hd, poke, fight) in sorted(table.items(), key=lambda kv: -kv[1][2]):
        if n >= 4:
            print(f"  {h:11} n={n:2} poke {poke:6,.0f} fight {fight:6,.0f}")
    hits = collections.Counter()
    for teams in games.values():
        a, b = [team_totals(p) for p in teams.values()]
        for key in ("poke", "fight"):
            hits[key] += (a[key] > b[key]) == bool(a["won"])
    print("\nTeam with more poke won", hits["poke"], "of", len(games), "| more fight damage won", hits["fight"])
    edges = [(3000, "poke +3k or more"), (1000, "poke +1k to +3k"), (-1000, "within 1k"), (-3000, "poke -1k to -3k"), (-1e9, "poke -3k or worse")]
    for label, v in margin_record(games, "poke", edges).items():
        print(f"  {label:18} {rec(v)} (n={v[0]})")
    own, cells = marksmen_record(games)
    print("\nMarksmen on the team (0, 1, 2+):", {k: rec(v) for k, v in sorted(own.items())})
    print("Own marksmen v enemy marksmen:", {f"{k[0]}v{k[1]}": rec(v) for k, v in sorted(cells.items())})
    print("High damage heroes on the team:", {k: rec(v) for k, v in sorted(high_damage_record(games, table).items())})


if __name__ == "__main__":
    main()
