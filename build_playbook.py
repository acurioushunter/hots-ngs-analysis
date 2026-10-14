"""Build the draft playbook: data.json, fact sheets and the single file draft tool.

Inputs : knowledge/ngs_div.db (every game of the division), knowledge/raw/ngs/matches/*.json (hero types),
         knowledge/hots_knowledge.db (Icy Veins heroes, counters, map advice, tier lists),
         knowledge/hunter_hp.db (Hunter's Storm League games, optional),
         playbook/config/our_team.json and rules.json (judgment calls), playbook/notes/**.md (curated notes)
Outputs: playbook/data.json, facts/teams/*.md, facts/maps/*.md, draft_tool.html
Run    : python build_playbook.py   (then python test_playbook.py and node test_engine.js)

New season or new division: rebuild the databases for it (see UPDATE_PLAYBOOK.md), edit playbook/config/our_team.json
(team name, season, roster, pools) and run this again. Nothing in here is specific to one opponent.
"""
import collections, datetime, glob, json, pathlib, re, sqlite3, unicodedata

import build_library

ROOT = pathlib.Path(__file__).parent
KN = ROOT / "knowledge"
PB = ROOT / "playbook"
OUT_FACTS = ROOT / "facts"
HIGH_CLEAR = 3500   # minion damage a minute that counts as a strong wave clearer
HIGH_DAMAGE = 2400  # hero damage a minute that counts as a real damage dealer


def norm(name):
    s = unicodedata.normalize("NFKD", name or "")
    return re.sub(r"[^a-z0-9]", "", s.lower())


def slug_text(name):
    return re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", name.lower())).strip("-")


def rd(path):
    return json.loads(pathlib.Path(path).read_text(encoding="utf-8"))


# ---------------------------------------------------------------- heroes and Icy Veins
def hero_types():
    types = {}
    for path in glob.glob(str(KN / "raw" / "ngs" / "matches" / "*.json")) + glob.glob(str(KN / "raw" / "ngs" / "other_divisions" / "*.json")):
        for side in rd(path)["players"]:
            for p in side:
                h = p["hero"]
                types[h["name"]] = dict(type=h["type"], role=h["new_role"])
    return types


def build_heroes(cfg):
    kdb = sqlite3.connect(KN / "hots_knowledge.db")
    seen = hero_types()
    seen_by_key = {norm(k): k for k in seen}
    iv_rows = kdb.execute("SELECT slug, name, role FROM hero").fetchall()
    canon = {}        # norm key -> display name
    heroes = {}
    for slug, name, role in iv_rows:
        display = seen_by_key.get(norm(slug), seen_by_key.get(norm(name), name))
        canon[norm(slug)] = display
        canon[norm(name)] = display
        heroes[display] = dict(name=display, iv_role=role, counters=[], synergies=[])
    for display, info in seen.items():
        heroes.setdefault(display, dict(name=display, iv_role=None, counters=[], synergies=[]))
        canon.setdefault(norm(display), display)
    not_ranged = set(cfg.get("not_ranged", []))
    ranged_extra = set(cfg.get("ranged_extra", []))
    marksmen = set(cfg.get("marksmen", []))
    arch = cfg.get("archetypes", {})
    ROLE_MAP = {"healer": "Healer", "tank": "Tank", "bruiser": "Bruiser", "support": "Support", "melee-assassin": "Melee Assassin", "ranged-assassin": "Ranged Assassin"}
    for h, d in heroes.items():
        s = seen.get(h)
        d["role"] = (s["role"] if s else ROLE_MAP.get(d["iv_role"], "Unknown"))
        if h in cfg.get("role_override", {}) and not h.startswith("_"):
            d["role"] = cfg["role_override"][h]
        hp_ranged = (s["type"] == "Ranged") if s else (d["iv_role"] == "ranged-assassin")
        d["hp_ranged"] = hp_ranged
        d["ranged"] = (hp_ranged or h in ranged_extra) and h not in not_ranged
        d["marksman"] = h in marksmen
        d["arch"] = archetype(d["role"], h, arch)
    for slug, kind, other in kdb.execute("SELECT slug, kind, other_slug FROM matchup"):
        a = canon.get(norm(slug)); b = canon.get(norm(other))
        if not a or not b:
            continue
        # IV semantics: the heroes listed under a hero's counter list are the ones that counter it
        (heroes[a]["counters"] if kind == "counter" else heroes[a]["synergies"]).append(b)
    return heroes, canon, kdb


# Recency weighting for league records. All NGS replays are one game patch (2.55), so the unit that moves is the season: players, drafts and
# the meta shift between seasons. A game from the newest season counts 1, one from HALF_LIFE seasons earlier counts half. RECENT_SEASONS is the
# raw "newest window" shown beside the weighted number so a gap between the two is visible.
HALF_LIFE = 3.0
RECENT_SEASONS = 3

def season_weight(season, newest):
    return 0.5 ** (max(0, newest - season) / HALF_LIFE)


def league_observed(heroes):
    """Measured facts from every NGS replay in knowledge/ngs_league.db (seasons 15 to 22): per hero crowd control seconds and how often its team
    drew first blood, plus hero against hero records. Returns (per hero dict, head to head {"A|B": [games, A side wins]} with A < B)."""
    path = KN / "ngs_league.db"
    if not path.exists():
        return {}, {}, {}, {}
    db = sqlite3.connect(path)
    first = dict(db.execute("SELECT game_id, first_td_team FROM lg_timeline"))
    win = dict(db.execute("SELECT game_id, winner FROM lg_games"))
    season = dict(db.execute("SELECT game_id, season FROM lg_games"))
    newest = max(season.values()) if season else 0
    obs = {}
    for gid, hero, team, cc in db.execute("SELECT game_id, hero, team, cc_time FROM lg_players"):
        h = canon_name(hero, heroes)
        if not h:
            continue
        o = obs.setdefault(h, dict(g=0, cc=0.0, fb=0, fbn=0, w=0))
        o["g"] += 1; o["cc"] += cc or 0; o["w"] += int(win.get(gid) == team)
        ft = first.get(gid)
        if ft is not None:
            o["fbn"] += 1; o["fb"] += int(ft == team)
    out = {h: dict(g=o["g"], w=o["w"], cc=round(o["cc"] / o["g"], 1), fb=round(o["fb"] / o["fbn"], 3) if o["fbn"] else None, fbn=o["fbn"]) for h, o in obs.items() if o["g"] >= 20}
    sides = {}
    for gid, team, hero in db.execute("SELECT game_id, team, hero FROM lg_picks"):
        sides.setdefault(gid, {0: [], 1: []})[int(team)].append(canon_name(hero, heroes))
    h2h = {}
    for gid, s in sides.items():
        w = win.get(gid)
        if w is None:
            continue
        for a in s[0]:
            for b in s[1]:
                if not a or not b or a == b:
                    continue
                key, a_won = (a + "|" + b, w == 0) if a < b else (b + "|" + a, w == 1)
                wt = season_weight(season.get(gid, newest), newest)
                r = h2h.setdefault(key, [0, 0, 0.0, 0.0]); r[0] += 1; r[1] += int(a_won); r[2] += wt; r[3] += wt * int(a_won)
    h2h = {k: [v[0], v[1], round(v[2], 1), round(v[3], 1)] for k, v in h2h.items() if v[0] >= 12}
    return out, h2h, league_combos(db, heroes, sides, win), league_comps(db, heroes, sides, win)


