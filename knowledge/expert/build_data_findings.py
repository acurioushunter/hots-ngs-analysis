"""Builds data_findings.json/.md from ngs_div.db (read only). Run from repo root."""
import sqlite3, json, sys
from collections import Counter, defaultdict
sys.path.insert(0, ".")
from comps import classify
from hero_tags import HEROES

db = sqlite3.connect("file:knowledge/ngs_div.db?mode=ro", uri=True)
G = {r[0]: dict(zip(("id", "date", "round", "game", "map", "len", "w", "l", "fp", "series"), r)) for r in db.execute(
    "select replay_id,date_utc,round,game,map,length_sec,winner,loser,first_pick_team,series from ngs_game")}
comp = defaultdict(lambda: defaultdict(list))
for gid, team, hero in db.execute("select replay_id,team,hero from ngs_player_game"):
    comp[gid][team].append(hero)
picks = defaultdict(list)
bans = defaultdict(list)
for gid, t, s, h in db.execute("select replay_id,team,slot,hero from ngs_pick order by replay_id,slot"):
    picks[gid].append((t, s, h))
for gid, t, s, h in db.execute("select replay_id,team,slot,hero from ngs_hero_ban order by replay_id,slot"):
    bans[gid].append((t, s, h))


def rec(w, n):
    return {"w": w, "l": n - w, "n": n, "wr": round(100 * w / n) if n else None, "low_n": n < 8}


def R(lst):
    return rec(sum(lst), len(lst))


N = len(G)
rows = []  # (gid, team, opp, won, map, arch, heroes)
for gid, g in G.items():
    for t in comp[gid]:
        o = g["l"] if t == g["w"] else g["w"]
        rows.append((gid, t, o, int(t == g["w"]), g["map"], classify(comp[gid][t]), comp[gid][t]))
out = {"games": N, "method": ""}

maps = defaultdict(list)
for r in rows:
    maps[r[4]].append(r)
out["per_map"] = {}
for m, rs in sorted(maps.items()):
    by = defaultdict(list)
    wc = Counter()
    for r in rs:
        by[r[5]].append(r[3])
        if r[3]:
            wc[tuple(sorted(r[6]))] += 1
    top = [{"comp": list(c), "wins": k} for c, k in wc.most_common(3) if k > 1]
    out["per_map"][m] = {"games": len(rs) // 2, "archetype_wr": {a: R(v) for a, v in sorted(by.items())},
                         "winning_comps_repeated": top}

mu = defaultdict(list)
byid = defaultdict(dict)
for r in rows:
    byid[r[0]][r[1]] = r
for gid, d in byid.items():
    for t, r in d.items():
        mu[(r[5], d[r[2]][5])].append(r[3])
out["archetype_matchups"] = [{"ours": a, "theirs": b, **R(v)} for (a, b), v in sorted(mu.items())]
out["archetype_overall"] = {a: R([r[3] for r in rows if r[5] == a]) for a in sorted({r[5] for r in rows})}

pk = defaultdict(list)
for r in rows:
    for h in r[6]:
        pk[h].append(r[3])
bn = Counter()
bn_by = defaultdict(Counter)
for gid, bl in bans.items():
    for t, s, h in bl:
        bn[h] += 1
        bn_by[h][t] += 1
heroes = {h: {"picks": len(v), "pick_rate_pct": round(100 * len(v) / N), **R(v), "bans": bn.get(h, 0)} for h, v in pk.items()}
for h in bn:
    heroes.setdefault(h, {"picks": 0, "bans": bn[h]})
out["heroes"] = heroes
out["top_banned"] = [{"hero": h, "bans": c, "ban_rate_pct": round(100 * c / N), "picked": len(pk.get(h, [])),
                      "pick_wr": (R(pk[h])["wr"] if h in pk else None), "top_banners": bn_by[h].most_common(2)}
                     for h, c in bn.most_common(15)]
out["most_picked"] = [{"hero": h, **heroes[h]} for h in sorted(pk, key=lambda x: -len(pk[x]))[:15]]

