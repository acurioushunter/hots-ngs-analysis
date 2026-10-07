"""Wave clear, camps and objective analysis for Division C West Season 22.

Input : knowledge/ngs_div.db, knowledge/raw/ngs/matches/*.json (hero type), knowledge/hots_knowledge.db (Icy Veins map draft advice)
Output: tables printed as markdown (used by WAVE_CLEAR_AND_MAP_GUIDE.md). Run: python analyze_wave_clear.py
"""
import collections, glob, json, pathlib, sqlite3

ROOT = pathlib.Path(__file__).parent
DIV = sqlite3.connect(ROOT / "knowledge" / "ngs_div.db")
KB = sqlite3.connect(ROOT / "knowledge" / "hots_knowledge.db")
PRA, CCS, COS = "Phoenix Rising Amethyst", "Can't Counterpick Stupid", "COSMOS"
OUR_POOL = {"hunterstag": {"Junkrat", "Sylvanas", "Orphea", "Chromie", "Cassia", "Mephisto", "Tychus"},
            "chelsi": {"Thrall", "Tychus", "Chromie", "Tassadar", "Gul'dan", "Azmodan"},
            "SoulShepherd": {"Leoric", "Blaze", "Dehaka", "Rexxar", "Stitches"},
            "NorthrnTouch": {"Johanna", "Muradin", "E.T.C.", "Varian", "Tyrael", "Anub'arak"},
            "Ltlbearista": {"Brightwing", "Rehgar", "Anduin", "Stukov"}}
HIGH_CLEAR = 3500  # minion damage per minute


def team_games():
    rows = DIV.execute("""SELECT g.replay_id, g.map, g.length_sec, p.team, MAX(p.won), SUM(p.minion_damage), SUM(p.creep_damage),
                          SUM(p.structure_damage), SUM(p.xp_contribution), SUM(p.takedowns), SUM(p.deaths), GROUP_CONCAT(p.hero)
                          FROM ngs_game g JOIN ngs_player_game p USING(replay_id) GROUP BY g.replay_id, p.team""").fetchall()
    keys = ("id", "map", "sec", "team", "won", "minion", "camps", "struct", "xp", "td", "deaths", "heroes")
    return [dict(zip(keys, r)) for r in rows]


def leader_hits(games):
    by_game = collections.defaultdict(list)
    for g in games:
        by_game[g["id"]].append(g)
    out = {}
    for stat in ("minion", "camps", "struct", "xp", "td"):
        pairs = [v for v in by_game.values() if len(v) == 2]
        out[stat] = sum(1 for a, b in pairs if (a[stat] > b[stat]) == bool(a["won"])), len(pairs)
    return out


def hero_types():
    types = {}
    for path in glob.glob(str(ROOT / "knowledge" / "raw" / "ngs" / "matches" / "*.json")):
        for side in json.loads(pathlib.Path(path).read_text(encoding="utf-8"))["players"]:
            for p in side:
                types[p["hero"]["name"]] = p["hero"]["type"]
    types["Blaze"] = "Melee"  # offlaner, range too short to count as ranged
    return types


def hero_table(min_games=4):
    rows = DIV.execute("""SELECT p.hero, COUNT(*), AVG(p.minion_damage*60.0/g.length_sec), AVG(p.creep_damage*60.0/g.length_sec),
                          AVG(p.structure_damage*60.0/g.length_sec), AVG(p.xp_contribution*60.0/g.length_sec), AVG(p.won)
                          FROM ngs_player_game p JOIN ngs_game g USING(replay_id) GROUP BY p.hero HAVING COUNT(*) >= ? ORDER BY 3 DESC""", (min_games,)).fetchall()
    types, mine = hero_types(), collections.defaultdict(list)
    for tag, heroes in OUR_POOL.items():
        for h in heroes:
            mine[h].append(tag)
    lines = ["| Hero | Type | Games | Minion damage per min | Camp damage per min | Structure damage per min | Win rate | Ours |", "|---|---|---|---|---|---|---|---|"]
    for hero, n, mn, cr, st, xp, win in rows:
        lines.append(f"| {hero} | {types.get(hero, '')} | {n} | {mn:,.0f} | {cr:,.0f} | {st:,.0f} | {100*win:.0f}% | {', '.join(mine.get(hero, []))} |")
    return "\n".join(lines)