def league_comps(db, heroes, sides, win):
    """What the whole league's drafts did, so composition advice rests on thousands of games rather than one division.
    Every side of every NGS replay with five known heroes. Each cell is [games, wins]. Keys: ranged (0-1, 2, 3, 4+), rdiff (our ranged
    minus theirs, -2..2), healers (1, 2+), marks (0, 1, 2+), tanks (0, 1, 2+), shapes (role counts, 60+ games), all overall and per map."""
    maps = dict(db.execute("SELECT game_id, map FROM lg_games"))
    season = dict(db.execute("SELECT game_id, season FROM lg_games"))
    newest = max(season.values()) if season else 0
    # cell = [games, wins, weighted games, weighted wins, newest window games, newest window wins]
    gm = lambda: collections.defaultdict(lambda: [0, 0, 0.0, 0.0, 0, 0])
    keys = ("ranged", "rdiff", "healers", "marks", "tanks", "shapes")
    tot = {k: gm() for k in keys}
    per = collections.defaultdict(lambda: {k: gm() for k in keys})
    n_sides = 0
    abbr = {"Tank": "T", "Bruiser": "B", "Melee Assassin": "M", "Ranged Assassin": "R", "Support": "S", "Healer": "H"}
    def rb(x): return "0-1" if x <= 1 else "4+" if x >= 4 else str(x)
    def cap(x, hi): return str(x) if x < hi else str(hi) + "+"
    for gid, s in sides.items():
        w = win.get(gid)
        if w is None or len(s[0]) != 5 or len(s[1]) != 5 or None in s[0] or None in s[1] or not any(h in heroes for h in s[0]):
            continue
        if any(h not in heroes for h in s[0] + s[1]):
            continue
        info = {t: [heroes[h] for h in s[t]] for t in (0, 1)}
        rng = {t: sum(bool(i.get("ranged")) for i in info[t]) for t in (0, 1)}
        for t in (0, 1):
            n_sides += 1
            won = int(w == t)
            wt = season_weight(season.get(gid, newest), newest)
            recent = newest - season.get(gid, newest) < RECENT_SEASONS
            roles = collections.Counter(abbr.get(i.get("role"), "?") for i in info[t])
            shape = " ".join(f"{k}{roles[k]}" for k in "TBMRSH" if roles[k])
            cells = {"ranged": rb(rng[t]), "rdiff": str(max(-2, min(2, rng[t] - rng[1 - t]))),
                     "healers": cap(roles["H"], 2), "marks": cap(sum(bool(i.get("marksman")) for i in info[t]), 2),
                     "tanks": cap(roles["T"], 2), "shapes": shape}
            for bucket in (tot, per[maps.get(gid)]):
                for k, v in cells.items():
                    c = bucket[k][v]; c[0] += 1; c[1] += won; c[2] += wt; c[3] += wt * won
                    if recent:
                        c[4] += 1; c[5] += won
    def clean(b, minn):
        return {k: {c: [v[0], v[1], round(v[2], 1), round(v[3], 1), v[4], v[5]] for c, v in d.items() if v[0] >= minn} for k, d in b.items()}
    out = dict(sides=n_sides, newest=newest, half_life=HALF_LIFE, recent_seasons=RECENT_SEASONS,
               all=clean(tot, 20), maps={m: clean(b, 8) for m, b in per.items() if m})
    out["all"]["shapes"] = {c: v for c, v in out["all"]["shapes"].items() if v[0] >= 60}
    return out


def league_combos(db, heroes, sides, win):
    """Takedown pairs from lg_kills. For two heroes drafted on one side, per game: team takedowns, takedowns with three or fewer heroes on them, and of those how many each took part in and both did. {"A|B": [games, wins, team kills, kills with A, kills with B, kills with both]} with A < B, 15 games or more.
    Both being on most kills is normal, so the engine reads it as lift: both / (A * B / team kills)."""
    kills = {}
    for gid, kteam, killers in db.execute("SELECT game_id, kteam, killers FROM lg_kills"):
        names = {canon_name(k, heroes) for k in killers.split("|")}
        names.discard(None)
        if len(names) <= 3:   # picks and small fights: in big fights nearly everyone is on the kill, so it shows nothing
            kills.setdefault((gid, int(kteam)), []).append(names)
    out = {}
    for (gid, team), rows in kills.items():
        roster = sorted(h for h in sides.get(gid, {0: [], 1: []})[team] if h)
        if len(rows) < 2:
            continue
        w = win.get(gid)
        for i, a in enumerate(roster):
            for b in roster[i + 1:]:
                if {a, b} == {"Cho", "Gall"}:
                    continue   # one player, two heroes
                r = out.setdefault(a + "|" + b, [0, 0, 0, 0, 0, 0])
                r[0] += 1; r[1] += int(w == team); r[2] += len(rows)
                r[3] += sum(a in n for n in rows); r[4] += sum(b in n for n in rows); r[5] += sum(a in n and b in n for n in rows)
    return {k: v for k, v in out.items() if v[0] >= 15}


def attach_kit(heroes):
    """Kit facts per hero from the expert hero matrix: crowd control, comp fit, engage, and Heroes Profile global rates. Judgment, not measured."""
    path = KN / "expert" / "hero_matrix_draft.json"
    if not path.exists():
        return
    m = rd(path)["heroes"]
    by_norm = {norm(k): k for k in m}
    for h, d in heroes.items():
        k = by_norm.get(norm(h))
        if not k and "cio" in norm(h):
            k = next((x for x in m if "cio" in x and x.startswith("L")), None)
        if not k:
            continue
        v = m[k]
        ex, meta = v.get("extra", {}), (v.get("meta") or {}).get("patch_257_plus_255") or {}
        d["kit"] = dict(sub=v.get("sub_role"), cc=ex.get("cc_types_base_kit", []), cc_talent=ex.get("cc_types_talent_only", []), cc_amount=ex.get("cc_amount"),
                        fit=v.get("comp_fit", []), ult=ex.get("ult_type"), engage=v["ratings"].get("engage"), peel=v["ratings"].get("peel"),
                        mobility=v["ratings"].get("mobility"), vuln=ex.get("vulnerable_to", []), strength=v.get("strengths_note"), weak=v.get("weaknesses_note"),
                        wr=meta.get("win"), ban=meta.get("ban"), pick=meta.get("pick"), n=meta.get("games"))


