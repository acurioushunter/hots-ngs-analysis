"""CCS draft habits for the series plan: toss and loser choices, map bans and picks,
hero bans by slot and situation, first picks, round two bans against what is still open,
and how their bans land on our two damage players.

Season 22 comes from knowledge/ngs_div_plus.db (Heroes Profile pages plus the Oct 14
export games, which carry no map pick or map ban). Older CCS seasons (16 to 20) and
ShadowDroid and ultear's Season 21 come from knowledge/ngs_league.db (replay export:
draft order and first pick, no map choices).

Run: python -I analyze_ccs_draft_habits.py  (prints every table used in CCS_DRAFT_PLAN.md)
"""
import sqlite3
from collections import Counter, defaultdict

DIV = "knowledge/ngs_div_plus.db"
LG = "knowledge/ngs_league.db"
CCS = "Can't Counterpick Stupid"
PRA = "Phoenix Rising Amethyst"

# Hero sets for the damage squeeze. Pools follow playbook/config/our_team.json.
HUNTER = ["Sylvanas", "Junkrat", "Orphea", "Chromie", "Cassia", "Valla", "Mephisto", "Tychus", "Raynor", "Greymane"]
CHELSI = ["Tychus", "Thrall", "Chromie", "Tassadar", "Gul'dan", "Sylvanas", "Azmodan", "Orphea", "Jaina", "Chen"]


def short(t):
    return {CCS: "CCS", PRA: "PRA"}.get(t, t)


def slot_side(slot, fp):
    """Return True when the slot belongs to the first pick team."""
    return slot in (1, 3, 5, 8, 9, 11, 14, 15)


def load_s22():
    c = sqlite3.connect(DIV)
    games = []
    for r in c.execute("select replay_id,date_utc,round,game,map,team0,team1,winner,first_pick_team,map_pick_team,series,length_sec "
                       "from ngs_game where team0=? or team1=? order by date_utc, game", (CCS, CCS)):
        rid, date, rnd, gno, mp, t0, t1, win, fp, mpick, series, ln = r
        opp = t1 if t0 == CCS else t0
        bans = c.execute("select team,slot,hero from ngs_hero_ban where replay_id=? order by slot", (rid,)).fetchall()
        picks = c.execute("select team,slot,hero from ngs_pick where replay_id=? order by slot", (rid,)).fetchall()
        players = c.execute("select team,battletag,hero,deaths,won from ngs_player_game where replay_id=?", (rid,)).fetchall()
        games.append(dict(rid=rid, date=date[:10], rnd=rnd, gno=gno, map=mp, opp=opp, won=(win == CCS), fp=fp, mpick=mpick,
                          series=series, len=ln, bans=bans, picks=picks, players=players))
    mapbans = c.execute("select series,round,team,ban_no,map from ngs_map_ban").fetchall()
    return games, mapbans


def pct(w, n):
    return f"{w}-{n - w}" + (f" ({100 * w / n:.0f}%)" if n else "")


def section(t):
    print()
    print("=" * 8, t)