def high_clear_effect(games):
    rows = DIV.execute("""SELECT p.hero, AVG(p.minion_damage*60.0/g.length_sec), COUNT(*) FROM ngs_player_game p JOIN ngs_game g USING(replay_id) GROUP BY p.hero""").fetchall()
    high = {h for h, mn, n in rows if mn >= HIGH_CLEAR and n >= 3}

    def table(select):
        c = collections.defaultdict(lambda: [0, 0])
        for g in games:
            if select(g):
                k = min(sum(h in high for h in g["heroes"].split(",")), 3)
                c[k][0] += 1
                c[k][1] += g["won"]
        return {k: tuple(v) for k, v in sorted(c.items())}
    return high, table(lambda g: True), table(lambda g: g["map"] == "Tomb of the Spider Queen")


def player_table(team):
    rows = DIV.execute("""SELECT p.battletag, COUNT(*), AVG(p.rating), AVG(p.minion_damage*60.0/g.length_sec), AVG(p.creep_damage*60.0/g.length_sec),
                          AVG(p.structure_damage*60.0/g.length_sec), AVG(p.xp_contribution*60.0/g.length_sec), AVG(p.deaths)
                          FROM ngs_player_game p JOIN ngs_game g USING(replay_id) WHERE p.team=? GROUP BY p.battletag HAVING COUNT(*) >= 8 ORDER BY 4 DESC""", (team,)).fetchall()
    lines = ["| Player | Games | Rating | Minion per min | Camps per min | Structure per min | XP per min | Deaths |", "|---|---|---|---|---|---|---|---|"]
    for b, n, r, mn, cr, st, xp, d in rows:
        lines.append(f"| {b} | {n} | {r:.0f} | {mn:,.0f} | {cr:,.0f} | {st:,.0f} | {xp:,.0f} | {d:.1f} |")
    return "\n".join(lines)


def team_map_record(team, map_name):
    r = DIV.execute("""SELECT COUNT(*), SUM(CASE WHEN winner=? THEN 1 ELSE 0 END) FROM ngs_game WHERE map=? AND (team0=? OR team1=?)""", (team, map_name, team, team)).fetchone()
    return f"{r[1] or 0}-{r[0] - (r[1] or 0)}"


def map_table():
    maps = [r[0] for r in DIV.execute("SELECT DISTINCT map FROM ngs_game ORDER BY map")]
    lines = ["| Map | Icy Veins prefers | Icy Veins avoids | PRA | CCS | COSMOS |", "|---|---|---|---|---|---|"]
    for m in maps:
        slug = m.lower().replace("'", "").replace(" ", "-")
        text = KB.execute("SELECT text FROM map_section WHERE map=? AND title='Draft Strategy'", (slug,)).fetchone()
        prefer, avoid = ("", "")
        if text:
            body = " ".join(text[0].split()).split(" See our")[0]
            prefer, _, avoid = body.replace("Prefer ", "", 1).partition(" Avoid ")
        lines.append(f"| {m} | {prefer.strip()} | {avoid.strip()} | {team_map_record(PRA, m)} | {team_map_record(CCS, m)} | {team_map_record(COS, m)} |")
    return "\n".join(lines)


def main():
    games = team_games()
    print("LEADER HITS (team with more of the stat won, of 56 games):", leader_hits(games))
    high, overall, tomb = high_clear_effect(games)
    print("HIGH CLEAR HEROES:", sorted(high))
    print("by count, all:", overall, "| Tomb:", tomb)
    print("\n" + hero_table() + "\n\n## PRA\n" + player_table(PRA) + "\n\n## CCS\n" + player_table(CCS) + "\n\n" + map_table())


if __name__ == "__main__":
    main()