def archetype(role, hero, arch):
    """Label used in the roster table: Offlaner, Bruiser DPS, Dive assassin, Ranged DPS, Tank, Healer or Support."""
    if hero in arch.get("bruiser_dps", []):
        return "Bruiser DPS"
    if hero in arch.get("dive", []):
        return "Dive assassin"
    if hero in arch.get("offlaner_extra", []) or role == "Bruiser":
        return "Offlaner"
    return {"Ranged Assassin": "Ranged DPS", "Melee Assassin": "Dive assassin"}.get(role, role if role in ("Tank", "Healer", "Support") else "Unknown")


def parse_draft_strategy(text):
    prefer, avoid, cur = [], [], None
    for line in (text or "").split("\n"):
        line = line.strip()
        if not line:
            continue
        if line == "Prefer":
            cur = prefer
        elif line == "Avoid":
            cur = avoid
        elif line.startswith("See our"):
            break
        elif cur is not None:
            cur.append(line)
    return prefer, avoid


def build_maps(kdb, canon, map_names):
    maps = {}
    for name in map_names:
        slug = slug_text(name)
        sec = kdb.execute("SELECT text FROM map_section WHERE map=? AND title='Draft Strategy'", (slug,)).fetchall()
        prefer, avoid = parse_draft_strategy(sec[0][0]) if sec else ([], [])
        tiers = collections.defaultdict(dict)
        for hero, role, tier in kdb.execute("SELECT hero, role, tier FROM tier_entry WHERE list_name=?", (slug,)):
            display = canon.get(norm(hero))
            if display:
                tiers[display][re.sub(r" 1 Hero$", "", role)] = tier[-1]
        maps[name] = dict(name=name, slug=slug, prefer=prefer, avoid=avoid, tiers=tiers)
    return maps


# ---------------------------------------------------------------- game data
def games(db):
    cols = ["replay_id", "date_utc", "map", "length_sec", "team0", "team1", "winner", "first_pick_team", "map_pick_team", "series", "round"]
    out = {}
    for row in db.execute(f"SELECT {','.join(cols)} FROM ngs_game ORDER BY date_utc"):
        g = dict(zip(cols, row))
        g["bans"] = []
        g["picks"] = []
        g["players"] = []
        out[g["replay_id"]] = g
    for rid, team, slot, hero in db.execute("SELECT replay_id, team, slot, hero FROM ngs_hero_ban ORDER BY slot"):
        out[rid]["bans"].append((team, slot, hero))
    for rid, team, slot, hero in db.execute("SELECT replay_id, team, slot, hero FROM ngs_pick ORDER BY slot"):
        out[rid]["picks"].append((team, slot, hero))
    pc = ["replay_id", "team", "battletag", "hero", "won", "rating", "kills", "assists", "deaths", "hero_damage", "minion_damage", "creep_damage",
          "structure_damage", "xp_contribution", "merc_camps", "healing"]
    for row in db.execute(f"SELECT {','.join(pc)} FROM ngs_player_game"):
        d = dict(zip(pc, row))
        out[d["replay_id"]]["players"].append(d)
    return out


def attach_hero_stats(heroes, G):
    acc = collections.defaultdict(lambda: [0, 0.0, 0.0, 0.0, 0.0, 0])
    for g in G.values():
        mins = (g["length_sec"] or 1) / 60
        for p in g["players"]:
            a = acc[p["hero"]]
            a[0] += 1
            a[1] += (p["minion_damage"] or 0) / mins
            a[2] += (p["creep_damage"] or 0) / mins
            a[3] += (p["hero_damage"] or 0) / mins
            a[4] += (p["structure_damage"] or 0) / mins
            a[5] += p["deaths"] or 0
    for h, (n, minion, creep, dmg, struct, deaths) in acc.items():
        if h in heroes:
            heroes[h]["stats"] = dict(g=n, minion_pm=round(minion / n), creep_pm=round(creep / n), dmg_pm=round(dmg / n), struct_pm=round(struct / n), deaths=round(deaths / n, 1))
            heroes[h]["high_clear"] = n >= 3 and minion / n >= HIGH_CLEAR
            heroes[h]["high_damage"] = n >= 3 and dmg / n >= HIGH_DAMAGE


def rec(v):
    return [v[0], v[1]]


def add(d, key, won):
    d.setdefault(key, [0, 0])
    d[key][0] += 1
    d[key][1] += int(bool(won))


def team_profile(name, G, heroes, us_name):
    mine = [g for g in G.values() if name in (g["team0"], g["team1"])]
    t = dict(name=name, games=len(mine), wins=sum(g["winner"] == name for g in mine), by_map={}, as_map_picker={}, first_pick=[0, 0], map_pick=[0, 0],
             bans_r1={}, bans_r2={}, bans_vs_us={}, bans_r2_vs_us={}, bans_games_vs_us=0, picks_by_slot={}, hero_picks={}, players={}, faced={}, vs_healer={}, h2h=[],
             hero_picks_vs_us={}, our_heroes_vs_them={}, log=[])
    pl = collections.defaultdict(lambda: collections.defaultdict(lambda: dict(g=0, w=0, rating=0, deaths=0, dmg=0.0)))
    for g in mine:
        won = g["winner"] == name
        opp = g["team1"] if g["team0"] == name else g["team0"]
        add(t["by_map"], g["map"], won)
        if g["map_pick_team"] == name:
            add(t["as_map_picker"], g["map"], won)
            t["map_pick"][0] += 1; t["map_pick"][1] += won
        if g["first_pick_team"] == name:
            t["first_pick"][0] += 1; t["first_pick"][1] += won
        if opp == us_name:
            t["bans_games_vs_us"] += 1
            t["h2h"].append(dict(id=g["replay_id"], date=g["date_utc"][:10], map=g["map"], won=won, first_pick=g["first_pick_team"] == name, map_pick=g["map_pick_team"] == name))
            for tm, slot, hero in g["picks"]:
                if tm == name:
                    add(t["hero_picks_vs_us"], hero, won)      # [games, their wins] with the hero against us
                else:
                    add(t["our_heroes_vs_them"], hero, not won)  # [games, OUR wins] with the hero against them
        for team, slot, hero in g["bans"]:
            if team == name:
                tgt = t["bans_r1"] if slot <= 4 else t["bans_r2"]
                tgt[hero] = tgt.get(hero, 0) + 1
                if opp == us_name:
                    t["bans_vs_us"][hero] = t["bans_vs_us"].get(hero, 0) + 1
                    if slot >= 10:
                        t["bans_r2_vs_us"][hero] = t["bans_r2_vs_us"].get(hero, 0) + 1
        for team, slot, hero in g["picks"]:
            if team == name:
                t["picks_by_slot"].setdefault(str(slot), {})
                t["picks_by_slot"][str(slot)][hero] = t["picks_by_slot"][str(slot)].get(hero, 0) + 1
                add(t["hero_picks"], hero, won)
            else:
                add(t["faced"], hero, won)
        # one row per game from this team's side: the raw material for combos, conditions and "with versus without" records at run time
        t["log"].append(dict(map=g["map"], won=int(bool(won)), fp=int(g["first_pick_team"] == name), vs=opp,
                             picks=[h for tm, s, h in g["picks"] if tm == name], opp_picks=[h for tm, s, h in g["picks"] if tm != name],
                             bans=[h for tm, s, h in g["bans"] if tm == name], opp_bans=[h for tm, s, h in g["bans"] if tm != name]))
        opp_healers = [h for tm, s, h in g["picks"] if tm != name and heroes.get(h, {}).get("role") == "Healer"]
        for h in opp_healers:
            add(t["vs_healer"], h, won)
        mins = (g["length_sec"] or 1) / 60
        for p in g["players"]:
            if p["team"] == name:
                r = pl[p["battletag"]][p["hero"]]
                r["g"] += 1; r["w"] += p["won"]; r["rating"] += p["rating"] or 0; r["deaths"] += p["deaths"] or 0; r["dmg"] += (p["hero_damage"] or 0) / mins
    for tag, hs in pl.items():
        tot_g = sum(r["g"] for r in hs.values())
        tot_rating = sum(r["rating"] for r in hs.values())
        heroes_out = {}
        for h, r in sorted(hs.items(), key=lambda kv: -kv[1]["g"]):
            others = (tot_g - r["g"])
            others_avg = (tot_rating - r["rating"]) / others if others else None
            heroes_out[h] = dict(g=r["g"], w=r["w"], rating=round(r["rating"] / r["g"], 1), deaths=round(r["deaths"] / r["g"], 1), dmg=round(r["dmg"] / r["g"]),
                                 others_avg=round(others_avg, 1) if others_avg is not None else None,
                                 weak=bool(others and r["g"] >= 3 and r["rating"] / r["g"] <= others_avg - 6))
        t["players"][tag] = dict(games=tot_g, avg_rating=round(tot_rating / tot_g, 1), heroes=heroes_out)
    return t


