"""Backtest of the Drafter's scoring terms on held out NGS seasons (python -I backtest_terms.py).

League facts are fitted on earlier seasons only (rolling origin: train 15 to 20 and test 21, train 15 to 21 and test 22). Each term gives a
predicted win probability shift for each side; the test uses the difference between the two sides. For each term we report the calibration
slope (actual win shift per predicted point: 1 means honest, 0 means no signal) with a 95% bootstrap interval over test games, and the
change in log loss against a coin flip. Player terms use only games played before the test game. Writes knowledge/backtest_terms.json.
Association only: a term that predicts wins may stand in for something else in the draft."""
import collections, json, math, pathlib, random, sqlite3, unicodedata

ROOT = pathlib.Path(__file__).resolve().parent
KN = ROOT / "knowledge"
HALF_LIFE = 3.0
H2H_PRIOR = 300.0   # weighted games, as in playbook/engine.js
MAP_PRIOR = 20.0    # as the Draft Lab
PLAYER_PRIOR = 10.0


def norm(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s or "") if c.isalnum()).lower()


def load():
    data = json.load(open(ROOT / "playbook" / "data.json", encoding="utf-8"))
    heroes = data["heroes"]
    canon = {norm(h): h for h in heroes}
    db = sqlite3.connect(KN / "ngs_league.db")
    games = {}
    for gid, season, mp, winner, date in db.execute("SELECT game_id, season, map, winner, date FROM lg_games WHERE winner IS NOT NULL"):
        games[gid] = dict(id=gid, season=season, map=mp, winner=int(winner), date=date or "", picks={0: [], 1: []}, bans={0: [], 1: []}, players={0: [], 1: []})
    for gid, team, hero in db.execute("SELECT game_id, team, hero FROM lg_picks ORDER BY game_id, team, pick_no"):
        h = canon.get(norm(hero))
        if gid in games and h:
            games[gid]["picks"][int(team)].append(h)
    for gid, team, hero in db.execute("SELECT game_id, team, hero FROM lg_bans"):
        h = canon.get(norm(hero))
        if gid in games and h:
            games[gid]["bans"][int(team)].append(h)
    for gid, team, hero, toon, deaths in db.execute("SELECT game_id, team, hero, toon, deaths FROM lg_players"):
        h = canon.get(norm(hero))
        if gid in games and h and toon:
            games[gid]["players"][int(team)].append((toon.split("-")[-1], h, deaths or 0))
    games = {k: g for k, g in games.items() if len(g["picks"][0]) == 5 and len(g["picks"][1]) == 5}
    return heroes, games


def sw(season, newest):
    return 0.5 ** (max(0, newest - season) / HALF_LIFE)


def fit(heroes, train):
    """League facts from the training games only, newer seasons weighted more (same half life as the build)."""
    newest = max(g["season"] for g in train)
    base = collections.defaultdict(lambda: [0.0, 0.0])
    pair = collections.defaultdict(lambda: [0.0, 0.0])
    hmap = collections.defaultdict(lambda: [0.0, 0.0])
    ranged = collections.defaultdict(lambda: [0.0, 0.0])
    heal = collections.defaultdict(lambda: [0.0, 0.0])
    lens_rows = []
    for g in train:
        wt = sw(g["season"], newest)
        for t in (0, 1):
            won = int(g["winner"] == t)
            mine, theirs = g["picks"][t], g["picks"][1 - t]
            for a in mine:
                base[a][0] += wt; base[a][1] += wt * won
                hmap[(a, g["map"])][0] += wt; hmap[(a, g["map"])][1] += wt * won
                for b in theirs:
                    pair[(a, b)][0] += wt; pair[(a, b)][1] += wt * won
            rc = sum(1 for h in mine if heroes[h].get("ranged"))
            ranged["3+" if rc >= 3 else "lo"][0] += wt; ranged["3+" if rc >= 3 else "lo"][1] += wt * won
            hh = [h for h in theirs if heroes[h].get("hclass")]
            if len(hh) == 1:
                cls = heroes[hh[0]]["hclass"]
                for a in mine:
                    if heroes[a].get("carry") or heroes[a].get("ranged"):
                        heal[(a, cls)][0] += wt; heal[(a, cls)][1] += wt * won
                        heal[(a, "*")][0] += wt; heal[(a, "*")][1] += wt * won
            lens_rows.append((won, lens_count(heroes, mine)))
    hb = {h: (v[1] + 5) / (v[0] + 10) for h, v in base.items()}
    gap = ranged["3+"][1] / ranged["3+"][0] - ranged["lo"][1] / ranged["lo"][0] if ranged["3+"][0] and ranged["lo"][0] else 0
    # lens signal as the build does it: thresholds 1 to 3, |z| 3.3 or more, 250 sides each way
    items = []
    keys = {k for r in lens_rows for k in r[1]}
    for k in keys:
        for thr in (1, 2, 3):
            a = [r[0] for r in lens_rows if r[1][k] >= thr]
            b = [r[0] for r in lens_rows if r[1][k] < thr]
            if len(a) < 250 or len(b) < 250:
                continue
            wa, wb = sum(a) / len(a), sum(b) / len(b)
            se = math.sqrt(wa * (1 - wa) / len(a) + wb * (1 - wb) / len(b))
            if se and abs((wa - wb) / se) >= 3.3:
                items.append((k, thr, wa - 0.5))
    return dict(hb=hb, pair=pair, hmap=hmap, gap=gap, heal=heal, lens=items)