TEAMS = ["Can't Counterpick Stupid", "COSMOS", "Good Lordy", "Phoenix Rising Amethyst"]
out["teams"] = {}
for T in TEAMS:
    mine = [r for r in rows if r[1] == T]
    mp = defaultdict(list)
    ar = defaultdict(list)
    hr = defaultdict(list)
    vs = defaultdict(list)
    for r in mine:
        mp[r[4]].append(r[3])
        ar[r[5]].append(r[3])
        vs[r[2]].append(r[3])
        for h in r[6]:
            hr[h].append(r[3])
    fp_res = [r[3] for r in mine if G[r[0]]["fp"] == T]
    sp_res = [r[3] for r in mine if G[r[0]]["fp"] != T]
    fpick = Counter()
    spick = Counter()
    fban = Counter()
    allban = Counter()
    for r in mine:
        for t, s, h in picks[r[0]]:
            if t == T and s == 5:
                fpick[h] += 1
            if t == T and s == 6:
                spick[h] += 1
        for t, s, h in bans[r[0]]:
            if t == T:
                allban[h] += 1
                if s in (1, 2):
                    fban[h] += 1
    losses = [{"game": r[0], "vs": r[2], "map": r[4], "our_arch": r[5], "their_arch": byid[r[0]][r[2]][5],
               "our_comp": r[6], "their_comp": byid[r[0]][r[2]][6]} for r in mine if not r[3]]
    out["teams"][T] = {"record": R([r[3] for r in mine]), "maps": {m: R(v) for m, v in sorted(mp.items())},
                       "archetypes": {a: R(v) for a, v in sorted(ar.items())},
                       "vs_opponent": {o: R(v) for o, v in sorted(vs.items())},
                       "first_pick_team_record": R(fp_res), "second_pick_team_record": R(sp_res),
                       "signature_heroes": [{"hero": h, "games": len(v), "w": sum(v), "l": len(v) - sum(v)}
                                            for h, v in sorted(hr.items(), key=lambda x: -len(x[1]))[:8]],
                       "first_pick_hero_when_first": fpick.most_common(5),
                       "slot6_pick_when_second": spick.most_common(5),
                       "own_bans_slots_1_2": fban.most_common(6), "ban_counts": allban.most_common(8),
                       "losses": losses}

sl = {}
for slot, label in ((5, "slot 5 first team pick 1"), (6, "slot 6 second team pick 1"),
                    (7, "slot 7 second team pick 2"), (8, "slot 8 first team pick 2")):
    c = Counter()
    w = defaultdict(list)
    for gid in G:
        for t, s, h in picks[gid]:
            if s == slot:
                c[h] += 1
                w[h].append(int(t == G[gid]["w"]))
    sl[label] = [{"hero": h, "n": k, "wr": R(w[h])["wr"]} for h, k in c.most_common(6)]
out["pick_slots"] = sl
out["ban_slots"] = {str(slot): Counter(h for gid in G for t, s, h in bans[gid] if s == slot).most_common(4)
                    for slot in (1, 2, 3, 4, 10, 11)}
out["first_pick_team_win"] = R([int(G[g]["fp"] == G[g]["w"]) for g in G])
out["role_first_pick"] = dict(Counter(HEROES[h][0] for gid in G for t, s, h in picks[gid] if s == 5))
out["role_picks_6_7"] = dict(Counter(HEROES[h][0] for gid in G for t, s, h in picks[gid] if s in (6, 7)))
bp = Counter()
bo = Counter()
for gid in G:
    for t, s, h in bans[gid]:
        for t2, s2, h2 in picks[gid]:
            if s2 in (5, 6, 7):
                (bp if t2 == t else bo)[(h, h2)] += 1
out["ban_then_own_early_pick"] = [{"ban": a, "pick": b, "n": k} for (a, b), k in bp.most_common(6) if k >= 3]
out["ban_then_enemy_early_pick"] = [{"ban": a, "enemy_pick": b, "n": k} for (a, b), k in bo.most_common(6) if k >= 4]
out["data_notes"] = [
    "Game 23009 has a 6th PRA pick (slot 16) and a slot 17 Good Lordy pick; comps use ngs_player_game (10 players per game).",
    "One game has no slot 3 ban.",
    "Ban then pick pairs are co-occurrence in the same game; the data does not show one caused the other.",
    "Six Good Lordy games are not on Heroes Profile, so their record is partial."]
out["method"] = ("Archetype = comps.classify() on ngs_player_game heroes using hero_tags.HEROES. Primary tag scores 2 and secondary 1, "
                 "summed into Poke/siege (poke), Dive/engage (dive, engage), Brawl/sustain (brawl, sustain). The leading group names the comp; "
                 "if the top two groups are within 1 point it is Balanced. push and burst tags score nothing. "
                 "Chen, Murky, Probius, Samuro, Sgt. Hammer and Zeratul are untagged but were only banned, never picked.")