def map_stats(G, heroes):
    """Per map: winners versus losers on ranged count and macro numbers, hero usage and bans."""
    out = {}
    for g in G.values():
        m = out.setdefault(g["map"], dict(games=0, ranged_rec={"3+": [0, 0], "2-": [0, 0]}, win_ranged=[], loss_ranged=[], macro={"win": collections.defaultdict(list), "loss": collections.defaultdict(list)},
                                         hero_picks={}, hero_bans={}, avg_len=0))
        m["games"] += 1
        m["avg_len"] += g["length_sec"] or 0
        mins = (g["length_sec"] or 1) / 60
        for team in (g["team0"], g["team1"]):
            won = g["winner"] == team
            ps = [p for p in g["players"] if p["team"] == team]
            rcount = sum(heroes.get(p["hero"], {}).get("ranged", False) for p in ps)
            key = "3+" if rcount >= 3 else "2-"
            m["ranged_rec"][key][0] += 1; m["ranged_rec"][key][1] += won
            (m["win_ranged"] if won else m["loss_ranged"]).append(rcount)
            side = m["macro"]["win" if won else "loss"]
            side["deaths"].append(sum(p["deaths"] or 0 for p in ps))
            side["camp_dmg"].append(sum(p["creep_damage"] or 0 for p in ps) / mins / 1000)
            side["camps"].append(sum(p["merc_camps"] or 0 for p in ps))
            side["struct"].append(sum(p["structure_damage"] or 0 for p in ps) / mins / 1000)
            side["minion"].append(sum(p["minion_damage"] or 0 for p in ps) / mins / 1000)
            side["xp"].append(sum(p["xp_contribution"] or 0 for p in ps) / mins / 1000)
            for p in ps:
                add(m["hero_picks"], p["hero"], won)
        for team, slot, hero in g["bans"]:
            m["hero_bans"][hero] = m["hero_bans"].get(hero, 0) + 1
    for m in out.values():
        m["avg_len"] = round(m["avg_len"] / m["games"] / 60, 1)
        m["win_ranged_avg"] = round(sum(m["win_ranged"]) / max(len(m["win_ranged"]), 1), 2)
        m["loss_ranged_avg"] = round(sum(m["loss_ranged"]) / max(len(m["loss_ranged"]), 1), 2)
        del m["win_ranged"], m["loss_ranged"]
        m["macro"] = {k: {kk: round(sum(v) / len(v), 2) for kk, v in d.items() if v} for k, d in m["macro"].items()}
    return out


def map_ban_habits(db):
    out = collections.defaultdict(lambda: collections.defaultdict(int))
    series = collections.defaultdict(set)
    for s, r, team, n, m in db.execute("SELECT series, round, team, ban_no, map FROM ngs_map_ban"):
        out[team][m] += 1
        series[team].add(s)
    return {t: dict(bans=dict(d), series=len(series[t])) for t, d in out.items()}


# ---------------------------------------------------------------- seasons (NGS last season, Storm League seasons)
_BID = {}
_PREV = {}


def bid_by_tag():
    """battletag -> Heroes Profile id, from the saved NGS match pages (ngs_season.db)."""
    if not _BID:
        path = KN / "ngs_season.db"
        if path.exists():
            for tag, bid in sqlite3.connect(path).execute("SELECT DISTINCT battletag, blizz_id FROM ngs_player_game WHERE blizz_id IS NOT NULL"):
                _BID[tag] = str(bid)
    return _BID