def lens_count(heroes, hs):
    c = collections.Counter()
    for h in hs:
        for k, v in (((heroes[h].get("profile") or {}).get("lenses")) or {}).items():
            for x in (v if isinstance(v, list) else [v]):
                c[(k, x)] += 1
    return c


def side_terms(heroes, F, g, t, pl):
    mine, theirs = g["picks"][t], g["picks"][1 - t]
    hb = F["hb"]
    out = {}
    out["hero_strength"] = sum(hb.get(a, 0.5) - 0.5 for a in mine)
    e = 0.0
    for a in mine:
        for b in theirs:
            v = F["pair"].get((a, b))
            if v:
                e += (v[1] - hb.get(a, 0.5) * v[0]) / (v[0] + H2H_PRIOR)
    out["h2h_edge"] = e
    rc = sum(1 for h in mine if heroes[h].get("ranged"))
    out["ranged_3plus"] = F["gap"] if rc >= 3 else 0.0
    hh = [h for h in theirs if heroes[h].get("hclass")]
    hl = 0.0
    if len(hh) == 1:
        cls = heroes[hh[0]]["hclass"]
        for a in mine:
            c, o = F["heal"].get((a, cls)), F["heal"].get((a, "*"))
            if c and o and c[0] >= 60 and o[0]:
                edge = c[1] / c[0] - o[1] / o[0]
                if abs(edge) >= 0.04:
                    hl += edge
    out["heal_lens"] = hl
    cnt = lens_count(heroes, mine)
    out["lens_read"] = sum(d for (k, thr, d) in F["lens"] if cnt[k] >= thr)
    md = 0.0
    for a in mine:
        v = F["hmap"].get((a, g["map"]))
        b = hb.get(a, 0.5)
        if v:
            md += (v[1] + MAP_PRIOR * b) / (v[0] + MAP_PRIOR) - b
    out["map_delta"] = md
    # players: record on this hero before this game, centred on 50% (Laplace, as the Drafter does) or on the player's own rate
    c50 = cown = comfort = 0.0
    for toon, h, _ in g["players"][t]:
        p = pl.get(toon, {})
        tot = p.get("*", [0, 0])
        own = (tot[1] + 5) / (tot[0] + 10)
        r = p.get(h, [0, 0])
        if r[0] >= 2:
            c50 += (r[1] + 1) / (r[0] + 2) - 0.5
        cown += (r[1] + PLAYER_PRIOR * own) / (r[0] + PLAYER_PRIOR) - own
        comfort += math.log1p(r[0])
    out["player_hero_vs_50"] = c50
    out["player_hero_vs_own"] = cown
    out["player_comfort_log_games"] = comfort
    out["player_own_rate"] = sum(((pl.get(toon, {}).get("*", [0, 0])[1] + 5) / (pl.get(toon, {}).get("*", [0, 0])[0] + 10)) - 0.5 for toon, _, _ in g["players"][t])
    # bans: games the other side's players had on the heroes this side banned (prior games only)
    bt = 0.0
    for h in g["bans"][t]:
        bt += max([pl.get(toon, {}).get(h, [0, 0])[0] for toon, _, _ in g["players"][1 - t]] + [0])
    out["ban_threat_games"] = bt
    return out