def main():
    games, mapbans = load_s22()
    section(f"Season 22 CCS games: {len(games)} ({sum(g['won'] for g in games)}-{sum(not g['won'] for g in games)}), newest {games[-1]['date']}")

    # 1. Series, toss and loser choices
    section("1. Series order: who had map pick and first pick, and the choice of the team that lost the game before")
    by_series = defaultdict(list)
    for g in games:
        by_series[g["series"]].append(g)
    loser_choice = Counter()  # (team, choice)
    g1_ccs = Counter()
    for s, gs in by_series.items():
        gs.sort(key=lambda g: (g["gno"] or 0, g["date"]))
        print(f"  {s}")
        for i, g in enumerate(gs):
            chooser = ""
            if i > 0 and g["mpick"]:
                prev = gs[i - 1]
                prev_loser = prev["opp"] if prev["won"] else CCS
                took = "first pick" if g["fp"] == prev_loser else "map"
                chooser = f"   loser of game {i} ({short(prev_loser)}) took {took}"
                loser_choice[(short(prev_loser) if prev_loser == CCS else "opp", took)] += 1
            elif i == 0 and g["mpick"]:
                g1_ccs["CCS map" if g["mpick"] == CCS else "CCS first pick"] += 1
            print(f"    g{g['gno'] or '?'} {g['map']:<26} {'W' if g['won'] else 'L'}  FP {short(g['fp']):<14} map {short(g['mpick']) if g['mpick'] else '?':<14}{chooser}")
    print("  CCS choice after losing a game:", {k[1]: v for k, v in loser_choice.items() if k[0] == "CCS"})
    print("  Opponents' choice after losing to CCS:", {k[1]: v for k, v in loser_choice.items() if k[0] == "opp"})
    print("  Game 1 (toss) outcomes:", dict(g1_ccs))

    fp = [g for g in games if g["fp"] == CCS]
    sp = [g for g in games if g["fp"] != CCS]
    print(f"  CCS with first pick {pct(sum(g['won'] for g in fp), len(fp))}, without {pct(sum(g['won'] for g in sp), len(sp))}")
    mp = [g for g in games if g["mpick"] == CCS]
    op = [g for g in games if g["mpick"] and g["mpick"] != CCS]
    print(f"  CCS picked the map {pct(sum(g['won'] for g in mp), len(mp))}, opponent picked {pct(sum(g['won'] for g in op), len(op))}")

    # 2. Map bans and picks
    section("2. Map bans (series with CCS)")
    ccs_series = set(by_series)
    ccs_mb = Counter()
    ccs_mb_first = Counter()
    opp_mb = Counter()
    for s, rnd, team, no, m in mapbans:
        if s not in ccs_series:
            continue
        if team == CCS:
            ccs_mb[m] += 1
            if no == 1:
                ccs_mb_first[m] += 1
        else:
            opp_mb[m] += 1
    for s in sorted(ccs_series):
        rows = sorted([r for r in mapbans if r[0] == s], key=lambda r: (r[2] != CCS, r[3]))
        if rows:
            print(f"  {s}: CCS bans {[r[4] for r in rows if r[2] == CCS]}, opponent bans {[r[4] for r in rows if r[2] != CCS]}")
    print("  CCS map bans:", ccs_mb.most_common(), " first ban:", ccs_mb_first.most_common())
    print("  Opponents' map bans against CCS:", opp_mb.most_common())
    section("2b. Maps CCS picked, and maps picked against them")
    cp = Counter()
    for g in mp:
        cp[(g["map"], g["won"])] += 1
    for g in mp:
        pass
    for m in sorted({g["map"] for g in mp}):
        print(f"  CCS pick {m:<26} {cp[(m, True)]}-{cp[(m, False)]}")
    for m in sorted({g["map"] for g in op}):
        w = sum(1 for g in op if g["map"] == m and g["won"])
        n = sum(1 for g in op if g["map"] == m)
        print(f"  opponent pick {m:<22} CCS {w}-{n - w}  by {sorted({short(g['opp']) for g in op if g['map'] == m})}")
    print("  Map pick order by game number (CCS picks only):",
          [(g["gno"], g["map"], short(g["opp"])) for g in mp])
    allm = Counter((g["map"], g["won"]) for g in games)
    print("  CCS by map, all games:", {m: f"{allm[(m, True)]}-{allm[(m, False)]}" for m in sorted({g['map'] for g in games})})

    # 3. Hero bans by slot and situation
    section("3. CCS hero bans by phase, first pick v second pick, v PRA v others")
    for label, cond in [("all", lambda g: True), ("v PRA", lambda g: g["opp"] == PRA), ("v others", lambda g: g["opp"] != PRA)]:
        r1, r2 = Counter(), Counter()
        n = 0
        for g in games:
            if not cond(g):
                continue
            n += 1
            for team, slot, hero in g["bans"]:
                if team != CCS:
                    continue
                (r1 if slot <= 4 else r2)[hero] += 1
        print(f"  {label} ({n} games) round one: {r1.most_common(12)}")
        print(f"  {label} ({n} games) round two: {r2.most_common(10)}")
    for label, sel in [("CCS first pick (bans 1,3,11)", fp), ("CCS second pick (bans 2,4,10)", sp)]:
        ordered = Counter()
        for g in sel:
            for team, slot, hero in g["bans"]:
                if team == CCS:
                    ordered[(slot, hero)] += 1
        print(f"  {label}: " + ", ".join(f"s{s} {h} x{v}" for (s, h), v in sorted(ordered.items())))

    section("3b. Every CCS ban against PRA, and whether it hit Hunter or chelsi")
    for g in games:
        if g["opp"] != PRA:
            continue
        ccsb = [(s, h) for t, s, h in g["bans"] if t == CCS]
        prab = [(s, h) for t, s, h in g["bans"] if t == PRA]
        tag = lambda h: ("H" if h in HUNTER else "") + ("C" if h in CHELSI else "")
        print(f"  {g['date']} {g['map']:<22} {'W' if g['won'] else 'L'} CCS {'FP' if g['fp'] == CCS else 'SP'}: CCS bans "
              + ", ".join(f"s{s} {h}[{tag(h)}]" for s, h in ccsb) + "  | PRA bans " + ", ".join(f"s{s} {h}" for s, h in prab))

    # Round two ban v what was still open
    section("3c. CCS round two ban against PRA: what of chelsi's top two was already picked or banned")
    for g in games:
        if g["opp"] != PRA:
            continue
        r2 = [(s, h) for t, s, h in g["bans"] if t == CCS and s >= 10]
        before = {h for t, s, h in g["picks"] if s < r2[0][0]} | {h for t, s, h in g["bans"] if s < r2[0][0]}
        pra_picked = [(s, h) for t, s, h in g["picks"] if t == PRA and s < r2[0][0]]
        print(f"  {g['map']:<22} ban s{r2[0][0]} {r2[0][1]:<10} PRA had picked {pra_picked}; Thrall open {'Thrall' not in before}, Tychus open {'Tychus' not in before}")

    section("3d. After a CCS loss: how many of the winning team's heroes CCS banned in the next game")
    for s, gs in by_series.items():
        for i, g in enumerate(gs[:-1]):
            if g["won"]:
                continue
            nxt = gs[i + 1]
            winners = [h for t, sl, h in g["picks"] if t != CCS]
            nb = [h for t, sl, h in nxt["bans"] if t == CCS]
            hit = [h for h in nb if h in winners]
            print(f"  {short(g['opp']):<12} beat CCS on {g['map']:<22} with {winners}; next game CCS banned {nb}: {len(hit)} of 3 from that comp {hit}")
    for hero in ("Brightwing", "Anduin", "Muradin", "Sylvanas", "Orphea"):
        hits = [(short(g["opp"]), g["map"], s) for g in games for t, s, h in g["bans"] if t == CCS and h == hero]
        print(f"  CCS banned {hero}: {hits}")

    section("3e. CCS first turn when Johanna was banned before it")
    for g in games:
        first = (5,) if g["fp"] == CCS else (6, 7)
        if "Johanna" in {h for t, s, h in g["bans"] if s < first[0]}:
            print(f"  {short(g['opp']):<12} {g['map']:<26} CCS {'FP' if first == (5,) else 'SP'} took {[h for t, s, h in g['picks'] if t == CCS and s in first]}  {'W' if g['won'] else 'L'}")

    # 4. Picks
    section("4. CCS picks by phase (hero, player)")
    def who(g, hero):
        for t, tag_, h, d, w in g["players"]:
            if t == CCS and h == hero:
                return tag_
        return "?"
    for label, sel, phases in [("CCS first pick", fp, [(5,), (8, 9), (14, 15)]), ("CCS second pick", sp, [(6, 7), (12, 13), (16,)])]:
        print(f"  {label} ({len(sel)} games)")
        for ph in phases:
            cnt = Counter()
            for g in sel:
                for t, s, h in g["picks"]:
                    if t == CCS and s in ph:
                        cnt[f"{h} ({who(g, h)})"] += 1
            print(f"    slots {ph}: {cnt.most_common()}")
    section("4a. When Sylvanas or Tychus was open at CCS's first pick turn, did they take it?")
    for hero in ("Sylvanas", "Tychus", "Johanna"):
        for g in games:
            first = 5 if g["fp"] == CCS else 6
            gone = {hh for t, s, hh in g["bans"] if s < first} | {hh for t, s, hh in g["picks"] if s < first}
            if hero in gone:
                continue
            took = [s for t, s, hh in g["picks"] if t == CCS and hh == hero]
            first_turn = took and took[0] in ((5,) if first == 5 else (6, 7))
            print(f"  {hero:<9} open at their first turn: {short(g['opp']):<12} {g['map']:<26} CCS {'FP' if first == 5 else 'SP'}  "
                  f"{'took it at ' + str(took[0]) if took else 'did not take it'}{' (first turn)' if first_turn else ''}")
    section("4b. Every CCS draft in order (picks), with result")
    for g in games:
        seq = " ".join(f"{s}:{h}" + ("*" if t == CCS else "") for t, s, h in g["picks"])
        print(f"  {g['date']} {short(g['opp']):<12} {g['map']:<22} {'W' if g['won'] else 'L'} {'FP' if g['fp'] == CCS else 'SP'}  {seq}")

    # 5. Players
    section("5. CCS players, Season 22 hero records (deaths a game)")
    rec = defaultdict(lambda: defaultdict(lambda: [0, 0, 0]))
    for g in games:
        for t, tag_, h, d, w in g["players"]:
            if t == CCS:
                rec[tag_][h][0] += 1
                rec[tag_][h][1] += w
                rec[tag_][h][2] += d or 0
    for p, hs in rec.items():
        tot = sum(v[0] for v in hs.values())
        line = ", ".join(f"{h} {v[1]}-{v[0] - v[1]} ({v[2] / v[0]:.1f})" for h, v in sorted(hs.items(), key=lambda x: -x[1][0]))
        print(f"  {p} ({tot}): {line}")

    # 6. Bans against CCS and their record
    section("6. What opponents banned against CCS, CCS record when that hero was banned")
    ob = defaultdict(lambda: [0, 0])
    for g in games:
        for t, s, h in g["bans"]:
            if t != CCS:
                ob[h][0] += 1
                ob[h][1] += g["won"]
    for h, (n, w) in sorted(ob.items(), key=lambda x: -x[1][0]):
        if n >= 2:
            print(f"  {h:<14} banned {n}, CCS {w}-{n - w}")

    section("6b. CCS record by the opponent's healer (Brightwing or Anduin against the rest)")
    k = sqlite3.connect("knowledge/hots_knowledge.db")
    healers = {r[0] for r in k.execute("select name from hero where role='healer'")}
    mob = [0, 0]
    rest = [0, 0]
    for g in games:
        theirs = {h for t, s, h in g["picks"] if t != CCS and h in healers}
        bucket = mob if theirs & {"Brightwing", "Anduin"} else rest
        bucket[0] += 1
        bucket[1] += g["won"]
        if not g["won"]:
            print(f"  CCS loss: {short(g['opp'])} {g['map']} opponent healers {sorted(theirs)}")
    print(f"  CCS against Brightwing or Anduin teams {pct(mob[1], mob[0])}, against other healers {pct(rest[1], rest[0])}")

    section("6c. PRA bans against CCS, and whether a CCS player played that hero this season")
    played = Counter(h for g in games for t, tag_, h, d, w in g["players"] if t == CCS)
    ours = Counter(h for g in games if g["opp"] == PRA for t, s, h in g["bans"] if t == PRA)
    for h, n in ours.most_common():
        print(f"  {h:<12} banned {n}  CCS games on it this season: {played.get(h, 0)}")

    # 7. Our damage picks against CCS
    section("7. Hunter and chelsi against CCS: hero, slot, deaths")
    for g in games:
        if g["opp"] != PRA:
            continue
        slots = {h: s for t, s, h in g["picks"] if t == PRA}
        row = []
        for t, tag_, h, d, w in g["players"]:
            if t == PRA and tag_ in ("hunterstag", "chelsi"):
                row.append(f"{tag_} {h} (slot {slots.get(h)}, {d} deaths)")
        prapicks = [f"{s}:{h}" for t, s, h in g["picks"] if t == PRA]
        print(f"  {g['map']:<22} {'L' if g['won'] else 'W'} for PRA  {'; '.join(row)}   PRA order {prapicks}")

    # 8. Older CCS seasons from the replay export
    section("8. CCS seasons 16 to 20 and ShadowDroid/ultear Season 21 (replay export)")
    c = sqlite3.connect(LG)
    for season in (18, 20):
        rows = c.execute("select game_id, team0, team1, winner, first_pick, map from lg_games where season=? and (team0=? or team1=?)",
                         (season, CCS, CCS)).fetchall()
        b1, b2, firsts = Counter(), Counter(), Counter()
        fpw = [0, 0]
        spw = [0, 0]
        for gid, t0, t1, win, fpk, m in rows:
            side = 0 if t0 == CCS else 1
            won = win == side
            isfp = fpk == side
            (fpw if isfp else spw)[0] += 1
            (fpw if isfp else spw)[1] += won
            for no, h in c.execute("select ban_no, hero from lg_bans where game_id=? and team=? order by ban_no", (gid, side)):
                (b1 if no <= 2 else b2)[h] += 1
            pk = c.execute("select pick_no, hero from lg_picks where game_id=? and team=? order by pick_no", (gid, side)).fetchall()
            if pk:
                firsts[pk[0][1]] += 1
        print(f"  S{season}: {len(rows)} games; first pick {pct(fpw[1], fpw[0])}, second {pct(spw[1], spw[0])}")
        print(f"    their first two bans: {b1.most_common(8)}")
        print(f"    their third ban: {b2.most_common(6)}")
        print(f"    their first hero: {firsts.most_common(8)}")
    for name in ("UnicycleYay", "WitsEnd", "Valkamer", "ShadowDroid", "ltear"):
        for season in (20, 21):
            rows = c.execute("select p.hero, count(*), sum(case when g.winner=p.team then 1 else 0 end), avg(p.deaths) from lg_players p join lg_games g using(game_id) "
                             "where p.name like ? and g.season=? group by p.hero order by 2 desc limit 8", ("%" + name + "%", season)).fetchall()
            if rows:
                print(f"  {name} S{season}: " + ", ".join(f"{h} {w}-{n - w} ({d:.1f})" for h, n, w, d in rows))

    our_side()


