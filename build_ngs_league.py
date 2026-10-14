"""Build knowledge/ngs_league.db from the NGS replay parser exports (Medea stores, one folder per season).
Usage: python -I build_ngs_league.py <season>=<export folder> [...]
   e.g. python -I build_ngs_league.py 21=C:/Users/visio/Downloads/NGS-season-21 22=C:/Users/visio/Downloads/NGS-season-22
Covers every NGS division the export holds. Incremental: only the seasons named on the command line are replaced, other seasons stay. Chat messages, position traces and cosmetics are NOT copied. A timeline summary per game (first takedown, experience leads, first structure, level advantage) goes in lg_timeline.
Bans in the export are cut to 4 letters, they are matched back to full hero names (ambiguous ones are left blank and counted)."""
import json, pathlib, sqlite3, sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from medea_reader import read_store
DB = HERE / "knowledge" / "ngs_league.db"
HEROES = list(json.load(open(HERE / "knowledge" / "expert" / "hero_matrix_draft.json", encoding="utf-8"))["heroes"])

SCHEMA = """
CREATE TABLE IF NOT EXISTS lg_games(game_id TEXT PRIMARY KEY, league TEXT, season INTEGER, division TEXT, date TEXT, map TEXT,
  length_sec REAL, team0 TEXT, team1 TEXT, winner INTEGER, first_pick INTEGER, level0 INTEGER, level1 INTEGER,
  takedowns0 INTEGER, takedowns1 INTEGER, first_objective INTEGER, first_fort INTEGER, first_keep INTEGER,
  objectives0 INTEGER, objectives1 INTEGER, merc_caps0 INTEGER, merc_caps1 INTEGER,
  time_to10_0 REAL, time_to10_1 REAL, time_to20_0 REAL, time_to20_1 REAL, game_version TEXT);
CREATE TABLE IF NOT EXISTS lg_picks(game_id TEXT, team INTEGER, pick_no INTEGER, hero TEXT);
CREATE TABLE IF NOT EXISTS lg_bans(game_id TEXT, team INTEGER, ban_no INTEGER, hero TEXT, hero_raw TEXT);
CREATE TABLE IF NOT EXISTS lg_players(game_id TEXT, team INTEGER, hero TEXT, toon TEXT, name TEXT, takedowns INTEGER, deaths INTEGER,
  assists INTEGER, siege INTEGER, hero_dmg INTEGER, healing INTEGER, dmg_taken INTEGER, xp_contrib INTEGER,
  merc_caps INTEGER, time_dead REAL, cc_time REAL, talents TEXT);
CREATE TABLE IF NOT EXISTS lg_timeline(game_id TEXT PRIMARY KEY, first_td_team INTEGER, first_td_time REAL, xp_lead_5 REAL, xp_lead_10 REAL, xp_lead_15 REAL,
  first_struct_team INTEGER, first_struct_time REAL, first_camp_team INTEGER, first_camp_time REAL,
  level_adv_pct0 REAL, level_adv_pct1 REAL, max_level_adv0 INTEGER, max_level_adv1 INTEGER, wipes0 INTEGER, wipes1 INTEGER,
  aces0 INTEGER, aces1 INTEGER, avg_alive0 REAL, avg_alive1 REAL, pct_hero_adv0 REAL, pct_hero_adv1 REAL, merc_uptime0 REAL, merc_uptime1 REAL);
CREATE INDEX IF NOT EXISTS i_picks ON lg_picks(game_id); CREATE INDEX IF NOT EXISTS i_bans ON lg_bans(game_id); CREATE INDEX IF NOT EXISTS i_pl ON lg_players(game_id);
"""

# The export cuts bans to 4 letters and some are the game's internal code, not the hero name.
ALIASES = {"crus": "Johanna", "demo": "Valla", "faer": "Brightwing", "nxhu": "Qhira", "fire": "Blaze", "luci": "Lucio",
           "tyrl": "Tyrael", "wiza": "Li-Ming", "barb": "Sonya", "l90e": "E.T.C.", "lost": "The Lost Vikings",
           "genn": "Greymane", "mdvh": "Medivh", "tra0": "Tracer", "ccho": "Cho", "tyrd": "Tyrande", "hmei": "Mei",
           "hana": "Ana", "necr": "Xul", "butc": "The Butcher", "drya": "Lunara", "amaz": "Cassia", "arts": "Artanis", "fenx": "Fenix", "dva0": "D.Va",
           "monk": "Kharazim", "witc": "Nazeebo", "tink": "Gazlowe", "hxal": "Xal'atath"}