def prev_ngs(heroes):
    """Season 21 NGS hero records per Heroes Profile id: {id: {hero: {g, w, deaths}}} and, for playoff games, {id + "p": ...}.
    Heroes Profile match pages (knowledge/ngs_season21.db, some divisions) are richer and have the round, so they win where a player has at
    least as many games there as in the replay export (knowledge/ngs_league.db, every division, no round)."""
    if not _PREV:
        hp, ex = {}, {}
        p21 = KN / "ngs_season21.db"
        if p21.exists():
            for bid, hero, won, deaths, rnd in sqlite3.connect(p21).execute(
                    "SELECT p.blizz_id, p.hero, p.won, p.deaths, g.round FROM ngs_player_game p JOIN ngs_game g USING(replay_id) WHERE p.blizz_id IS NOT NULL"):
                key = str(bid) + ("p" if str(rnd).upper().startswith("T") else "")
                r = hp.setdefault(key, {}).setdefault(canon_name(hero, heroes), dict(g=0, w=0, deaths=0))
                r["g"] += 1; r["w"] += int(won); r["deaths"] += deaths or 0
        path = KN / "ngs_league.db"
        if path.exists():
            db = sqlite3.connect(path)
            for winner, side, hero, toon, deaths in db.execute(
                    "SELECT g.winner, p.team, p.hero, p.toon, p.deaths FROM lg_players p JOIN lg_games g USING(game_id) WHERE g.season=21"):
                bid = toon.split("-")[-1]
                r = ex.setdefault(bid, {}).setdefault(canon_name(hero, heroes), dict(g=0, w=0, deaths=0))
                r["g"] += 1; r["w"] += int(winner == side); r["deaths"] += deaths or 0
        # seasons 15 to 20 from the replay export, merged into one "older" record per player (key id + "o")
        old = {}
        if path.exists():
            for winner, side, hero, toon, deaths in db.execute(
                    "SELECT g.winner, p.team, p.hero, p.toon, p.deaths FROM lg_players p JOIN lg_games g USING(game_id) WHERE g.season<21"):
                r = old.setdefault(toon.split("-")[-1] + "o", {}).setdefault(canon_name(hero, heroes), dict(g=0, w=0, deaths=0))
                r["g"] += 1; r["w"] += int(winner == side); r["deaths"] += deaths or 0
        for key, hs in old.items():
            _PREV[key] = {h: dict(g=r["g"], w=r["w"], deaths=round(r["deaths"] / r["g"], 1)) for h, r in hs.items()}
        total = lambda d: sum(r["g"] for r in d.values()) if d else 0
        for key in set(hp) | set(ex):
            if key.endswith("p"):
                chosen = hp.get(key)
            else:
                a, b = hp.get(key), ex.get(key)
                chosen = a if total(a) >= total(b) else b
                # playoff games in the export would be counted in the regular figure; only Heroes Profile pages can tell them apart
            if chosen:
                _PREV[key] = {h: dict(g=r["g"], w=r["w"], deaths=round(r["deaths"] / r["g"], 1)) for h, r in chosen.items()}
    return _PREV


def sl_scopes(bid, heroes):
    """Storm League hero games and wins per scope (all time, seasons 32 to 34) from the pulled Heroes Profile files, when we have them."""
    out = {}
    for folder in glob.glob(str(KN / "raw" / "players_hp" / f"*_{bid}")):
        for scope, name in (("all", "sl_heroes.json"), ("s32", "sl_heroes_s32.json"), ("s33", "sl_heroes_s33.json"), ("s34", "sl_heroes_s34.json")):
            f = pathlib.Path(folder) / name
            if f.exists():
                rows = rd(f)
                out[scope] = {canon_name(r["name"], heroes): [r["games_played"], r["wins"]] for r in rows if r.get("games_played")}
    return out


# ---------------------------------------------------------------- our team
def our_team(cfg, G, heroes):
    us = cfg["team"]
    team = dict(cfg)
    team["profile_key"] = us
    for p in team["players"]:
        stats = collections.defaultdict(lambda: dict(g=0, w=0, rating=0, deaths=0))
        for g in G.values():
            for r in g["players"]:
                if r["team"] == us and r["battletag"] == p["tag"]:
                    s = stats[r["hero"]]
                    s["g"] += 1; s["w"] += r["won"]; s["rating"] += r["rating"] or 0; s["deaths"] += r["deaths"] or 0
        p["ngs"] = {h: dict(g=s["g"], w=s["w"], rating=round(s["rating"] / s["g"], 1), deaths=round(s["deaths"] / s["g"], 1)) for h, s in stats.items()}
        bid = bid_by_tag().get(p["tag"])
        p["ngs_by"] = {"22": p["ngs"], "22p": {}, "21": prev_ngs(heroes).get(bid, {}) if bid else {}, "21p": prev_ngs(heroes).get(str(bid) + "p", {}) if bid else {},
                      "old": prev_ngs(heroes).get(str(bid) + "o", {}) if bid else {}}
        if bid:
            p["sl_scopes"] = sl_scopes(bid, heroes)
        for h in list(p["pool"]) + list(p.get("avoid", [])):
            if h not in heroes:
                raise SystemExit(f"our_team.json: unknown hero {h!r} for {p['tag']}")
        src = p.get("sl_source")
        if src and (ROOT / src).exists():
            db = sqlite3.connect(ROOT / src)
            since = p.get("sl_since", "2025-01-01")
            sl = {h: [n, w] for h, n, w in db.execute("SELECT hero, COUNT(*), SUM(won) FROM hp_game WHERE game_type='sl' AND date>=? GROUP BY hero", (since,))}
            by_map = collections.defaultdict(dict)
            for m, h, n, w in db.execute("SELECT map, hero, COUNT(*), SUM(won) FROM hp_game WHERE game_type='sl' AND date>=? GROUP BY map, hero", (since,)):
                by_map[m][h] = [n, w]
            map_all = {m: [sum(v[0] for v in d.values()), sum(v[1] for v in d.values())] for m, d in by_map.items()}
            all_sl = {canon_name(h, heroes): [n, w] for h, n, w in db.execute("SELECT hero, COUNT(*), SUM(won) FROM hp_game WHERE game_type='sl' GROUP BY hero")}
            p.setdefault("sl_scopes", {})["all"] = all_sl
            p["sl"] = dict(since=since, heroes={canon_name(h, heroes): v for h, v in sl.items()}, by_map={m: {canon_name(h, heroes): v for h, v in d.items()} for m, d in by_map.items()}, map_all=map_all)
    return team


def canon_name(h, heroes):
    if h in heroes:
        return h
    k = norm(h)
    for n in heroes:
        if norm(n) == k:
            return n
    return h


# ---------------------------------------------------------------- the whole league (every NGS division we have games for)
ICE_ROLE = {"Bruiser": "Offlaner"}


def sl_mmr_table(db):
    """battletag -> [Storm League MMR, rank, wins, losses]: knowledge/sl_mmr.json is keyed by Heroes Profile id (build_sl_mmr.py),
    the match pages give the id for each battletag."""
    path = KN / "sl_mmr.json"
    if not path.exists():
        return {}
    by_id = rd(path)
    out = {}
    for tag, bid in db.execute("SELECT DISTINCT battletag, blizz_id FROM ngs_player_game WHERE blizz_id IS NOT NULL"):
        if str(bid) in by_id:
            out[tag] = by_id[str(bid)]
    return out


