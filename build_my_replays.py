"""Build knowledge/my_replays.db from one player's own replays, read through a Stats of the Storm database
(the same Medea store the NGS replay export uses). One row per game the player played, every death with its time,
map position, killers and what the rest of the fight looked like, and the talents taken.
Usage: python -I build_my_replays.py <store folder> [<store folder> ...] [--toon 1-Hero-1-8186800] [--out knowledge/my_replays.db] [--export file.json]
--export writes the file the Deaths and talents page in HotS Tools (My Games) imports; on its own it exports the database already built.
A store folder holds matches.ldb and hero.ldb. Without --toon the player is the one found in the most games (the replay owner).
NGS export season folders work too (that is how the reader is tested before any personal replays exist).
The same game in two folders is kept once (first folder wins): same map, same ten players, same day.
Where Heroes Profile has the same game (knowledge/hunter_hp.db: same map and hero, start within 40 minutes) its mode and
replay id are kept, which also checks the replay's own mode code. Chat, cosmetics and position traces are not copied."""
import collections, json, pathlib, re, sqlite3, sys
from datetime import datetime, timezone

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from medea_reader import read_store
OUT = HERE / "knowledge" / "my_replays.db"
HP = HERE / "knowledge" / "hunter_hp.db"
KB = HERE / "knowledge" / "hots_knowledge.db"
# hots-parser GameMode codes (constants.js); anything else is kept as its number
MODES = {50001: "Quick Match", 50021: "AI", 50031: "Brawl", 50041: "Practice", 50051: "Unranked Draft",
         50061: "Hero League", 50071: "Team League", 50091: "Storm League", -1: "Custom"}
HP_MODES = {"sl": "Storm League", "qm": "Quick Match", "ud": "Unranked Draft", "ar": "ARAM", "hl": "Hero League", "tl": "Team League"}
NEAR = 15      # seconds either side of a death that count as the same fight
SCALE = 4096   # death and takedown positions are fixed point, structures are in map units
TIERS = (1, 4, 7, 10, 13, 16, 20)

SCHEMA = """
DROP TABLE IF EXISTS my_games; DROP TABLE IF EXISTS my_deaths; DROP TABLE IF EXISTS my_talents; DROP TABLE IF EXISTS my_meta;
CREATE TABLE my_games(game_id TEXT PRIMARY KEY, source TEXT, date TEXT, build INTEGER, mode TEXT, hp_mode TEXT, hp_replay_id INTEGER,
  map TEXT, length_sec REAL, hero TEXT, team INTEGER, win INTEGER, first_pick INTEGER, level INTEGER, enemy_level INTEGER,
  takedowns INTEGER, deaths INTEGER, assists INTEGER, solo_kills INTEGER, hero_dmg INTEGER, siege_dmg INTEGER, minion_dmg INTEGER,
  structure_dmg INTEGER, healing INTEGER, dmg_taken INTEGER, xp_contrib INTEGER, merc_caps INTEGER, time_dead REAL, cc_time REAL,
  globes INTEGER, xp_lead_5 REAL, xp_lead_10 REAL, xp_lead_15 REAL, first_td_us INTEGER,
  allies TEXT, ally_heroes TEXT, enemies TEXT, enemy_heroes TEXT);
CREATE TABLE my_deaths(game_id TEXT, n INTEGER, t REAL, x REAL, y REAL, killers TEXT, n_killers INTEGER, depth REAL,
  our_near INTEGER, their_near INTEGER, ours_before INTEGER, level_diff INTEGER, time_dead REAL);
CREATE TABLE my_talents(game_id TEXT, hero TEXT, level INTEGER, internal TEXT, talent TEXT, win INTEGER);
CREATE TABLE my_meta(key TEXT PRIMARY KEY, value TEXT);
CREATE INDEX i_md ON my_deaths(game_id); CREATE INDEX i_mt ON my_talents(game_id);
"""


def norm(x):
    return "".join(ch for ch in (x or "").lower() if ch.isalnum())