def _norm(x):
    return "".join(ch for ch in x.lower() if ch.isalnum())

def resolve_ban(raw):
    raw = (raw or "").strip()
    if not raw:
        return None
    a = ALIASES.get(raw.lower())
    if a:
        return next((h for h in HEROES if _norm(h) == _norm(a)), a)
    c = [h for h in HEROES if h.lower().startswith(raw.lower())]
    if len(c) == 1:
        return c[0]
    sq = [h for h in HEROES if h.lower().replace("'", "").replace(".", "").replace(" ", "").startswith(raw.lower().replace("'", "").replace(".", "").replace(" ", ""))]
    return sq[0] if len(sq) == 1 else None

def division_of(names):
    # Prefer the most specific tag (B East, C West...). Fall back to B or C when only the group is present.
    spec = [n for n in names if " " in n and n not in ("Non-Storm",)]
    if spec:
        return spec[0]
    for n in ("Nexus", "Heroic", "A", "D", "B", "C"):
        if n in names:
            return n
    return None

def timeline_row(gid, r, toon_team):
    """Early game and tempo features from the replay parser's timeline: first takedown, experience lead at 5, 10 and 15 minutes,
    first structure destroyed, first camp, level advantage and wipes. Team fields are 0 or 1 (None when the replay lacks it)."""
    tds = [t for t in r.get("takedowns", []) if t.get("time") is not None]
    first = min(tds, key=lambda t: t["time"]) if tds else None
    f_team = f_time = None
    if first:
        vteam = toon_team.get((first.get("victim") or {}).get("player"))
        f_time = first["time"]
        if vteam is not None:
            f_team = 1 - int(vteam)
    # experience totals by team at each minute mark (the breakdown is cumulative)
    xp = {}
    for e in r.get("XPBreakdown", []):
        b = e.get("breakdown") or {}
        tot = sum((b.get(k) or 0) for k in ("MinionXP", "CreepXP", "StructureXP", "HeroXP", "TrickleXP"))
        xp[(e.get("time"), e.get("team"))] = tot
    def lead(t):
        a, c = xp.get((t, 0)), xp.get((t, 1))
        return None if a is None or c is None else a - c
    # first structure destroyed: the owner is the team that lost it
    sd = [x for x in (r.get("structures") or {}).values() if x.get("destroyed") is not None]
    fs = min(sd, key=lambda x: x["destroyed"]) if sd else None
    caps = [c for c in (r.get("mercs") or {}).get("captures", []) if c.get("time") is not None]
    fc = min(caps, key=lambda c: c["time"]) if caps else None
    st0 = (r.get("teams", {}).get("0") or {}).get("stats", {})
    st1 = (r.get("teams", {}).get("1") or {}).get("stats", {})
    g = lambda d, k: d.get(k)
    return (gid, f_team, f_time, lead(300), lead(600), lead(900),
            None if fs is None else 1 - int(fs.get("team", 0)), None if fs is None else fs["destroyed"],
            None if fc is None else fc.get("team"), None if fc is None else fc["time"],
            g(st0, "levelAdvPct"), g(st1, "levelAdvPct"), g(st0, "maxLevelAdv"), g(st1, "maxLevelAdv"), g(st0, "wipes"), g(st1, "wipes"),
            g(st0, "aces"), g(st1, "aces"), g(st0, "avgHeroesAlive"), g(st1, "avgHeroesAlive"),
            g(st0, "pctWithHeroAdv"), g(st1, "pctWithHeroAdv"), g(st0, "mercUptimePercent"), g(st1, "mercUptimePercent"))


