"""Merge knowledge/ngs_league.db and knowledge/heroeslounge.db into one compact game list for the Meta Lab artifact:
knowledge/expert/league_games.json. Hero names are matched to knowledge/expert/hero_matrix_draft.json.
Row: [league, season, division, map, winner(0/1), first_pick(0/1/null), length_sec, team0, team1, picks0, picks1, bans0, bans1, date, lvl10_lead0]
Run: python -I build_league_export.py"""
import json, pathlib, sqlite3, collections

HERE = pathlib.Path(__file__).resolve().parent
K = HERE / "knowledge"
HEROES = list(json.load(open(K / "expert" / "hero_matrix_draft.json", encoding="utf-8"))["heroes"])
norm = lambda x: "".join(ch for ch in x.lower() if ch.isalnum())
LOOKUP = {norm(h): h for h in HEROES}
LOOKUP.update({"lucio": LOOKUP.get("lcio", "Lúcio"), "chogall": "Cho", "cho": "Cho", "gall": "Gall", "lostvikings": "The Lost Vikings",
               "thelostvikings": "The Lost Vikings", "dva": "D.Va", "etc": "E.T.C.",
               "necr": "Xul", "butc": "The Butcher"})   # four letter ban codes from older export seasons
unmatched = collections.Counter()

def hn(x):
    if not x:
        return None
    h = LOOKUP.get(norm(x))
    if not h:
        unmatched[x] += 1
        return x
    return h

def main():
    rows = []
    if (K / "ngs_league.db").exists():
        c = sqlite3.connect(K / "ngs_league.db")
        tl = {}
        try:
            for t in c.execute("select game_id,first_td_team,xp_lead_5,xp_lead_10,xp_lead_15,first_struct_team,first_camp_team,level_adv_pct0,level_adv_pct1,avg_alive0,avg_alive1,merc_uptime0,merc_uptime1 from lg_timeline"):
                tl[t[0]] = t
        except sqlite3.OperationalError:
            pass   # an older database without the timeline table
        fo = {}
        for t in c.execute("select game_id,first_objective,first_fort,first_keep from lg_games"):
            fo[t[0]] = t
        for g in c.execute("select game_id,league,season,division,date,map,length_sec,team0,team1,winner,first_pick,time_to10_0,time_to10_1 from lg_games"):
            gid = g[0]
            picks = {0: [], 1: []}
            for t, h in c.execute("select team,hero from lg_picks where game_id=? order by team,pick_no", (gid,)):
                picks[t].append(hn(h))
            bans = {0: [], 1: []}
            for t, h, raw in c.execute("select team,hero,hero_raw from lg_bans where game_id=? order by team,ban_no", (gid,)):
                bans[t].append(hn(h or raw))
            lead = None if g[11] is None or g[12] is None else round(g[12] - g[11])  # seconds team0 reached level 10 earlier
            row = [g[1], g[2], g[3], g[5], g[9], g[10], round(g[6]), g[7], g[8], picks[0], picks[1], bans[0], bans[1], g[4], lead]
            t = tl.get(gid)
            # 15 first takedown team, 16 to 18 experience lead of team 0 at 5, 10, 15 minutes, 19 first structure down by,
            # 20 first camp, 21 first objective, 22 first fort, 23 first keep, 24 more heroes alive (team 0 minus team 1),
            # 25 more merc uptime, 26 more time ahead in level
            if t:
                diff = lambda a, b: None if a is None or b is None else round(a - b, 3)
                row += [t[1], None if t[2] is None else round(t[2]), None if t[3] is None else round(t[3]), None if t[4] is None else round(t[4]),
                        t[5], t[6], fo[gid][1], fo[gid][2], fo[gid][3], diff(t[9], t[10]), diff(t[11], t[12]), diff(t[7], t[8])]
            rows.append(row)
    if (K / "heroeslounge.db").exists():
        c = sqlite3.connect(K / "heroeslounge.db")
        for g in c.execute("select game_id,season,division,played,map,duration_sec,team_l,team_r,winner from hl_games"):
            gid = g[0]
            picks = {"L": [], "R": []}
            for s, h in c.execute("select side,hero from hl_picks where game_id=? order by side,pick_no", (gid,)):
                picks[s].append(hn(h))
            bans = {"L": [], "R": []}
            for s, h in c.execute("select side,hero from hl_bans where game_id=? order by side,ban_no", (gid,)):
                bans[s].append(hn(h))
            rows.append(["HL", g[1], f"EU Div {g[2]}", g[4], 0 if g[8] == "L" else 1, None, g[5], g[6], g[7], picks["L"], picks["R"],
                         bans["L"], bans["R"], g[3], None])
    # Add the NGS games we hold from the Heroes Profile match pages that the replay export does not have yet
    # (the export is a snapshot; the match pages are pulled more often). Matched on season, date, teams and map.
    have = set()
    for r in rows:
        if r[0] == "NGS":
            have.add((r[1], str(r[13])[:10], frozenset((r[7], r[8])), r[3]))
    added = collections.Counter()
    for dbname in ("ngs_season.db", "ngs_season21.db"):
        path = K / dbname
        if not path.exists():
            continue
        c = sqlite3.connect(path)
        for rid, date, mp, ln, t0, t1, win, fp, div, season in c.execute(
                "select replay_id,date_utc,map,length_sec,team0,team1,winner,first_pick_team,division,season from ngs_game"):
            key = (season, str(date)[:10], frozenset((t0, t1)), mp)
            if key in have or win not in (t0, t1):
                continue
            picks = {t0: [], t1: []}
            for t, h in c.execute("select team,hero from ngs_pick where replay_id=? order by slot", (rid,)):
                if t in picks:
                    picks[t].append(hn(h))
            bans = {t0: [], t1: []}
            for t, h in c.execute("select team,hero from ngs_hero_ban where replay_id=? order by slot", (rid,)):
                if t in bans and h and h != "No Pick":
                    bans[t].append(hn(h))
            # a swapped pick appears twice in the draft order; keep the heroes each team actually played
            final = {t0: set(), t1: set()}
            for t, h in c.execute("select team,hero from ngs_player_game where replay_id=?", (rid,)):
                if t in final:
                    final[t].add(hn(h))
            for t in (t0, t1):
                if len(picks[t]) != 5 and final[t]:
                    picks[t] = [h for h in picks[t] if h in final[t]]
            if len(picks[t0]) != 5 or len(picks[t1]) != 5:
                continue
            rows.append(["NGS", season, div, mp, 0 if win == t0 else 1, 0 if fp == t0 else (1 if fp == t1 else None), ln, t0, t1,
                         picks[t0], picks[t1], bans[t0], bans[t1], str(date)[:10], None])
            have.add(key)
            added[season] += 1
    print("added from Heroes Profile match pages:", dict(added))
    out = K / "expert" / "league_games.json"
    out.write_text(json.dumps(rows, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print("games", len(rows), "bytes", out.stat().st_size, "unmatched hero names", dict(unmatched))
    print(collections.Counter((r[0], r[1]) for r in rows))

if __name__ == "__main__":
    main()
