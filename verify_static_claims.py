"""Re-check the hand written numbers in the Drafter against knowledge/ngs_div.db (CLAUDE.md rule 1).
The rules in playbook/config/rules.json and the notes in playbook/notes/teams/ carry records that were typed in on a date. This script
recomputes each from the games on disk and prints OK or CHANGED. Run it after new games are added: python -I verify_static_claims.py
Add a line to CLAIMS when a new number goes into a rule or a note.
"""
import collections, sqlite3, pathlib, sys

DB = pathlib.Path(__file__).resolve().parent / "knowledge" / "ngs_div.db"
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
claim("CCS against teams with Brightwing or Anduin (games, wins)", hi, [9, 3])
claim("CCS against every other healer (games, wins)", other, [11, 11])
claim("CCS with first pick (games, wins)", rec([int(g[3] == CCS) for g in mine(CCS) if g[4] == CCS]), [13, 11])
claim("CCS when they pick the map (games, wins)", rec([int(g[3] == CCS) for g in mine(CCS) if g[5] == CCS]), [7, 3])
vs = [g for g in mine(CCS) if PRA in (g[1], g[2])]
claim("games CCS v PRA", [len(vs)], [6])
claim("Thrall banned by CCS against us", [sum(1 for g in vs if "Thrall" in bans[g[0]][CCS])], [5])
claim("Tychus banned by CCS against us", [sum(1 for g in vs if "Tychus" in bans[g[0]][CCS])], [2])
claim("CCS with first pick against us (games, wins)", rec([int(g[3] == CCS) for g in vs if g[4] == CCS]), [2, 2])
claim("UnicycleYay on Qhira (games, wins)", player(CCS, "UnicycleYay", "Qhira"), [5, 2])
claim("UnicycleYay on everything else (games, wins)", player(CCS, "UnicycleYay", "Qhira", True), [12, 10])
claim("Valkamer on Johanna (games, wins)", player(CCS, "Valkamer", "Johanna"), [6, 5])
claim("WitsEnd on Lunara (games, wins)", player(CCS, "WitsEnd", "Lunara"), [11, 8])
claim("ShadowDroid on Gazlowe (games, wins)", player(CCS, "ShadowDroid", "Gazlowe"), [6, 5])
claim("CCS first picks that were Johanna", [sum(1 for g in mine(CCS) if g[4] == CCS and picks[g[0]][CCS][:1] == ["Johanna"])], [4])
claim("SilverJackal on Kael'thas (games, wins)", player(COS, "SilverJackal", "Kael'thas"), [10, 8])
claim("Nae on Anub'arak (games, wins)", player(COS, "Nae", "Anub'arak"), [7, 6])
claim("Imbuement on Greymane (games, wins)", player(COS, "Imbuement", "Greymane"), [6, 6])
claim("Cosmos with Johanna (games, wins)", [sum(v[0] for k, v in pl.items() if k[0] == COS and k[2] == "Johanna"), sum(v[1] for k, v in pl.items() if k[0] == COS and k[2] == "Johanna")], [4, 4])

bad = 0
for label, got, want in CLAIMS:
    ok = got == want
    bad += not ok
    print(("OK      " if ok else "CHANGED ") + label + ": " + str(got) + ("" if ok else "  (written as " + str(want) + ")"))
print("ALL OK" if not bad else f"{bad} claim(s) changed: update the rule or note text")
sys.exit(1 if bad else 0)