def main(args):
    con = sqlite3.connect(DB)
    con.executescript(SCHEMA)
    miss = tot = 0
    for a in args:
        season, folder = a.split("=", 1)
        season = int(season)
        folder = pathlib.Path(folder)
        # incremental: only the seasons passed in are replaced, the rest of the database is kept
        pre = f"ngs_s{season}_"
        for tbl in ("lg_games", "lg_picks", "lg_bans", "lg_players", "lg_timeline"):
            con.execute(f"DELETE FROM {tbl} WHERE substr(game_id, 1, ?) = ?", (len(pre), pre))
        st, _ = read_store(folder / "settings.ldb")
        cols = {k: v["name"] for k, v in st.items() if v["type"] == "collection"}
        matches, _ = read_store(folder / "matches.ldb")
        heroes, _ = read_store(folder / "hero.ldb")
        by_match = {}
        for hr in heroes.values():
            by_match.setdefault(hr.get("matchID"), []).append(hr)
        for mid, r in matches.items():
            if not r.get("picks") or len(r["picks"].get("0", [])) != 5 or len(r["picks"].get("1", [])) != 5:
                continue  # not a drafted 5v5 game
            gid = f"ngs_s{season}_{mid}"
            t0, t1 = r["teams"]["0"], r["teams"]["1"]
            div = division_of([cols[c] for c in r.get("collection", []) if c in cols])
            ob = r.get("objective", {})
            def obj(t):
                return (ob.get(t) or {}).get("count", 0)
            ts0, ts1 = t0.get("stats", {}), t1.get("stats", {})
            con.execute("INSERT INTO lg_games VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        (gid, "NGS", season, div, r["date"][:10], r["map"], r["length"], t0.get("teamName"), t1.get("teamName"),
                         r["winner"], r["picks"].get("first"), t0.get("level"), t1.get("level"), t0.get("takedowns"), t1.get("takedowns"),
                         r.get("firstObjective"), r.get("firstFort"), r.get("firstKeep"), obj("0"), obj("1"),
                         ts0.get("mercCaptures"), ts1.get("mercCaptures"), ts0.get("timeTo10"), ts1.get("timeTo10"),
                         ts0.get("timeTo20"), ts1.get("timeTo20"), f'{r["version"]["m_major"]}.{r["version"]["m_minor"]}'))
            for team in ("0", "1"):
                for i, h in enumerate(r["picks"][team], 1):
                    con.execute("INSERT INTO lg_picks VALUES(?,?,?,?)", (gid, int(team), i, h))
                for b in r.get("bans", {}).get(team, []):
                    full = resolve_ban(b.get("hero"))
                    tot += 1
                    if b.get("hero") and not full:
                        miss += 1
                    if b.get("hero"):
                        con.execute("INSERT INTO lg_bans VALUES(?,?,?,?,?)", (gid, int(team), b.get("absolute"), full, b["hero"]))
            toon_team = {hr.get("ToonHandle"): hr.get("team") for hr in by_match.get(mid, [])}
            con.execute("INSERT INTO lg_timeline VALUES(" + ",".join("?" * 24) + ")", timeline_row(gid, r, toon_team))
            for hr in by_match.get(mid, []):
                if not hr.get("hero"):
                    continue   # a few replays carry a player row the parser could not name
                g = hr.get("gameStats", {})
                con.execute("INSERT INTO lg_players VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                            (gid, int(hr["team"]), hr["hero"], hr["ToonHandle"], hr["name"], g.get("Takedowns"), g.get("Deaths"),
                             g.get("Assists"), g.get("SiegeDamage"), g.get("HeroDamage"), g.get("Healing"), g.get("DamageTaken"),
                             g.get("ExperienceContribution"), g.get("MercCampCaptures"), g.get("TimeSpentDead"),
                             (g.get("TimeStunningEnemyHeroes") or 0) + (g.get("TimeRootingEnemyHeroes") or 0) + (g.get("TimeSilencingEnemyHeroes") or 0),
                             json.dumps(hr.get("talents"))))
    con.commit()
    print("games", con.execute("select count(*) from lg_games").fetchone()[0], "bans with names left blank", miss, "of", tot)
    for row in con.execute("select season,division,count(*) from lg_games group by 1,2 order by 1,2"):
        print(row)

if __name__ == "__main__":
    main(sys.argv[1:])