def when(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00")).replace(tzinfo=None)


def hp_index():
    idx = collections.defaultdict(list)
    if HP.exists():
        con = sqlite3.connect(HP)
        for rid, gt, d, mp, hero, *lv in con.execute(
                "select replay_id, game_type, date, map, hero, l1, l4, l7, l10, l13, l16, l20 from hp_game"):
            idx[(norm(mp), norm(hero))].append((datetime.fromisoformat(d), rid, gt, lv))
        con.close()
    return idx


def talent_book():
    """Icy Veins talent names per hero slug and level, to turn the replay's internal names into the names shown in game."""
    book = collections.defaultdict(list)
    slug_of = {}
    if KB.exists():
        con = sqlite3.connect(KB)
        slug_of = {norm(n): s for s, n in con.execute("select slug, name from hero")}
        for s, lv, name in con.execute("select slug, level, name from talent"):
            book[(s, lv)].append(name)
        con.close()
    return book, slug_of


def pretty(internal, hero_internal):
    base = internal.removeprefix("GenericTalent")
    stem = (hero_internal or "").removeprefix("Hero")
    if stem and base.startswith(stem):
        base = base[len(stem):]
    out = re.sub(r"(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])", " ", base).strip()
    if internal.startswith("GenericTalent"):   # FlashoftheStorms: the shared names run small words together
        out = re.sub(r"(?<=[a-z])of(the)? ", lambda m: " of the " if m.group(1) else " of ", out)
    return out or internal


def tier_levels(book, slug_of, hero):
    """Talent levels by tier: 1, 4, 7, 10, 13, 16, 20 for most heroes, the hero's own (Chromie 1, 2, 5...) when Icy Veins lists seven."""
    s = slug_of.get(norm(hero))
    lv = sorted({l for (k, l) in book if k == s})
    return tuple(lv) if len(lv) == 7 else TIERS


def name_talent(book, slug_of, learned, hero, level, internal, hero_internal):
    if (hero, level, internal) in learned:
        return learned[(hero, level, internal)]
    low = norm(internal)
    s = slug_of.get(norm(hero))
    pools = [book.get((s, level), []), [c for (k, _), cs in book.items() if k == s for c in cs]]
    if internal.startswith("GenericTalent"):   # talents many heroes share, named the same everywhere
        pools.append([c for (_, l), cs in book.items() if l == level for c in cs])
    for cands in pools:
        hits = [c for c in cands if norm(c) and norm(c) in low]
        if hits:
            return max(hits, key=lambda c: len(norm(c)))
    return pretty(internal, hero_internal)


def level_at(lt, team, t):
    lv = 1
    for e in (lt.get(str(team)) or {}).values():
        if e.get("time") is not None and e["time"] <= t:
            lv = max(lv, e.get("level") or 1)
    return lv


def depth_fn(m, team):
    """0 at the centre of our structures, 1 at the centre of theirs: above 0.5 is their half of the map."""
    own = [(s["x"], s["y"]) for s in (m.get("structures") or {}).values() if s.get("x") is not None and s.get("team") == team]
    opp = [(s["x"], s["y"]) for s in (m.get("structures") or {}).values() if s.get("x") is not None and s.get("team") == 1 - team]
    if not own or not opp:
        return lambda x, y: None
    ox, oy = sum(p[0] for p in own) / len(own), sum(p[1] for p in own) / len(own)
    ex, ey = sum(p[0] for p in opp) / len(opp), sum(p[1] for p in opp) / len(opp)
    dx, dy = ex - ox, ey - oy
    ll = dx * dx + dy * dy
    return lambda x, y: None if ll == 0 else round(((x - ox) * dx + (y - oy) * dy) / ll, 3)


def pick_toon(heroes):
    c = collections.Counter(h.get("ToonHandle") for h in heroes.values() if h.get("ToonHandle"))
    games = len({h.get("matchID") for h in heroes.values()})
    toon, n = c.most_common(1)[0]
    if n < 0.5 * games:
        print(f"warning: the most common player {toon} is in only {n} of {games} games; pass --toon if this is not a personal database")
    return toon


APP_MODES = {"Storm League": "sl", "Quick Match": "qm", "Unranked Draft": "ud", "ARAM": "ar", "Hero League": "hl",
             "Team League": "tl", "Brawl": "br", "Custom": "cu"}


def payload(db=OUT, example=False):
    """The games for the Deaths and talents page in HotS Tools (My Games). example drops the game ids and the player name.
    Each death is [time, depth, teammates down near it, enemies down near it, teammates down before it, heroes on the kill,
    those heroes, level gap, seconds dead]. ref is every NGS player on the same hero (seasons 20 to 22): games, deaths, alone deaths."""
    import analyze_my_replays
    con = sqlite3.connect(db)
    con.row_factory = sqlite3.Row
    meta = dict(con.execute("select key, value from my_meta").fetchall())
    deaths = collections.defaultdict(list)
    for d in con.execute("select * from my_deaths order by game_id, n"):
        deaths[d["game_id"]].append([round(d["t"], 1), d["depth"], d["our_near"], d["their_near"], d["ours_before"], d["n_killers"],
                                     d["killers"] or "", d["level_diff"], d["time_dead"]])
    tals = collections.defaultdict(list)
    for t in con.execute("select game_id, level, talent from my_talents order by game_id, level"):
        tals[t["game_id"]].append([t["level"], t["talent"]])
    games = []
    for i, g in enumerate(con.execute("select * from my_games order by date"), 1):
        mode = g["hp_mode"] or g["mode"]
        games.append({"id": f"ex{i}" if example else g["game_id"], "t": int(when(g["date"]).replace(tzinfo=timezone.utc).timestamp() * 1000),
                      "mode": APP_MODES.get(mode, "ot"), "map": g["map"], "hero": g["hero"], "won": g["win"], "len": round(g["length_sec"] or 0),
                      "lvl": g["level"], "elvl": g["enemy_level"], "fp": g["first_pick"],
                      "xp10": None if g["xp_lead_10"] is None else round(g["xp_lead_10"]),
                      "td": g["takedowns"], "d": g["deaths"], "a": g["assists"], "solo": g["solo_kills"], "hd": g["hero_dmg"], "sd": g["siege_dmg"],
                      "dead": g["time_dead"], "al": json.loads(g["ally_heroes"]), "en": json.loads(g["enemy_heroes"]),
                      "tal": tals[g["game_id"]], "dl": deaths[g["game_id"]]})
    con.close()
    ref = {h: list(v) for h, v in analyze_my_replays.league_alone({g["hero"] for g in games}).items()}
    return {"format": "hots-tools-replays", "version": 1, "player": "Example player" if example else meta.get("name", ""),
            "built": meta.get("built"), "near": NEAR, "ref": ref, "refLabel": "every NGS player on that hero, seasons 20 to 22", "games": games}


def main(argv):
    toon = None
    out = OUT
    export = None
    folders = []
    i = 0
    while i < len(argv):
        if argv[i] == "--toon":
            toon = argv[i + 1]; i += 2
        elif argv[i] == "--out":
            out = pathlib.Path(argv[i + 1]); i += 2
        elif argv[i] == "--export":
            export = pathlib.Path(argv[i + 1]); i += 2
        else:
            folders.append(pathlib.Path(argv[i])); i += 1
    if not folders and export:   # export only, from the database already built
        export.write_text(json.dumps(payload(out), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print("wrote", export)
        return
    if not folders:
        sys.exit(__doc__)
    hp = hp_index()
    book, slug_of = talent_book()
    used_hp = set()
    seen = set()
    games, deaths, talents = [], [], []
    learned = {}
    pending_talents = []
    players = set()
    names = collections.Counter()
    for folder in folders:
        matches, _ = read_store(folder / "matches.ldb")
        heroes, _ = read_store(folder / "hero.ldb")
        me = toon or pick_toon(heroes)
        players.add(me)
        by_match = collections.defaultdict(list)
        for hr in heroes.values():
            by_match[hr.get("matchID")].append(hr)
        before = len(games)
        for hr in heroes.values():
            if hr.get("ToonHandle") != me or not hr.get("hero"):
                continue
            mid = hr.get("matchID")
            m = matches.get(mid)
            if not m:
                continue
            key = (m.get("map"), tuple(sorted(m.get("playerIDs") or [])), (m.get("date") or "")[:10])
            if key in seen:
                continue
            seen.add(key)
            names[hr.get("name")] += 1
            gid = f"{folder.name}_{mid}"
            team = int(hr["team"])
            g = hr.get("gameStats") or {}
            toon_team = {h.get("ToonHandle"): int(h["team"]) for h in by_match[mid] if h.get("team") is not None}
            mode = MODES.get(m.get("mode"), str(m.get("mode")))
            # Heroes Profile game for the same map and hero closest in time (within 40 minutes), used once
            hp_mode = hp_id = None
            hp_lv = None
            start = when(m["date"])
            best = None
            for d, rid, gt, lv in hp.get((norm(m.get("map")), norm(hr["hero"])), []):
                gap = abs((d - start).total_seconds())
                if gap <= 2400 and rid not in used_hp and (best is None or gap < best[0]):
                    best = (gap, rid, gt, lv)
            if best:
                used_hp.add(best[1])
                hp_id, hp_mode, hp_lv = best[1], HP_MODES.get(best[2], best[2]), best[3]
            # experience lead from our side at 5, 10 and 15 minutes (the breakdown is cumulative)
            xp = {}
            for e in m.get("XPBreakdown", []):
                b = e.get("breakdown") or {}
                xp[(e.get("time"), e.get("team"))] = sum((b.get(k) or 0) for k in ("MinionXP", "CreepXP", "StructureXP", "HeroXP", "TrickleXP"))
            def lead(t):
                a, c = xp.get((t, team)), xp.get((t, 1 - team))
                return None if a is None or c is None else a - c
            tds = []
            for td in m.get("takedowns", []):
                vp = (td.get("victim") or {}).get("player")
                if td.get("time") is not None:
                    tds.append((td["time"], toon_team.get(vp), vp))
            first = min(tds, key=lambda x: x[0], default=None)
            first_us = None if first is None or first[1] is None else int(first[1] != team)
            picks = m.get("picks") or {}
            fp = picks.get("first")
            mine = hr.get("with") or {}
            them = hr.get("against") or {}
            games.append((gid, folder.name, m["date"], (m.get("version") or {}).get("m_build"), mode, hp_mode, hp_id,
                          m.get("map"), m.get("length"), hr["hero"], team, int(bool(hr.get("win"))),
                          None if fp is None else int(fp == team), mine.get("level"), them.get("level"),
                          g.get("Takedowns"), g.get("Deaths"), g.get("Assists"), g.get("SoloKill"), g.get("HeroDamage"),
                          g.get("SiegeDamage"), g.get("MinionDamage"), g.get("StructureDamage"), g.get("Healing"),
                          g.get("DamageTaken"), g.get("ExperienceContribution"), g.get("MercCampCaptures"), g.get("TimeSpentDead"),
                          (g.get("TimeStunningEnemyHeroes") or 0) + (g.get("TimeRootingEnemyHeroes") or 0) + (g.get("TimeSilencingEnemyHeroes") or 0),
                          (hr.get("globes") or {}).get("count"), lead(300), lead(600), lead(900), first_us,
                          json.dumps([n for n, t in zip(mine.get("names", []), mine.get("ids", [])) if t != me]),
                          json.dumps([h for h, t in zip(mine.get("heroes", []), mine.get("ids", [])) if t != me]),
                          json.dumps(them.get("names", [])), json.dumps(them.get("heroes", []))))
            depth = depth_fn(m, team)
            lives = sorted(hr.get("lifespan") or [])
            lt = m.get("levelTimes") or {}
            for n, d in enumerate(sorted((d for d in hr.get("deaths", []) if d.get("time") is not None), key=lambda d: d["time"]), 1):
                t = d["time"]
                x = None if d.get("x") is None else d["x"] / SCALE
                y = None if d.get("y") is None else d["y"] / SCALE
                ours = [tt for tt, vt, vp in tds if vt == team and vp != me and abs(tt - t) <= NEAR]
                theirs = [tt for tt, vt, vp in tds if vt is not None and vt != team and abs(tt - t) <= NEAR]
                back = next((s for s, _ in lives if s > t), None)
                ks = [k.get("hero") for k in d.get("killers", []) if k.get("hero")]
                deaths.append((gid, n, t, x, y, "|".join(ks), len(ks), None if x is None else depth(x, y),
                               len(ours), len(theirs), sum(1 for tt in ours if tt < t),
                               level_at(lt, team, t) - level_at(lt, 1 - team, t),
                               None if back is None else round(back - t, 2)))
            tal = hr.get("talents") or {}
            for k, lv in enumerate(tier_levels(book, slug_of, hr["hero"]), 1):
                internal = tal.get(f"Tier{k}Choice")
                if not internal:
                    continue
                if hp_lv and hp_lv[k - 1]:
                    learned[(hr["hero"], lv, internal)] = hp_lv[k - 1]
                pending_talents.append((gid, hr["hero"], lv, internal, hr.get("internalHeroName"), int(bool(hr.get("win")))))
        print(f"{folder.name}: {len(games) - before} games for {me} out of {len(matches)} in the folder", flush=True)
    for gid, hero, lv, internal, hint, win in pending_talents:
        talents.append((gid, hero, lv, internal, name_talent(book, slug_of, learned, hero, lv, internal, hint), win))
    out.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(out)
    con.executescript(SCHEMA)
    con.executemany("INSERT INTO my_games VALUES(" + ",".join("?" * 38) + ")", games)
    con.executemany("INSERT INTO my_deaths VALUES(" + ",".join("?" * 13) + ")", deaths)
    con.executemany("INSERT INTO my_talents VALUES(?,?,?,?,?,?)", talents)
    con.executemany("INSERT INTO my_meta VALUES(?,?)", [("toon", json.dumps(sorted(players))), ("name", names.most_common(1)[0][0] if names else ""),
                                                       ("folders", json.dumps([str(f) for f in folders])),
                                                       ("built", datetime.now().isoformat(timespec="seconds"))])
    con.commit()
    print("games", len(games), "deaths", len(deaths), "talent picks", len(talents), "matched on Heroes Profile",
          sum(1 for g in games if g[6]), "->", out)
    for row in con.execute("select mode, coalesce(hp_mode, '-'), count(*), min(date), max(date) from my_games group by 1, 2 order by 3 desc"):
        print("  ", row)
    con.close()
    if export:
        export.write_text(json.dumps(payload(out), ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print("wrote", export)


if __name__ == "__main__":
    main(sys.argv[1:])