def our_side():
    import datetime, glob, json, pathlib
    today = datetime.date.today()
    since = (today - datetime.timedelta(days=365)).isoformat()
    pool = sorted(set(HUNTER) | set(CHELSI))

    section(f"9. Hunter, Storm League since {since} (today {today}), pool heroes: record, deaths")
    h = sqlite3.connect("knowledge/hunter_hp.db")
    newest = h.execute("select max(date) from hp_game where game_type='sl'").fetchone()[0]
    print(f"  newest Storm League game on disk {newest}")
    for hero in pool:
        n, w, d = h.execute("select count(*), sum(won), avg(deaths) from hp_game where game_type='sl' and date>=? and hero=?", (since, hero)).fetchone()
        if n:
            print(f"  {hero:<10} {pct(w, n)}  {d:.1f} deaths")

    section("10. NGS records, Season 21 and 22 (Season 22 includes the Oct 14 export games)")
    for db, season in (("knowledge/ngs_season21.db", 21), (DIV, 22)):
        c = sqlite3.connect(db)
        for tag in ("hunterstag", "chelsi"):
            rows = c.execute("select hero, count(*), sum(won), avg(deaths) from ngs_player_game where battletag=? group by hero order by 2 desc", (tag,)).fetchall()
            print(f"  S{season} {tag}: " + ", ".join(f"{hh} {w}-{n - w} ({d:.1f})" for hh, n, w, d in rows))
    lg = sqlite3.connect(LG)
    rows = lg.execute("select p.hero, count(*), sum(case when g.winner=p.team then 1 else 0 end) from lg_players p join lg_games g using(game_id) "
                      "where p.name='chelsi' group by p.hero order by 2 desc limit 16").fetchall()
    print("  chelsi all NGS seasons in the export (15 to 22): " + ", ".join(f"{hh} {w}-{n - w}" for hh, n, w in rows))

    section("11. HealsOnly team games (chelsi on the shared account with Hunter): pairs of heroes")
    games = [json.loads(pathlib.Path(p).read_text(encoding="utf-8")) for p in sorted(glob.glob("knowledge/raw/healsonly/matches/*.json"))]
    pair = Counter()
    pairw = Counter()
    ho_hero = defaultdict(lambda: [0, 0])
    for g in games:
        me = next((p for p in g["players"] if p["tag"] == "hunterstag"), None)
        ho = next((p for p in g["players"] if p["tag"] == "HealsOnly"), None)
        if not me or not ho or me["team"] != ho["team"]:
            continue
        ho_hero[ho["hero"]][0] += 1
        ho_hero[ho["hero"]][1] += bool(me["won"])
        key = (me["hero"], ho["hero"])
        pair[key] += 1
        pairw[key] += bool(me["won"])
    print("  HealsOnly hero: " + ", ".join(f"{hh} {w}-{n - w}" for hh, (n, w) in sorted(ho_hero.items(), key=lambda x: -x[1][0])))
    print("  Hunter hero + HealsOnly hero (2+ games): " + ", ".join(f"{a}+{b} {pairw[(a, b)]}-{n - pairw[(a, b)]}" for (a, b), n in pair.most_common() if n >= 2))

    section("12. PRA Season 22 by map, by first pick or map pick")
    c = sqlite3.connect(DIV)
    rows = c.execute("select map, winner=?, first_pick_team=?, map_pick_team=? from ngs_game where team0=? or team1=?", (PRA, PRA, PRA, PRA, PRA)).fetchall()
    bymap = defaultdict(lambda: [0, 0])
    fpw = [0, 0]
    mpw = [0, 0]
    for m, won, isfp, ismp in rows:
        bymap[m][0] += 1
        bymap[m][1] += won
        if ismp is not None and ismp:
            mpw[0] += 1
            mpw[1] += won
        if isfp:
            fpw[0] += 1
            fpw[1] += won
    print(f"  PRA {pct(sum(v[1] for v in bymap.values()), len(rows))}; first pick {pct(fpw[1], fpw[0])}; picked the map {pct(mpw[1], mpw[0])}")
    print("  " + ", ".join(f"{m} {v[1]}-{v[0] - v[1]}" for m, v in sorted(bymap.items(), key=lambda x: -x[1][0])))
    mb = Counter(r[0] for r in c.execute("select map from ngs_map_ban where team=?", (PRA,)))
    print("  PRA map bans this season:", mb.most_common())
    print("  maps played this season (pool):", sorted({r[0] for r in c.execute("select map from ngs_game")}))

    section("13. PRA Season 22: our two damage players' heroes, the phase they were picked in, and the result")
    rows = c.execute("select replay_id, map, winner=?, first_pick_team=?, team0, team1 from ngs_game where team0=? or team1=? order by date_utc",
                     (PRA, PRA, PRA, PRA)).fetchall()
    combo = defaultdict(lambda: [0, 0])
    phase_c = Counter()
    for rid, m, won, isfp, t0, t1 in rows:
        opp = t1 if t0 == PRA else t0
        heroes = dict(c.execute("select battletag, hero from ngs_player_game where replay_id=? and team=?", (rid, PRA)).fetchall())
        slots = {hh: s for s, hh in c.execute("select slot, hero from ngs_pick where replay_id=? and team=?", (rid, PRA))}
        hh, ch = heroes.get("hunterstag"), heroes.get("chelsi")
        h_main = hh in ("Sylvanas", "Junkrat")
        c_main = ch in ("Tychus", "Thrall")
        key = ("Hunter main" if h_main else "Hunter off") + " / " + ("chelsi main" if c_main else "chelsi off")
        combo[key][0] += 1
        combo[key][1] += won
        cs = slots.get(ch)
        ph = "first phase" if cs in (5, 6, 7, 8, 9) else ("last phase" if cs else "?")
        phase_c[(ph, c_main, won)] += 1
        print(f"  {short(opp):<12} {m:<26} {'W' if won else 'L'} {'FP' if isfp else 'SP'}  Hunter {hh} (s{slots.get(hh)})  chelsi {ch} (s{cs})")
    for k, (n, w) in sorted(combo.items()):
        print(f"  {k}: {pct(w, n)}")
    for ph in ("first phase", "last phase"):
        n = sum(v for (p, cm, w), v in phase_c.items() if p == ph)
        w = sum(v for (p, cm, w), v in phase_c.items() if p == ph and w)
        print(f"  chelsi picked in the {ph}: {pct(w, n)}")


if __name__ == "__main__":
    main()