def derived_profile(team, G, heroes, mmr):
    """A usable 'us' for a team we have no hand written pools for: pools come from this season's NGS games."""
    stats = collections.defaultdict(lambda: collections.defaultdict(lambda: dict(g=0, w=0, rating=0, deaths=0)))
    for g in G.values():
        for r in g["players"]:
            if r["team"] == team:
                s = stats[r["battletag"]][r["hero"]]
                s["g"] += 1; s["w"] += r["won"]; s["rating"] += r["rating"] or 0; s["deaths"] += r["deaths"] or 0
    players = []
    for tag, hs in sorted(stats.items(), key=lambda kv: -sum(s["g"] for s in kv[1].values())):
        games = sum(s["g"] for s in hs.values())
        if games < 2 and len(players) >= 5:
            continue
        pool = {}
        for h, s in sorted(hs.items(), key=lambda kv: -kv[1]["g"])[:10]:
            if h in heroes:
                pool[h] = "primary" if s["g"] >= 3 else ("secondary" if s["g"] == 2 else "practice")
        roles = collections.Counter()
        for h, s in hs.items():
            r = heroes.get(h, {}).get("role")
            if r and r != "Unknown":
                roles[ICE_ROLE.get(r, r)] += s["g"]
        top = [r for r, _ in roles.most_common(2)]
        m = mmr.get(tag)
        bid = bid_by_tag().get(tag)
        extra = {}
        if bid:
            extra = dict(ngs_by={"22": {h: dict(g=s["g"], w=s["w"], rating=round(s["rating"] / s["g"], 1), deaths=round(s["deaths"] / s["g"], 1)) for h, s in hs.items()},
                                 "22p": {}, "21": prev_ngs(heroes).get(bid, {}), "21p": prev_ngs(heroes).get(bid + "p", {}), "old": prev_ngs(heroes).get(bid + "o", {})}, sl_scopes=sl_scopes(bid, heroes))
        players.append(dict(tag=tag, label=tag, **extra, slot_role=(top[0] if top else "Unknown"), tier_roles=top or ["Ranged Assassin"], pool=pool, avoid=[], notes={},
                            ngs={h: dict(g=s["g"], w=s["w"], rating=round(s["rating"] / s["g"], 1), deaths=round(s["deaths"] / s["g"], 1)) for h, s in hs.items()},
                            sl_mmr=m, derived=True))
    return dict(team=team, players=players[:7], derived=True)


def pair_view(G, a, b, heroes):
    """What team a did against team b, from a's side (the parts of a team profile that depend on who 'us' is)."""
    sub = {rid: g for rid, g in G.items() if {g["team0"], g["team1"]} == {a, b}}
    if not sub:
        return None
    t = team_profile(a, sub, heroes, b)
    return {k: t[k] for k in ("h2h", "bans_vs_us", "bans_r2_vs_us", "bans_games_vs_us", "hero_picks_vs_us", "our_heroes_vs_them")}


def last_season_history(names):
    """Last season's record and habits for the given team names, from the replay export (knowledge/ngs_league.db), if we have it."""
    out = {}
    p21 = KN / "ngs_season21.db"
    complete = set()
    if p21.exists():
        # a division counts as complete when we hold (nearly) every game the export lists for it
        have = dict(sqlite3.connect(p21).execute("SELECT division, COUNT(*) FROM ngs_game GROUP BY division").fetchall())
        lg = KN / "ngs_league.db"
        if lg.exists():
            tot = dict(sqlite3.connect(lg).execute("SELECT division, COUNT(*) FROM lg_games WHERE season=21 GROUP BY division").fetchall())
            complete = {d for d, n in have.items() if n >= 0.95 * tot.get(d, 10 ** 9)}
        else:
            complete = set(have)
    if p21.exists() and complete:
        db = sqlite3.connect(p21)
        for name in names:
            games = db.execute("SELECT replay_id, winner, first_pick_team FROM ngs_game WHERE (team0=? OR team1=?) AND division IN (%s)" % ",".join("?" * len(complete)),
                               [name, name] + sorted(complete)).fetchall()
            if not games:
                continue
            ids = [g[0] for g in games]
            q = ",".join("?" * len(ids))
            won = {rid: w == name for rid, w, f in games}
            first = [won[rid] for rid, w, f in games if f == name]
            picks, bans = collections.defaultdict(lambda: [0, 0]), collections.Counter()
            for rid, hero in db.execute(f"SELECT replay_id, hero FROM ngs_pick WHERE team=? AND replay_id IN ({q})", [name] + ids):
                picks[hero][0] += 1; picks[hero][1] += int(won[rid])
            for (hero,) in db.execute(f"SELECT hero FROM ngs_hero_ban WHERE team=? AND replay_id IN ({q})", [name] + ids):
                bans[hero] += 1
            rounds = {rid: str(r) for rid, r in db.execute(f"SELECT replay_id, round FROM ngs_game WHERE replay_id IN ({q})", ids)}
            po = [rid for rid in ids if rounds[rid].upper().startswith("T")]
            out[name] = dict(games=len(games), wins=sum(won.values()), first_pick=[len(first), sum(first)],
                             playoffs=[len(po), sum(1 for rid in po if won[rid])],
                             picks=[[h, v[0], v[1]] for h, v in sorted(picks.items(), key=lambda kv: -kv[1][0])[:8]],
                             bans=[[h, n] for h, n in bans.most_common(6)])
    path = KN / "ngs_league.db"
    if not path.exists():
        return out
    db = sqlite3.connect(path)
    for name in names:
        if name in out:
            continue
        games = db.execute("SELECT game_id, team0, team1, winner, first_pick FROM lg_games WHERE season=21 AND (team0=? OR team1=?)", (name, name)).fetchall()
        if not games:
            continue
        side = {gid: (0 if t0 == name else 1) for gid, t0, t1, w, f in games}
        wins = sum(1 for gid, t0, t1, w, f in games if w == side[gid])
        first = [(gid, w == side[gid]) for gid, t0, t1, w, f in games if f == side[gid]]
        picks, bans = collections.defaultdict(lambda: [0, 0]), collections.Counter()
        won = {gid: (w == side[gid]) for gid, t0, t1, w, f in games}
        for gid, team, hero in db.execute("SELECT game_id, team, hero FROM lg_picks WHERE game_id IN (%s)" % ",".join("?" * len(side)), list(side)):
            if team == side[gid]:
                picks[hero][0] += 1; picks[hero][1] += int(won[gid])
        for gid, team, hero in db.execute("SELECT game_id, team, hero FROM lg_bans WHERE game_id IN (%s)" % ",".join("?" * len(side)), list(side)):
            if team == side[gid] and hero:
                bans[hero] += 1
        out[name] = dict(games=len(games), wins=wins, first_pick=[len(first), sum(w for _, w in first)],
                         picks=[[h, v[0], v[1]] for h, v in sorted(picks.items(), key=lambda kv: -kv[1][0])[:8]],
                         bans=[[h, n] for h, n in bans.most_common(6)])
    return out


def league_maps():
    path = KN / "ngs_season.db"
    if not path.exists():
        return set()
    return {m for (m,) in sqlite3.connect(path).execute("SELECT DISTINCT map FROM ngs_game")}


