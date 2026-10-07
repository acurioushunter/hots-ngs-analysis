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
    for path in glob.glob(str(KN / "raw" / "ngs" / "matches" / "*.json")):
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
    ROLE_MAP = {"healer": "Healer", "tank": "Tank", "bruiser": "Bruiser", "support": "Support", "melee-assassin": "Melee Assassin", "ranged-assassin": "Ranged Assassin"}
    for h, d in heroes.items():
        s = seen.get(h)
        d["role"] = (s["role"] if s else ROLE_MAP.get(d["iv_role"], "Unknown"))
        hp_ranged = (s["type"] == "Ranged") if s else (d["iv_role"] == "ranged-assassin")
        d["hp_ranged"] = hp_ranged
        d["ranged"] = (hp_ranged or h in ranged_extra) and h not in not_ranged
        d["marksman"] = h in marksmen
    for slug, kind, other in kdb.execute("SELECT slug, kind, other_slug FROM matchup"):
        a = canon.get(norm(slug)); b = canon.get(norm(other))
        if not a or not b:
            continue
        # IV semantics: the heroes listed under a hero's counter list are the ones that counter it
        (heroes[a]["counters"] if kind == "counter" else heroes[a]["synergies"]).append(b)
    return heroes, canon, kdb


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
    cols = ["replay_id", "date_utc", "map", "length_sec", "team0", "team1", "winner", "first_pick_team", "map_pick_team", "series"]
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
             bans_r1={}, bans_r2={}, bans_vs_us={}, bans_r2_vs_us={}, bans_games_vs_us=0, picks_by_slot={}, hero_picks={}, players={}, faced={}, vs_healer={}, h2h=[])
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
        lines += ["", f"**Against {us_name}:** " + ", ".join(f"{h['map']} {'W' if h['won'] else 'L'}" for h in t["h2h"])]
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
        lines += ["", f"**Ranged heroes** (Blaze not counted): winners average {st['win_ranged_avg']}, losers {st['loss_ranged_avg']}. Three or more ranged {pct(r['3+'])}, two or fewer {pct(r['2-'])}.",
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
    names = sorted({g["team0"] for g in G.values()} | {g["team1"] for g in G.values()})
    map_names = sorted({g["map"] for g in G.values()})
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
        our_map_hero={m: dict(v) for m, v in our_map_hero.items()}, rules=rules)
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