json.dump(out, open("knowledge/expert/data_findings.json", "w"), indent=1)


def f(x):
    return f"{x['w']}-{x['l']} ({x['wr']}%, n={x['n']}{', LOW' if x['low_n'] else ''})"


L = []
a = L.append
a(f"# Data findings, Division C West S22 ({N} games)")
a("")
a("Method: " + out["method"])
a("Sample is tiny, read every number as a lean. LOW means n under 8. Each game counts once per side, so matchup rows are mirrored.")
a("")
a("## Archetype overall")
for k, v in out["archetype_overall"].items():
    a(f"- {k}: {f(v)}")
a(f"- First pick team won {f(out['first_pick_team_win'])}")
a("")
a("## Per map (archetype record, one row per side)")
for m, d in out["per_map"].items():
    rep = d["winning_comps_repeated"]
    a(f"- {m} ({d['games']} games): " + "; ".join(f"{k} {v['w']}-{v['l']}" for k, v in d["archetype_wr"].items())
      + ("; repeat winners: " + "; ".join(f"{', '.join(c['comp'])} x{c['wins']}" for c in rep) if rep
         else "; no winning comp repeated exactly"))
a("")
a("## Archetype matchups (ours vs theirs)")
for r in out["archetype_matchups"]:
    a(f"- {r['ours']} vs {r['theirs']}: {f(r)}")
a("")
a("## Top 15 banned")
for r in out["top_banned"]:
    a(f"- {r['hero']}: {r['bans']} bans ({r['ban_rate_pct']}%), picked {r['picked']}x"
      + (f" at {r['pick_wr']}% wins" if r["pick_wr"] is not None else "")
      + "; banned most by " + ", ".join(t for t, _ in r["top_banners"]))
a("")
a("## Most picked")
for r in out["most_picked"]:
    a(f"- {r['hero']}: {r['picks']} picks ({r['pick_rate_pct']}%), {r['w']}-{r['l']}, {r['bans']} bans")
a("")
a("## Teams")
for T, d in out["teams"].items():
    a(f"### {T}: {f(d['record'])}")
    a("- Maps: " + "; ".join(f"{m} {v['w']}-{v['l']}" for m, v in d["maps"].items()))
    a("- Archetypes: " + "; ".join(f"{m} {v['w']}-{v['l']}" for m, v in d["archetypes"].items()))
    a(f"- With first pick {d['first_pick_team_record']['w']}-{d['first_pick_team_record']['l']}, "
      f"without {d['second_pick_team_record']['w']}-{d['second_pick_team_record']['l']}")
    a("- Signature heroes: " + ", ".join(f"{h['hero']} {h['games']}g {h['w']}-{h['l']}" for h in d["signature_heroes"]))
    a("- Slot 5 pick when first: " + ", ".join(f"{h} x{k}" for h, k in d["first_pick_hero_when_first"])
      + " | slot 6 when second: " + ", ".join(f"{h} x{k}" for h, k in d["slot6_pick_when_second"]))
    a("- Own bans in slots 1 and 2: " + ", ".join(f"{h} x{k}" for h, k in d["own_bans_slots_1_2"]))
    a("- Losses: " + " | ".join(f"{l['map']} vs {l['vs']} ({l['our_arch']} v {l['their_arch']})" for l in d["losses"]))
a("")
a("## Draft slots")
for k, v in out["pick_slots"].items():
    a(f"- {k}: " + ", ".join(f"{x['hero']} {x['n']} ({x['wr']}% wins)" for x in v))
for k, v in out["ban_slots"].items():
    a(f"- Ban slot {k}: " + ", ".join(f"{h} {c}" for h, c in v))
a(f"- Roles of slot 5: {out['role_first_pick']}; roles of slots 6 and 7: {out['role_picks_6_7']}")
a("- Ban then own early pick (n>=3): " + "; ".join(f"{x['ban']} then {x['pick']} x{x['n']}" for x in out["ban_then_own_early_pick"]))
a("- Ban then enemy early pick (n>=4): " + "; ".join(f"{x['ban']} then {x['enemy_pick']} x{x['n']}" for x in out["ban_then_enemy_early_pick"]))
a("")
a("Data notes: " + " ".join(out["data_notes"]))
open("knowledge/expert/data_findings.md", "w", encoding="utf-8").write("\n".join(L) + "\n")
