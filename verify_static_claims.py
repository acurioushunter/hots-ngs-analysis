"""Re-check the hand written numbers in the Drafter against knowledge/ngs_div.db (CLAUDE.md rule 1).
The rules in playbook/config/rules.json and the notes in playbook/notes/teams/ carry records that were typed in on a date. This script
recomputes each from the games on disk and prints OK or CHANGED. Run it after new games are added: python -I verify_static_claims.py
Add a line to CLAIMS when a new number goes into a rule or a note.
"""
import collections, sqlite3, pathlib, sys

DB = pathlib.Path(__file__).resolve().parent / "knowledge" / "ngs_div_plus.db"   # match pages plus games filled in from the replay export (run build_playbook.py first)
PRA, CCS, COS = "Phoenix Rising Amethyst", "Can't Counterpick Stupid", "COSMOS"
c = sqlite3.connect(DB)
games = c.execute("SELECT replay_id, team0, team1, winner, first_pick_team, map_pick_team FROM ngs_game").fetchall()
picks, bans = collections.defaultdict(lambda: collections.defaultdict(list)), collections.defaultdict(lambda: collections.defaultdict(list))
for rid, t, h in c.execute("SELECT replay_id, team, hero FROM ngs_pick ORDER BY slot"):
    picks[rid][t].append(h)
for rid, t, h in c.execute("SELECT replay_id, team, hero FROM ngs_hero_ban"):
    bans[rid][t].append(h)
pl = collections.defaultdict(lambda: [0, 0])
for team, tag, hero, won in c.execute("SELECT team, battletag, hero, won FROM ngs_player_game"):
    pl[(team, tag, hero)][0] += 1
    pl[(team, tag, hero)][1] += won


def mine(team):
    return [g for g in games if team in (g[1], g[2])]


def rec(rows):
    return [len(rows), sum(rows)]


def player(team, tag, hero=None, exclude=False):
    n = w = 0
    for (t, p, h), (g, x) in pl.items():
        if t == team and p == tag and (hero is None or (h != hero if exclude else h == hero)):
            n += g
            w += x
    return [n, w]


def vs_healer(team, heroes):
    inn, out = [], []
    for rid, a, b, win, fp, mp in mine(team):
        opp = b if a == team else a
        (inn if any(h in picks[rid][opp] for h in heroes) else out).append(int(win == team))
    return rec(inn), rec(out)


CLAIMS = []


def claim(label, got, want):
    CLAIMS.append((label, got, want))


hi, other = vs_healer(CCS, ["Brightwing", "Anduin"])
claim("CCS against teams with Brightwing or Anduin (games, wins)", hi, [10, 4])
claim("CCS against every other healer (games, wins)", other, [13, 12])
claim("CCS with first pick (games, wins)", rec([int(g[3] == CCS) for g in mine(CCS) if g[4] == CCS]), [14, 12])
claim("CCS when they pick the map (games, wins)", rec([int(g[3] == CCS) for g in mine(CCS) if g[5] == CCS]), [7, 3])
vs = [g for g in mine(CCS) if PRA in (g[1], g[2])]
claim("games CCS v PRA", [len(vs)], [6])
claim("Thrall banned by CCS against us", [sum(1 for g in vs if "Thrall" in bans[g[0]][CCS])], [5])
claim("Tychus banned by CCS against us", [sum(1 for g in vs if "Tychus" in bans[g[0]][CCS])], [2])
claim("CCS with first pick against us (games, wins)", rec([int(g[3] == CCS) for g in vs if g[4] == CCS]), [2, 2])
claim("UnicycleYay on Qhira (games, wins)", player(CCS, "UnicycleYay", "Qhira"), [5, 2])
claim("UnicycleYay on everything else (games, wins)", player(CCS, "UnicycleYay", "Qhira", True), [15, 12])
claim("Valkamer on Johanna (games, wins)", player(CCS, "Valkamer", "Johanna"), [7, 6])
claim("WitsEnd on Lunara (games, wins)", player(CCS, "WitsEnd", "Lunara"), [11, 8])
claim("ShadowDroid on Gazlowe (games, wins)", player(CCS, "ShadowDroid", "Gazlowe"), [6, 5])
claim("CCS first picks that were Johanna", [sum(1 for g in mine(CCS) if g[4] == CCS and picks[g[0]][CCS][:1] == ["Johanna"])], [4])
claim("SilverJackal on Kael'thas (games, wins)", player(COS, "SilverJackal", "Kael'thas"), [10, 8])
claim("Nae on Anub'arak (games, wins)", player(COS, "Nae", "Anub'arak"), [7, 6])
claim("Imbuement on Greymane (games, wins)", player(COS, "Imbuement", "Greymane"), [6, 6])
claim("Cosmos with Johanna (games, wins)", [sum(v[0] for k, v in pl.items() if k[0] == COS and k[2] == "Johanna"), sum(v[1] for k, v in pl.items() if k[0] == COS and k[2] == "Johanna")], [4, 4])

