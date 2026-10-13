"""Build knowledge/heroeslounge.db from the raw Heroes Lounge match pages in knowledge/raw/heroeslounge/.
Each raw file is one match: a token stream per game, saved by the in page collector (see UPDATE_EXPERT.md).
Side: 'L' is the team listed first on the match page, 'R' the second. First pick is NOT stored as a side,
the page shows one 'First Pick' badge and which team it belongs to is unconfirmed."""
import json, pathlib, re, sqlite3, sys

ROOT = pathlib.Path(__file__).parent / "knowledge"
RAW = ROOT / "raw" / "heroeslounge"
DB = ROOT / "heroeslounge.db"

SCHEMA = """
DROP TABLE IF EXISTS hl_games; DROP TABLE IF EXISTS hl_picks; DROP TABLE IF EXISTS hl_bans; DROP TABLE IF EXISTS hl_players;
CREATE TABLE hl_games(game_id TEXT PRIMARY KEY, match_id INTEGER, game_no INTEGER, season INTEGER, division INTEGER,
  round TEXT, played TEXT, team_l TEXT, team_r TEXT, map TEXT, duration_sec INTEGER, kills_l INTEGER, kills_r INTEGER,
  level_l INTEGER, level_r INTEGER, winner TEXT, has_first_pick_badge INTEGER);
CREATE TABLE hl_picks(game_id TEXT, side TEXT, pick_no INTEGER, hero TEXT, player TEXT);
CREATE TABLE hl_bans(game_id TEXT, side TEXT, ban_no INTEGER, hero TEXT);
CREATE TABLE hl_players(game_id TEXT, side TEXT, hero TEXT, player TEXT, kills INTEGER, assists INTEGER, deaths INTEGER,
  siege INTEGER, hero_dmg INTEGER, healing INTEGER, dmg_taken INTEGER, exp INTEGER);
"""

def num(s):
    return int(s.replace(",", ""))

def hero(t):
    return t[1:-1] if t.startswith("<") and t.endswith(">") else None

def parse_game(t):
    """Return dict or None when the game was not played or the page is incomplete."""
    if "<MAP>" not in t or "Toggle Statistics" not in t:
        return None
    first_bans = t.index("Bans")
    picks_raw = []
    i = 0
    while i < first_bans:
        h = hero(t[i])
        if h and i + 1 < first_bans:
            picks_raw.append((h, t[i + 1]))
            i += 2
        else:
            i += 1
    mi = t.index("<MAP>")
    bans_l = [hero(x) for x in t[first_bans:mi] if hero(x)]
    map_name = t[mi + 1]
    ti = t.index("Toggle Statistics")
    bans_r = [hero(x) for x in t[mi + 2:ti] if hero(x)]
    # summary: team, kills, Duration, kills, team, levels and Winner
    s = t[ti + 1:]
    try:
        di = next(k for k, x in enumerate(s) if x.startswith("Duration:"))
    except StopIteration:
        return None
    mm, ss = s[di].split(":")[1:]
    dur = int(mm) * 60 + int(ss)
    kills_l = num(s[di - 1]) if s[di - 1].replace(",", "").isdigit() else None
    kills_r = num(s[di + 1]) if s[di + 1].replace(",", "").isdigit() else None
    team_l, team_r = s[di - 2], s[di + 2]
    hi = s.index("Hero")
    lv = [k for k in range(di, hi) if s[k].startswith("Level ") or s[k] == "Winner"]
    seq = [s[k] for k in lv]
    levels = [int(x.split()[1]) for x in seq if x.startswith("Level ")]
    winner = None
    if "Winner" in seq and len(levels) == 2:
        winner = "L" if seq.index("Winner") == 1 else "R" if seq.index("Winner") == 2 else None
    # stats rows: <Hero> HeroName Player K A D siege hdmg heal taken exp group
    rows = []
    k = s.index("TGroup") + 1
    while k < len(s):
        h = hero(s[k])
        if not h:
            break
        try:
            vals = [num(x) for x in s[k + 3:k + 11]]
            grp = int(s[k + 11])
        except (ValueError, IndexError):
            break
        rows.append(dict(hero=h, player=s[k + 2], kills=vals[0], assists=vals[1], deaths=vals[2], siege=vals[3],
                         hero_dmg=vals[4], healing=vals[5], dmg_taken=vals[6], exp=vals[7], side="L" if grp == 1 else "R"))
        k += 12
    side_of = {r["hero"]: r["side"] for r in rows}
    picks = []
    n = {"L": 0, "R": 0}
    for h, p in picks_raw:
        sd = side_of.get(h)
        if sd:
            n[sd] += 1
            picks.append((sd, n[sd], h, p))
    return dict(map=map_name, dur=dur, kl=kills_l, kr=kills_r, tl=team_l, tr=team_r, levels=levels, winner=winner,
                rows=rows, picks=picks, bans_l=bans_l, bans_r=bans_r, badge=int("First Pick" in t[:3]))

def main():
    con = sqlite3.connect(DB)
    con.executescript(SCHEMA)
    files = sorted(RAW.glob("s*/d*/*.json"))
    ng = bad = 0
    for f in files:
        m = json.loads(f.read_text(encoding="utf-8"))
        rnd = m["head"][0] if m["head"] else ""
        played = next((h.replace("Scheduled for ", "") for h in m["head"] if h.startswith("Scheduled for")), "")
        for gi, g in enumerate(m["games"], 1):
            p = parse_game(g["t"])
            if not p or len(p["rows"]) != 10 or len(p["picks"]) != 10 or p["winner"] is None:
                bad += 1
                continue
            gid = g["id"].replace("game", "")
            lv = p["levels"]
            con.execute("INSERT INTO hl_games VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                        (gid, int(m["id"]), gi, m["season"], m["division"], rnd, played, p["tl"], p["tr"], p["map"], p["dur"],
                         p["kl"], p["kr"], lv[0], lv[1], p["winner"], p["badge"]))
            con.executemany("INSERT INTO hl_picks VALUES(?,?,?,?,?)", [(gid, *x) for x in p["picks"]])
            con.executemany("INSERT INTO hl_bans VALUES(?,?,?,?)",
                            [(gid, "L", i + 1, h) for i, h in enumerate(p["bans_l"])] +
                            [(gid, "R", i + 1, h) for i, h in enumerate(p["bans_r"])])
            con.executemany("INSERT INTO hl_players VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                            [(gid, r["side"], r["hero"], r["player"], r["kills"], r["assists"], r["deaths"], r["siege"],
                              r["hero_dmg"], r["healing"], r["dmg_taken"], r["exp"]) for r in p["rows"]])
            ng += 1
    con.commit()
    print(f"matches files {len(files)}, games saved {ng}, games skipped {bad}")

if __name__ == "__main__":
    main()