def build_league(cfg, curated_us, heroes):
    path = KN / "ngs_season.db"
    if not path.exists():
        return None
    db = sqlite3.connect(path)
    G = games(db)
    if not G:
        return None
    div = {}
    for t0, t1, d in db.execute("SELECT team0, team1, division FROM ngs_game"):
        div[t0] = d; div[t1] = d
    mmr = sl_mmr_table(db)
    names = sorted(div)
    teams = {n: team_profile(n, G, heroes, None) for n in names}
    for t in teams.values():
        for tag, p in t["players"].items():
            m = mmr.get(tag)
            if m:
                p["sl_mmr"] = m
            bid = bid_by_tag().get(tag)
            if bid and prev_ngs(heroes).get(bid):
                p["prev_heroes"] = prev_ngs(heroes)[bid]
            if bid and prev_ngs(heroes).get(bid + "p"):
                p["prev_heroes_p"] = prev_ngs(heroes)[bid + "p"]
            if bid and prev_ngs(heroes).get(bid + "o"):
                p["old_heroes"] = prev_ngs(heroes)[bid + "o"]
    pairs = {}
    for a in names:
        for b in names:
            if a != b and div[a] == div[b]:
                v = pair_view(G, a, b, heroes)
                if v:
                    pairs[a + "|" + b] = v
    profiles = {}
    map_hero = {}
    for n in names:
        mh = collections.defaultdict(lambda: collections.defaultdict(dict))
        for g in G.values():
            for p in g["players"]:
                if p["team"] == n:
                    add(mh[g["map"]][p["battletag"]], p["hero"], p["won"])
        map_hero[n] = {m: dict(v) for m, v in mh.items()}
        if n != cfg["team"]:
            profiles[n] = derived_profile(n, G, heroes, mmr)
    # curated players also get their Storm League MMR
    for p in curated_us["players"]:
        m = mmr.get(p["tag"])
        if m:
            p["sl_mmr"] = m
    aliases = []
    ap = KN / "team_aliases.json"
    if ap.exists():
        aliases = [a for a in rd(ap) if a["team"] in div]
    history = last_season_history(sorted({a["former"] for a in aliases} | set(names)))
    return dict(divisions=div, teams=teams, pairs=pairs, profiles=profiles, map_hero=map_hero, map_stats=map_stats(G, heroes),
                aliases=aliases, history=history,
                map_bans=map_ban_habits(db), games=len(G), mmr_players=len(mmr), curated=cfg["team"])


# ---------------------------------------------------------------- notes and fact sheets
def read_note(kind, name):
    path = PB / "notes" / kind / f"{slug_text(name)}.md"
    return path.read_text(encoding="utf-8").strip() if path.exists() else ""


def pct(v):
    return f"{v[1]}-{v[0] - v[1]}" if v else "0-0"


def team_sheet(t, data, us_name):
    lines = [f"# {t['name']}: team fact sheet", "",
             f"Built {data['meta']['built']} from {data['meta']['games']} games of {data['meta']['division']} Season {data['meta']['season']}. Generated by `build_playbook.py`; edit `playbook/notes/teams/{slug_text(t['name'])}.md` for the written lessons. Small samples.", "",
             f"**Record:** {t['wins']}-{t['games'] - t['wins']}. First pick {pct(t['first_pick'])}, when they pick the map {pct(t['map_pick'])}."]
    if t["h2h"]:
        lines += ["", f"**Against {us_name} (our result):** " + ", ".join(f"{h['map']} {'L' if h['won'] else 'W'}" for h in t["h2h"])]
    lines += ["", "## Players and heroes (this season)", "| Player | Games | Avg rating | Heroes (games, wins, rating, deaths) |", "|---|---|---|---|"]
    for tag, p in sorted(t["players"].items(), key=lambda kv: -kv[1]["games"]):
        hs = ", ".join(f"{h} {d['g']}g {d['w']}w r{d['rating']:.0f} {d['deaths']}d" for h, d in list(p["heroes"].items())[:6])
        lines.append(f"| {tag} | {p['games']} | {p['avg_rating']} | {hs} |")
    weak = []
    for tag, p in t["players"].items():
        for h, d in p["heroes"].items():
            if d["weak"]:
                weak.append(f"{tag} on {h} ({d['g']} games, rating {d['rating']:.0f} against {d['others_avg']:.0f} on his other heroes)")
    if weak:
        lines += ["", "**Heroes a player is clearly worse on than elsewhere (leave open, do not waste a ban):** " + "; ".join(weak)]
    lines += ["", "## Draft habits"]
    lines.append("- Round one bans (slots 1 to 4): " + (", ".join(f"{h} {n}" for h, n in sorted(t["bans_r1"].items(), key=lambda kv: -kv[1])[:8]) or "none"))
    lines.append("- Round two bans (slot 10 or 11): " + (", ".join(f"{h} {n}" for h, n in sorted(t["bans_r2"].items(), key=lambda kv: -kv[1])[:8]) or "none"))
    if t["bans_games_vs_us"]:
        lines.append(f"- Bans against {us_name} ({t['bans_games_vs_us']} games): " + ", ".join(f"{h} {n}" for h, n in sorted(t["bans_vs_us"].items(), key=lambda kv: -kv[1])[:8]))
    hp = sorted(t["hero_picks"].items(), key=lambda kv: -kv[1][0])[:10]
    lines.append("- Most picked: " + ", ".join(f"{h} {pct(v)}" for h, v in hp))
    lines += ["", "## Maps (record, record as map picker)", "| Map | Record | As map picker |", "|---|---|---|"]
    for m, v in sorted(t["by_map"].items(), key=lambda kv: -kv[1][0]):
        lines.append(f"| {m} | {pct(v)} | {pct(t['as_map_picker'].get(m))} |")
    mb = data["map_bans"].get(t["name"])
    if mb:
        lines.append("")
        lines.append(f"Map bans over {mb['series']} series: " + ", ".join(f"{m} {n}" for m, n in sorted(mb["bans"].items(), key=lambda kv: -kv[1])))
    hv = sorted(t["vs_healer"].items(), key=lambda kv: -kv[1][0])
    if hv:
        lines += ["", "## Record by opposing healer", ", ".join(f"{h} {pct(v)}" for h, v in hv)]
    lose = sorted([(h, v) for h, v in t["faced"].items() if v[0] >= 2], key=lambda kv: (kv[1][1] / kv[1][0], -kv[1][0]))[:6]
    if lose:
        lines += ["", "## Heroes they struggle against (2 or more games)", ", ".join(f"{h} {pct(v)}" for h, v in lose)]
    if t.get("notes"):
        lines += ["", "## Curated notes", "", t["notes"]]
    return "\n".join(lines) + "\n"