def slope(rows, key):
    """Least squares slope of (won minus 0.5) on the side difference of a term, through the origin (side order is arbitrary)."""
    sxy = sum((r["y"] - 0.5) * r[key] for r in rows)
    sxx = sum(r[key] ** 2 for r in rows)
    return sxy / sxx if sxx else None


def main():
    random.seed(22)
    heroes, games = load()
    by_date = sorted(games.values(), key=lambda g: (g["date"], g["id"]))
    rows = []
    for test in (21, 22):
        F = fit(heroes, [g for g in games.values() if g["season"] < test])
        pl = collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0]))
        for g in by_date:
            if g["season"] > test:
                continue
            if g["season"] == test:
                a, b = side_terms(heroes, F, g, 0, pl), side_terms(heroes, F, g, 1, pl)
                rows.append(dict({k: a[k] - b[k] for k in a}, y=int(g["winner"] == 0), season=test, map=g["map"]))
            for t in (0, 1):
                for toon, h, _ in g["players"][t]:
                    won = int(g["winner"] == t)
                    pl[toon][h][0] += 1; pl[toon][h][1] += won
                    pl[toon]["*"][0] += 1; pl[toon]["*"][1] += won
    keys = [k for k in rows[0] if k not in ("y", "season", "map")]
    res = {"test_games": len(rows), "by_season": dict(collections.Counter(r["season"] for r in rows)), "terms": {}}
    B = 1000
    for k in keys:
        b = slope(rows, k)
        boots = []
        for _ in range(B):
            s = [rows[random.randrange(len(rows))] for _ in rows]
            v = slope(s, k)
            if v is not None:
                boots.append(v)
        boots.sort()
        nz = sum(1 for r in rows if r[k] != 0)
        sd = math.sqrt(sum(r[k] ** 2 for r in rows) / len(rows))
        # log loss of p = 0.5 + slope * diff (clamped) against 0.5, fitted slope from the other season (honest out of sample)
        ll = 0.0
        for s_out in (21, 22):
            fit_rows = [r for r in rows if r["season"] != s_out]
            bb = slope(fit_rows, k) or 0
            for r in rows:
                if r["season"] != s_out:
                    continue
                p = min(0.95, max(0.05, 0.5 + bb * r[k]))
                ll += -(math.log(p) if r["y"] else math.log(1 - p)) - math.log(2)
        per = {s: slope([r for r in rows if r["season"] == s], k) for s in (21, 22)}
        res["terms"][k] = dict(slope=round(b, 3) if b is not None else None, ci95=[round(boots[int(0.025 * len(boots))], 3), round(boots[int(0.975 * len(boots))], 3)] if boots else None,
                               slope_s21=round(per[21], 3) if per[21] is not None else None, slope_s22=round(per[22], 3) if per[22] is not None else None,
                               games_with_signal=nz, sd_of_difference=round(sd, 4), logloss_change_per_game=round(ll / len(rows), 5),
                               win_shift_per_sd=round(b * sd, 4) if b is not None else None)
    # joint fit (least squares through the origin, Gauss elimination) for overlap between terms
    X = [[r[k] for k in keys] for r in rows]
    yv = [r["y"] - 0.5 for r in rows]
    n = len(keys)
    A = [[sum(x[i] * x[j] for x in X) for j in range(n)] + [sum(x[i] * y for x, y in zip(X, yv))] for i in range(n)]
    for i in range(n):
        piv = max(range(i, n), key=lambda r: abs(A[r][i]))
        A[i], A[piv] = A[piv], A[i]
        for r in range(n):
            if r != i and A[i][i]:
                f = A[r][i] / A[i][i]
                A[r] = [a - f * c for a, c in zip(A[r], A[i])]
    res["joint_slopes"] = {k: round(A[i][n] / A[i][i], 3) for i, k in enumerate(keys)}
    (KN / "backtest_terms.json").write_text(json.dumps(res, indent=1), encoding="utf-8")
    print(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
