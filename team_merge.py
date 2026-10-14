"""Same team, two names inside one season (NGS lets a captain retype the team name, and a few teams played under a placeholder).

detect(): finds pairs in knowledge/ngs_league.db that share 4 or more players in a season, sit in the same division and never face each
          other, and writes knowledge/team_merge.json  [{season, division, canonical, names:[...], shared, games:{name:n}}].
apply():  renames every other name to the canonical one inside knowledge/ngs_league.db (lg_games) and knowledge/ngs_season.db (season 22 tables).
          Idempotent: run it at the start of any builder that reads those databases.
Run: python team_merge.py          (detect then apply, prints what it merged)
"""
import collections, difflib, itertools, json, pathlib, re, sqlite3, sys

KN = pathlib.Path(__file__).resolve().parent / "knowledge"
OUT = KN / "team_merge.json"
MIN_SHARED = 4
PLACEHOLDER = {"pending", "tbd", "tba", "team", "unknown"}   # never the canonical name
# Season in ngs_season.db (the match pages for the current season)
CURRENT_SEASON = 22


def detect():
    c = sqlite3.connect(KN / "ngs_league.db")
    games = collections.Counter()
    div = {}
    faced = set()
    for s, d, t0, t1 in c.execute("SELECT season, division, team0, team1 FROM lg_games"):
        for t in (t0, t1):
            games[(s, t)] += 1
            div[(s, t)] = d
        faced.add((s, frozenset((t0, t1))))
    ro = collections.defaultdict(set)
    for s, t0, t1, side, toon in c.execute(
            "SELECT g.season, g.team0, g.team1, p.team, p.toon FROM lg_players p JOIN lg_games g USING(game_id)"):
        ro[(s, t0 if side == 0 else t1)].add(toon.split("-")[-1])
    found = []
    for s in sorted({k[0] for k in ro}):
        names = [k[1] for k in ro if k[0] == s and k[1]]
        for a, b in itertools.combinations(names, 2):
            if div.get((s, a)) != div.get((s, b)) or (s, frozenset((a, b))) in faced:
                continue
            sh = len(ro[(s, a)] & ro[(s, b)])
            if sh >= MIN_SHARED:
                found.append((s, div.get((s, a)), a, b, sh))
    # group pairs that chain (A with B, B with C)
    out = []
    for s, d, a, b, sh in found:
        for g in out:
            if g["season"] == s and (a in g["names"] or b in g["names"]):
                g["names"] |= {a, b}
                g["shared"] = min(g["shared"], sh)
                break
        else:
            out.append(dict(season=s, division=d, names={a, b}, shared=sh))
    res = []
    for g in out:
        nm = sorted(g["names"], key=lambda n: (n.lower() in PLACEHOLDER, -games[(g["season"], n)], n))
        res.append(dict(season=g["season"], division=g["division"], canonical=nm[0], names=nm,
                        shared=g["shared"], games={n: games[(g["season"], n)] for n in nm}))
    OUT.write_text(json.dumps(res, indent=1, ensure_ascii=False), encoding="utf-8")
    return res


def load():
    return json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else []


def apply(merges=None):
    merges = load() if merges is None else merges
    n = 0
    lg = sqlite3.connect(KN / "ngs_league.db")
    for m in merges:
        for old in m["names"]:
            if old == m["canonical"]:
                continue
            for col in ("team0", "team1"):
                n += lg.execute(f"UPDATE lg_games SET {col}=? WHERE season=? AND {col}=?", (m["canonical"], m["season"], old)).rowcount
    lg.commit()
    p = KN / "ngs_season.db"
    if p.exists():
        db = sqlite3.connect(p)
        have = {t: [r[1] for r in db.execute(f'pragma table_info("{t}")')] for (t,) in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        exact = {"ngs_game": ["team0", "team1", "winner", "loser", "first_pick_team", "map_pick_team"], "ngs_hero_ban": ["team"],
                 "ngs_pick": ["team"], "ngs_player_game": ["team"], "ngs_map_ban": ["team"]}
        for m in merges:
            if m["season"] != CURRENT_SEASON:
                continue
            for old in m["names"]:
                if old == m["canonical"]:
                    continue
                for t, cols in exact.items():
                    for col in cols:
                        if t in have and col in have[t]:
                            n += db.execute(f'UPDATE "{t}" SET "{col}"=? WHERE "{col}"=?', (m["canonical"], old)).rowcount
                for t in ("ngs_game", "ngs_map_ban"):
                    if t in have and "series" in have[t]:
                        db.execute(f'UPDATE "{t}" SET series=replace(series, ?, ?) WHERE series LIKE ?', (old, m["canonical"], "%" + old + "%"))
        db.commit()
    return n


if __name__ == "__main__":
    res = detect()
    for m in res:
        print(f"S{m['season']} {m['division']}: {' + '.join(m['names'])} -> {m['canonical']} (share {m['shared']} players, games {m['games']})")
    print("rows renamed:", apply(res))