# Damage first (CCS note, rules ccs-lockearly and ccs-damage-pair, CCS_DRAFT_PLAN.md)
import json
cfg = json.loads((DB.parent.parent / "playbook" / "config" / "our_team.json").read_text(encoding="utf-8"))
duo = {h for p in cfg["players"] if p["tag"] in ("hunterstag", "chelsi") for h, t in p["pool"].items() if t in ("primary", "secondary")}
slot_bans = collections.defaultdict(list)
for rid, t, s, h in c.execute("SELECT replay_id, team, slot, hero FROM ngs_hero_ban"):
    slot_bans[(rid, t)].append((s, h))
claim("CCS bans against us that hit Hunter's or chelsi's heroes (bans, hits)", [sum(len(slot_bans[(g[0], CCS)]) for g in vs), sum(1 for g in vs for s, h in slot_bans[(g[0], CCS)] if h in duo)], [18, 15])
claim("CCS round two ban against us on Thrall or Tychus (games, hits)", [len(vs), sum(1 for g in vs if any(s >= 10 and h in ("Thrall", "Tychus") for s, h in slot_bans[(g[0], CCS)]))], [6, 6])
ch = {rid: h for rid, t, tag, h in c.execute("SELECT replay_id, team, battletag, hero FROM ngs_player_game WHERE battletag='chelsi'")}
claim("chelsi against CCS on Tychus or Thrall (games, wins)", rec([int(g[3] == PRA) for g in vs if ch.get(g[0]) in ("Tychus", "Thrall")]), [3, 2])
claim("chelsi against CCS on anything else (games, wins)", rec([int(g[3] == PRA) for g in vs if ch.get(g[0]) not in ("Tychus", "Thrall")]), [3, 0])
hu = {rid: h for rid, t, tag, h in c.execute("SELECT replay_id, team, battletag, hero FROM ngs_player_game WHERE battletag='hunterstag'")}
pra = mine(PRA)
both = [int(g[3] == PRA) for g in pra if hu.get(g[0]) in ("Sylvanas", "Junkrat") and ch.get(g[0]) in ("Tychus", "Thrall")]
neither = [int(g[3] == PRA) for g in pra if hu.get(g[0]) not in ("Sylvanas", "Junkrat") and ch.get(g[0]) not in ("Tychus", "Thrall")]
claim("PRA with Hunter and chelsi both on their best heroes (games, wins)", rec(both), [11, 9])
claim("PRA with neither on their best heroes (games, wins)", rec(neither), [5, 1])
claim("CCS on Tychus (games, wins)", [sum(v[0] for k, v in pl.items() if k[0] == CCS and k[2] == "Tychus"), sum(v[1] for k, v in pl.items() if k[0] == CCS and k[2] == "Tychus")], [5, 5])
claim("CCS on Orphea or Thrall (games)", [sum(v[0] for k, v in pl.items() if k[0] == CCS and k[2] in ("Orphea", "Thrall"))], [0])
order = collections.defaultdict(list)
for rid, series, gno, win, fp, mp in c.execute("SELECT replay_id, series, game, winner, first_pick_team, map_pick_team FROM ngs_game WHERE (team0=? OR team1=?) AND map_pick_team IS NOT NULL ORDER BY series, game", (CCS, CCS)):
    order[series].append((rid, gno, win, fp, mp))
ccs_after, opp_after, nxt = [], [], [0, 0]
for gs in order.values():
    for a, b in zip(gs, gs[1:]):
        if a[2] == CCS:
            opp_after.append(int(b[4] != b[3] and b[3] == CCS))   # the loser took the map, so CCS had first pick
            continue
        ccs_after.append(int(b[3] == CCS))
        beat = picks[a[0]][[t for t in picks[a[0]] if t != CCS][0]]
        nb = bans[b[0]][CCS]
        nxt[0] += len(nb)
        nxt[1] += sum(1 for h in nb if h in beat)
claim("CCS after a loss took first pick (games, times)", rec(ccs_after), [5, 4])
claim("teams that lost to CCS then took the map (games, times)", rec(opp_after), [7, 6])
claim("CCS next game bans from the comp that beat them (bans, hits)", nxt, [15, 9])
mb = collections.Counter(m for s, r, t, n, m in c.execute("SELECT * FROM ngs_map_ban") if t == CCS)
claim("CCS map bans on Braxis Holdout (series with a CCS ban, Braxis)", [len({s for s, r, t, n, m in c.execute("SELECT * FROM ngs_map_ban") if t == CCS}), mb["Braxis Holdout"]], [8, 6])
claim("CCS on Towers of Doom (games, wins)", rec([int(g[3] == CCS) for g in mine(CCS) if c.execute("SELECT map FROM ngs_game WHERE replay_id=?", (g[0],)).fetchone()[0] == "Towers of Doom"]), [6, 5])

bad = 0
for label, got, want in CLAIMS:
    ok = got == want
    bad += not ok
    print(("OK      " if ok else "CHANGED ") + label + ": " + str(got) + ("" if ok else "  (written as " + str(want) + ")"))
print("ALL OK" if not bad else f"{bad} claim(s) changed: update the rule or note text")
sys.exit(1 if bad else 0)