def map_sheet(m, data):
    st = data["map_stats"].get(m["name"], {})
    lines = [f"# {m['name']}: map fact sheet", "",
             f"Built {data['meta']['built']}. Icy Veins draft advice and tier lists, plus {st.get('games', 0)} Season {data['meta']['season']} games. Edit `playbook/notes/maps/{slug_text(m['name'])}.md` for written lessons.", "",
             "**Icy Veins prefers:** " + (", ".join(m["prefer"]) or "n/a"), "", "**Icy Veins avoids:** " + (", ".join(m["avoid"]) or "n/a")]
    us = data["us"]["team"]
    lines += ["", "## Records on this map", "| Team | Record |", "|---|---|"]
    for name, t in sorted(data["teams"].items()):
        v = t["by_map"].get(m["name"])
        if v:
            lines.append(f"| {name} | {pct(v)} |")
    if st:
        r = st["ranged_rec"]
        lines += ["", f"**Ranged heroes**: winners average {st['win_ranged_avg']}, losers {st['loss_ranged_avg']}. Three or more ranged {pct(r['3+'])}, two or fewer {pct(r['2-'])}.",
                  f"**Macro, winners against losers (per minute, k):** camp damage {st['macro'].get('win', {}).get('camp_dmg')} v {st['macro'].get('loss', {}).get('camp_dmg')}, structure damage {st['macro'].get('win', {}).get('struct')} v {st['macro'].get('loss', {}).get('struct')}, minion damage {st['macro'].get('win', {}).get('minion')} v {st['macro'].get('loss', {}).get('minion')}, experience {st['macro'].get('win', {}).get('xp')} v {st['macro'].get('loss', {}).get('xp')}. Deaths {st['macro'].get('win', {}).get('deaths')} v {st['macro'].get('loss', {}).get('deaths')}. Average length {st['avg_len']} minutes."]
    lines += ["", f"## {us}: heroes on this map (NGS this season, and Storm League for players with that data)", "| Player | NGS on this map | Storm League last year |", "|---|---|---|"]
    for p in data["us"]["players"]:
        ng = data["our_map_hero"].get(m["name"], {}).get(p["tag"], {})
        ngs_txt = ", ".join(f"{h} {pct(v)}" for h, v in sorted(ng.items(), key=lambda kv: -kv[1][0])) or "none yet"
        sl = p.get("sl", {}).get("by_map", {}).get(m["name"], {})
        sl_txt = ", ".join(f"{h} {pct(v)}" for h, v in sorted(sl.items(), key=lambda kv: -kv[1][0])[:5] if v[0] >= 3) or "n/a"
        lines.append(f"| {p['tag']} | {ngs_txt} | {sl_txt} |")
    lines += ["", "## Icy Veins tiers for our pools (by the role each player fills)", "| Player | Hero | Role list | Tier |", "|---|---|---|---|"]
    for p in data["us"]["players"]:
        for h in p["pool"]:
            tiers = m["tiers"].get(h, {})
            use = [r for r in tiers if any(r.startswith(tr) for tr in p["tier_roles"])] or list(tiers)
            for r in use[:1]:
                lines.append(f"| {p['tag']} | {h} | {r} | {tiers[r]} |")
    lines += ["", "## Most used heroes on this map (NGS)", ", ".join(f"{h} {pct(v)}" for h, v in sorted(st.get("hero_picks", {}).items(), key=lambda kv: -kv[1][0])[:14])]
    lines += ["", "Most banned: " + ", ".join(f"{h} {n}" for h, n in sorted(st.get("hero_bans", {}).items(), key=lambda kv: -kv[1])[:8])]
    if m.get("notes"):
        lines += ["", "## Curated notes", "", m["notes"]]
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------- main
def main():
    cfg = rd(PB / "config" / "our_team.json")
    rules = rd(PB / "config" / "rules.json")
    db = sqlite3.connect(KN / "ngs_div.db")
    heroes, canon, kdb = build_heroes(cfg)
    G = games(db)
    attach_hero_stats(heroes, G)
    attach_kit(heroes)
    obs, h2h, combos, comps = league_observed(heroes)
    for h, o in obs.items():
        if h in heroes:
            heroes[h]["obs"] = o
    names = sorted({g["team0"] for g in G.values()} | {g["team1"] for g in G.values()})
    map_names = sorted({g["map"] for g in G.values()} | league_maps())
    maps = build_maps(kdb, canon, map_names)
    teams = {n: team_profile(n, G, heroes, cfg["team"]) for n in names}
    for n, t in teams.items():
        t["notes"] = read_note("teams", n)
    for n, m in maps.items():
        m["notes"] = read_note("maps", n)
    our_map_hero = collections.defaultdict(lambda: collections.defaultdict(dict))
    for g in G.values():
        for p in g["players"]:
            if p["team"] == cfg["team"]:
                add(our_map_hero[g["map"]][p["battletag"]], p["hero"], p["won"])
    data = dict(
        meta=dict(built=datetime.date.today().isoformat(), games=len(G), season=cfg["season"], division=cfg["division"], newest_game=max(g["replay_id"] for g in G.values()),
                  newest_date=max(g["date_utc"] for g in G.values())[:10], next_opponent=cfg.get("next_opponent")),
        us=our_team(cfg, G, heroes), heroes=heroes, maps=maps, teams=teams, map_stats=map_stats(G, heroes), map_bans=map_ban_habits(db),
        our_map_hero={m: dict(v) for m, v in our_map_hero.items()}, rules=rules, h2h=h2h, combos=combos, comps=comps)
    data["league"] = build_league(cfg, data["us"], heroes)
    # sanity: every hero named in rules must exist
    for r in rules["rules"]:
        for h in list(r.get("heroes", {})):
            if h not in heroes:
                raise SystemExit(f"rules.json rule {r['id']}: unknown hero {h!r}")
    (PB / "data.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    lib = build_library.build_library(heroes, canon, db, kdb, G)
    (PB / "library.json").write_text(json.dumps(lib, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    for prob in lib["build_code_problems"]:
        print("build code problem:", prob)
    for n, t in teams.items():
        if n != cfg["team"]:
            (OUT_FACTS / "teams" / f"{slug_text(n)}.md").write_text(team_sheet(t, data, cfg["team"]), encoding="utf-8")
    for n, m in maps.items():
        (OUT_FACTS / "maps" / f"{slug_text(n)}.md").write_text(map_sheet(m, data), encoding="utf-8")
    frag = build_tool(data, lib)
    (ROOT / "draft_tool_artifact.html").write_text(frag, encoding="utf-8")   # page fragment: the Artifact publisher adds the document skeleton
    page = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>'
            + frag + "</body></html>")
    (ROOT / "draft_tool.html").write_text(page, encoding="utf-8")           # same page as a stand alone file for any browser
    print(f"data.json {(PB / 'data.json').stat().st_size // 1024} KB, {len(teams)} teams, {len(maps)} maps, draft_tool.html {len(page) // 1024} KB")


def build_tool(data, lib):
    tpl = (PB / "app.html").read_text(encoding="utf-8") if (PB / "app.html").exists() else "<!--ENGINE--><!--DATA-->"
    engine = (PB / "engine.js").read_text(encoding="utf-8") if (PB / "engine.js").exists() else ""
    blob = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    libblob = json.dumps(lib, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    return tpl.replace("/*ENGINE*/", engine).replace("/*DATA*/", "window.PLAYBOOK=" + blob + ";").replace("/*LIB*/", "window.LIBRARY=" + libblob + ";")


if __name__ == "__main__":
    main()
